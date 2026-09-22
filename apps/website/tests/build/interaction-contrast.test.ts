import { TocusAppearance, TocusPalette } from '@tocus/ui/types';
import { ForegroundSource, type ContrastMeasurement } from './types';
import { fileURLToPath } from 'node:url';
import { expect, test as base, type Locator, type Page, type Route } from '@playwright/test';

const WebsiteOutput = new URL( '../../dist/', import.meta.url );
const PublicRoutes = [ '/', '/de/', '/es/', '/es-ar/', '/fr/', '/it/', '/ja/', '/pt-br/', '/pt-pt/', '/ru/' ] as const;

const websiteTest = base.extend( {
	/**
	 * Audits local hydration and asset requests throughout each isolated page test.
	 * @param fixtures - Playwright's browser fixtures.
	 * @param fixtures.page - Disposable browser page.
	 * @param use - Runs the test before checking the recorded browser failures.
	 */
	page: async ( { page }, use ) => {
		const errors: string[] = [];
		const externalRequests: string[] = [];
		page.on( 'pageerror', ( error ) => {
			errors.push( error.message );
		} );
		page.context().on( 'request', ( request ) => {
			if ( new URL( request.url() ).origin !== 'http://website.test' ) {
				externalRequests.push( request.url() );
			}
		} );
		await page.context().route( 'http://website.test/**', fulfillWebsiteAsset );
		await use( page );
		expect( errors, 'Website hydration must not raise browser errors.' ).toEqual( [] );
		expect( externalRequests, 'Website assets must stay local.' ).toEqual( [] );
	},
} );

websiteTest.use( { colorScheme: TocusAppearance.LIGHT, contextOptions: { reducedMotion: 'reduce' } } );

/**
 * Serves one generated website asset to the disposable browser.
 * @param route - Request intercepted by Playwright.
 * @return Promise resolved after the generated asset is fulfilled.
 */
async function fulfillWebsiteAsset( route: Route ): Promise<void> {
	const request = new URL( route.request().url() );
	const pathname = request.pathname.endsWith( '/' ) ? `${ request.pathname }index.html` : request.pathname;

	await route.fulfill( { path: fileURLToPath( new URL( `.${ pathname }`, WebsiteOutput ) ) } );
}

/**
 * Opens one generated locale and waits for its real hydration to finish.
 * @param page - Disposable browser page.
 * @param route - Generated locale route.
 * @return Promise resolved when the light homepage is interactive.
 */
async function openHomepage( page: Page, route: string ): Promise<void> {
	await page.goto( `http://website.test${ route }` );
	await expect( page.locator( '.homepage' ) ).toHaveAttribute( 'data-enhanced', 'true' );
	await expect( page.locator( '[data-tocus-ui]' ).first() ).toHaveAttribute( 'data-tocus-theme', TocusAppearance.LIGHT );
}

/**
 * Waits for finite transitions on one website control and its descendants.
 * @param locator - Control whose rendered interaction state must settle.
 * @return Promise resolved after finite animations finish.
 */
async function settleControl( locator: Locator ): Promise<void> {
	await locator.evaluate( async ( element ) => {
		getComputedStyle( element ).getPropertyValue( 'background-color' );
		await Promise.all( element.getAnimations( { subtree: true } ).filter(
			( animation ) => animation.effect?.getComputedTiming().iterations !== Infinity,
		).map( ( animation ) => animation.finished.catch( () => undefined ) ) );
	} );
}

/**
 * Moves the pointer away and advances actual keyboard focus to one control.
 * @param page - Disposable browser page.
 * @param locator - Control expected to receive the next Tab stop.
 * @param label - Assertion context.
 * @return Promise resolved after keyboard focus styles settle.
 */
async function focusNextControl( page: Page, locator: Locator, label: string ): Promise<void> {
	await page.mouse.move( 0, 0 );
	// macOS WebKit uses Option+Tab to visit links when full keyboard access is off.
	const key = process.platform === 'darwin' && page.context().browser()?.browserType().name() === 'webkit'
		? 'Alt+Tab' : 'Tab';
	await page.keyboard.press( key );
	await expect( locator, label ).toBeFocused();
	await settleControl( locator );
}

/**
 * Re-enters a control using keyboard navigation so focus-visible is measured.
 * @param page - Disposable browser page.
 * @param locator - Control whose focus indicator is inspected.
 * @param label - Assertion context.
 * @return Promise resolved after keyboard focus styles settle.
 */
async function focusControl( page: Page, locator: Locator, label: string ): Promise<void> {
	await page.mouse.move( 0, 0 );
	await locator.focus();
	const reverseKey = process.platform === 'darwin' && page.context().browser()?.browserType().name() === 'webkit'
		? 'Alt+Shift+Tab' : 'Shift+Tab';
	await page.keyboard.press( reverseKey );
	await focusNextControl( page, locator, label );
}

/**
 * Measures one rendered foreground against the first opaque painted background.
 * @param locator - Rendered text control to measure.
 * @param source - Visual foreground whose contrast is measured.
 * @return Browser-resolved colors and WCAG contrast ratio.
 */
async function measureContrast(
	locator: Locator,
	source: ForegroundSource = ForegroundSource.TEXT,
): Promise<ContrastMeasurement> {
	return locator.evaluate( ( element, { foregroundSource, sources } ) => {
		/**
		 * Converts one browser-resolved RGB color to channels and opacity.
		 * @param color - Browser-resolved RGB or sRGB color.
		 * @return Red, green, blue, and alpha channels.
		 */
		function parseColor( color: string ): readonly [ number, number, number, number ] {
			if ( color.startsWith( 'color(srgb ' ) ) {
				const channels = color.slice( 'color(srgb '.length, -1 ).match( /[\d.]+/gu )?.map( Number );

				if ( channels === undefined || channels.length < 3 ) {
					throw new Error( `Unsupported resolved color: ${ color }` );
				}

				return [
					( channels[ 0 ] ?? 0 ) * 255,
					( channels[ 1 ] ?? 0 ) * 255,
					( channels[ 2 ] ?? 0 ) * 255,
					channels[ 3 ] ?? 1,
				];
			}
			const channels = color.match( /[\d.]+/gu )?.map( Number );

			if ( channels === undefined || channels.length < 3 ) {
				throw new Error( `Unsupported resolved color: ${ color }` );
			}

			return [ channels[ 0 ] ?? 0, channels[ 1 ] ?? 0, channels[ 2 ] ?? 0, channels[ 3 ] ?? 1 ];
		}

		/**
		 * Resolves the first opaque background painted behind one element.
		 * @param target - Element whose painted ancestry is inspected.
		 * @return First opaque browser-resolved background color.
		 */
		function resolveBackground( target: Element | null ): string {
			let candidate = target;

			while ( candidate !== null ) {
				const background = getComputedStyle( candidate ).backgroundColor;
				const alpha = parseColor( background )[ 3 ];

				if ( alpha > 0 && alpha < 1 ) {
					throw new Error( `Translucent rendered backgrounds require explicit composition: ${ background }` );
				}
				if ( alpha === 1 ) {
					return background;
				}
				candidate = candidate.parentElement;
			}

			throw new Error( 'No opaque rendered background was found.' );
		}

		/**
		 * Calculates relative luminance from one browser-resolved RGB color.
		 * @param color - Browser-resolved RGB or sRGB color.
		 * @return WCAG relative luminance.
		 */
		function luminance( color: string ): number {
			const channels = parseColor( color ).slice( 0, 3 ).map( ( channel ) => {
				const normalized = channel / 255;

				return normalized <= 0.04045 ? normalized / 12.92 : ( ( normalized + 0.055 ) / 1.055 ) ** 2.4;
			} );

			return ( 0.2126 * ( channels[ 0 ] ?? 0 ) ) +
				( 0.7152 * ( channels[ 1 ] ?? 0 ) ) +
				( 0.0722 * ( channels[ 2 ] ?? 0 ) );
		}

		const style = getComputedStyle( element );
		let foreground: string | undefined;

		if ( foregroundSource === sources.TEXT ) {
			foreground = style.color;
		} else if ( foregroundSource === sources.OUTLINE ) {
			if ( style.outlineStyle === 'none' || Number.parseFloat( style.outlineWidth ) < 2 ) {
				throw new Error( 'No visible focus outline was rendered.' );
			}
			foreground = style.outlineColor;
		} else {
			foreground = style.boxShadow.match( /(?:rgba?\([^)]*\)|color\(srgb[^)]*\))/u )?.[ 0 ];
		}

		if ( foreground === undefined ) {
			throw new Error( `No ${ foregroundSource } foreground was rendered.` );
		}
		const indicatorPaintsInside = foregroundSource === sources.OUTLINE &&
			Number.parseFloat( style.outlineOffset ) < 0;
		const background = resolveBackground(
			foregroundSource === sources.TEXT || indicatorPaintsInside ? element : element.parentElement,
		);
		const foregroundLuminance = luminance( foreground );
		const backgroundLuminance = luminance( background );

		return {
			background,
			foreground,
			ratio: ( Math.max( foregroundLuminance, backgroundLuminance ) + 0.05 ) /
				( Math.min( foregroundLuminance, backgroundLuminance ) + 0.05 ),
		};
	}, { foregroundSource: source, sources: ForegroundSource } );
}

for ( const browserName of [ 'chromium', 'firefox', 'webkit' ] as const ) {
	const test = websiteTest.extend( { browserName } );
	test.describe( browserName, () => {
		test.describe( 'generated website interaction contrast', () => {
			// Locales share control styles, and the homepage explicitly selects light appearance.
			// Audit every palette and native interaction once per engine on the English route.
			for ( const palette of Object.values( TocusPalette ) ) {
				test( `${ palette }: controls preserve text and keyboard-focus contrast`, async ( { page } ) => {
					await openHomepage( page, '/' );
					await page.locator( '[data-tocus-ui]' ).first().evaluate( ( root, value ) => {
						root.setAttribute( 'data-tocus-palette', value );
					}, palette );
					const alternatives = page.locator( '.hero-actions .store-alternatives a' );
					await expect( alternatives ).toHaveCount( 3 );
					for ( const [ name, target ] of [
						[ 'source link', page.locator( '#privacy' ).getByRole( 'link', { name: 'View the source', exact: true } ) ],
						[ 'download action', page.locator( '.hero-actions [data-download-primary]' ) ],
						[ 'first alternate browser', alternatives.nth( 0 ) ],
						[ 'second alternate browser', alternatives.nth( 1 ) ],
						[ 'third alternate browser', alternatives.nth( 2 ) ],
						[ 'language menu', page.locator( '.site-header .language-shortcut' ) ],
					] as const ) {
						await test.step( name, async () => {
							await page.mouse.move( 0, 0 );
							await settleControl( target );
							expect( ( await measureContrast( target ) ).ratio, `${ palette } ${ name } normal` ).toBeGreaterThanOrEqual( 4.5 );
							await target.hover();
							await settleControl( target );
							expect( ( await measureContrast( target ) ).ratio, `${ palette } ${ name } hover` ).toBeGreaterThanOrEqual( 4.5 );
							await focusControl( page, target, `${ palette } ${ name } keyboard focus` );
							expect( ( await measureContrast( target, ForegroundSource.OUTLINE ) ).ratio, `${ palette } ${ name } focus` ).toBeGreaterThanOrEqual( 3 );
						} );
					}
				} );
			}
		} );

		test.describe( 'generated website locales', () => {
			for ( const route of PublicRoutes ) {
				test( `${ route }: supports keyboard order, local hydration and mobile layout`, async ( { page } ) => {
					await openHomepage( page, route );
					const alternatives = page.locator( '.hero-actions .store-alternatives a' );
					await expect( alternatives ).toHaveCount( 3 );
					await focusNextControl( page, page.locator( '.skip-link' ), `${ route } skip link` );
					await focusNextControl( page, page.locator( '.site-header .language-shortcut' ), `${ route } language menu` );
					await focusNextControl( page, page.locator( '.hero-actions [data-download-primary]' ), `${ route } download action` );
					await focusNextControl( page, alternatives.nth( 0 ), `${ route } first alternate browser` );
					await focusNextControl( page, alternatives.nth( 1 ), `${ route } second alternate browser` );
					await focusNextControl( page, alternatives.nth( 2 ), `${ route } third alternate browser` );
					await focusNextControl( page, page.locator( '.story-step-action' ).first(), `${ route } first story chapter` );
					await expect( page.locator( '.site-header .language-shortcut' ) ).toBeVisible();
					await page.setViewportSize( { width: 360, height: 800 } );
					await page.evaluate( () => document.fonts.ready );
					await expect.poll( () => page.evaluate(
						() => document.documentElement.scrollWidth <= window.innerWidth,
					), { message: `${ route } fits the mobile viewport` } ).toBe( true );
				} );
			}
		} );

		test( 'homepage remains light with a dark operating-system preference', async ( { page } ) => {
			await page.emulateMedia( { colorScheme: TocusAppearance.DARK } );
			await openHomepage( page, '/' );
		} );
	} );
}
