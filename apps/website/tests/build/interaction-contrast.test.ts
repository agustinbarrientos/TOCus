import { TocusAppearance, TocusPalette } from '@tocus/ui/types';
import { ForegroundSource, type ContrastMeasurement } from './types';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit, type Locator, type Page, type Route } from 'playwright';
import { describe, expect, test } from 'vitest';

const WebsiteOutput = new URL( '../../dist/', import.meta.url );
const PublicRoutes = [ '/', '/de/', '/es/', '/es-ar/', '/fr/', '/it/', '/ja/', '/pt-br/', '/pt-pt/', '/ru/' ] as const;
const ColorSchemes = [ TocusAppearance.LIGHT, TocusAppearance.DARK ] as const;

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
 * Waits for finite transitions on one website control and its descendants.
 * @param locator - Control whose rendered interaction state must settle.
 * @return Promise resolved after finite animations finish.
 */
async function settleControl( locator: Locator ): Promise<void> {
	await locator.evaluate( async ( element ) => {
		void getComputedStyle( element ).backgroundColor;
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
	expect( await locator.evaluate( ( element ) => element === document.activeElement ), label ).toBe( true );
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

describe( 'generated website interaction contrast', () => {
	for ( const engine of [ chromium, firefox, webkit ] ) {
		for ( const colorScheme of ColorSchemes ) {
			test( `${ engine.name() }: ${ colorScheme } routes support keyboard and local hydration`, async () => {
				const browser = await engine.launch();
				const context = await browser.newContext( { colorScheme, reducedMotion: 'reduce' } );
				const errors: string[] = [];
				const externalRequests: string[] = [];
				context.on( 'request', ( request ) => {
					if ( new URL( request.url() ).origin !== 'http://website.test' ) {
						externalRequests.push( request.url() );
					}
				} );
				await context.route( 'http://website.test/**', fulfillWebsiteAsset );
				const page = await context.newPage();
				page.on( 'pageerror', ( error ) => {
					errors.push( error.message );
				} );

				try {
					for ( const route of PublicRoutes ) {
						await page.goto( `http://website.test${ route }` );
						await page.waitForFunction( ( scheme ) =>
							document.querySelector( '[data-tocus-ui]' )?.getAttribute( 'data-tocus-theme' ) === scheme,
						TocusAppearance.LIGHT );
						const headerDownload = page.locator( '.site-header [data-download-primary]' );
						const sourceLink = page.locator( '.open-source a' ).first();
						const downloadAction = page.locator( '.hero-actions [data-download-primary]' );
						const alternatives = page.locator( '.hero-actions .store-alternatives a' );
						const firstStoryStep = page.locator( '.story-step-action' ).first();
						const languageButton = page.locator( '#languages .language-shortcut' );
						expect( await alternatives.count() ).toBe( 2 );
						await focusNextControl( page, page.locator( '.skip-link' ), `${ route } skip link` );
						await focusNextControl( page, headerDownload, `${ route } header download link` );
						await focusNextControl( page, downloadAction, `${ route } download action` );
						await focusNextControl( page, alternatives.nth( 0 ), `${ route } first alternate browser` );
						await focusNextControl( page, alternatives.nth( 1 ), `${ route } second alternate browser` );
						await focusNextControl( page, firstStoryStep, `${ route } first story chapter` );
						for ( const palette of Object.values( TocusPalette ) ) {
							await page.locator( '[data-tocus-ui]' ).first().evaluate( ( root, value ) => {
								root.setAttribute( 'data-tocus-palette', value );
							}, palette );
							for ( const target of [ sourceLink, headerDownload, downloadAction,
								alternatives.nth( 0 ), alternatives.nth( 1 ), languageButton ] ) {
								await page.mouse.move( 0, 0 );
								await settleControl( target );
								expect( ( await measureContrast( target ) ).ratio, `${ route } ${ palette } normal` ).toBeGreaterThanOrEqual( 4.5 );
								await target.hover();
								await settleControl( target );
								expect( ( await measureContrast( target ) ).ratio, `${ route } ${ palette } hover` ).toBeGreaterThanOrEqual( 4.5 );
								await focusControl( page, target, `${ route } ${ palette } keyboard focus` );
								expect( ( await measureContrast( target, ForegroundSource.OUTLINE ) ).ratio, `${ route } ${ palette } focus` ).toBeGreaterThanOrEqual( 3 );
							}
						}
						await page.setViewportSize( { width: 360, height: 800 } );
						const fitsViewport = await page.evaluate(
							() => document.documentElement.scrollWidth <= window.innerWidth,
						);
						expect( fitsViewport ).toBe( true );
						await page.setViewportSize( { width: 1280, height: 900 } );
					}
					expect( errors ).toEqual( [] );
					expect( externalRequests ).toEqual( [] );
				} finally {
					await browser.close();
				}
			}, 180_000 );
		}
	}
} );
