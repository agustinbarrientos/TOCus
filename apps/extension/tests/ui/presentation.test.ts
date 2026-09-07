import { PresentationFixtureEvent, SiteRemovalScenario, SiteBatchScenario, PreferenceSaveScenario, PresentationSurface } from './types';
import { readFileSync } from 'node:fs';
import { Language } from '../../src/domains/preferences/types';
import { IconName } from '../../../../packages/ui/src/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import { chromium, firefox, webkit, type Browser, type Page } from 'playwright';
import { createLocalizationViteConfig } from '../../config/vite/services/create-localization-vite-config';

let server: ViteDevServer;
let origin: string;

/**
 * Reaches the website step through the actual preference save actions.
 * @param page - New browser page running the production presentation.
 * @param options - Controlled persistence scenario encoded by the fixture.
 */
async function openSites( page: Page, options = '' ): Promise<void> {
	await page.goto( `${ origin }apps/extension/tests/ui/index.html?surface=${ PresentationSurface.ONBOARDING }&${ options }` );
	await page.getByRole( 'button', { name: 'Continue', exact: true } ).click();
	await page.getByRole( 'heading', { name: 'Make TOCus yours' } ).waitFor();
	await page.getByRole( 'button', { name: 'Continue', exact: true } ).click();
	await page.getByRole( 'heading', { name: 'Choose websites', exact: true } ).waitFor();
}
beforeAll( async () => {
	server = await createServer( {
		configFile: false, root: process.cwd(), cacheDir: 'node_modules/.vite/onboarding-browser',
		optimizeDeps: { entries: [ 'apps/extension/tests/ui/main.tsx' ], exclude: [ '@lingui/core/macro' ] },
		plugins: createLocalizationViteConfig().plugins, server: { host: '127.0.0.1', port: 0 }, logLevel: 'error',
	} );
	await server.listen();
	const address = server.resolvedUrls?.local[ 0 ];
	if ( ! address ) {
		throw new Error( 'The browser fixture server did not expose a local URL.' );
	}
	origin = address;
} );
afterAll( async () => {
	await server.close();
} );

for ( const [ name, engine ] of Object.entries( { chromium, firefox, webkit } ) ) {
	describe( `${ name } migrated presentation`, () => {
		let browser: Browser;
		beforeAll( async () => {
			browser = await engine.launch();
		} );
		afterAll( async () => {
			await browser.close();
		} );
		it( 'preserves the branded onboarding panel, privacy surface and right-aligned Continue action', async () => {
			const page = await browser.newPage( { viewport: { width: 1440, height: 1000 } } );
			try {
				await page.goto( `${ origin }apps/extension/tests/ui/index.html?surface=${ PresentationSurface.ONBOARDING }` );
				await page.getByRole( 'heading', { name: 'Choose your language' } ).waitFor();
				const layout = await page.evaluate( () => {
					const stage = document.querySelector<HTMLElement>( '.onboarding-view' );
					const panel = document.querySelector<HTMLElement>( '.onboarding-form' );
					const privacy = document.querySelector<HTMLElement>( '.onboarding-privacy' );
					const actions = document.querySelector<HTMLElement>( '.onboarding-form .tocus-form-actions' );
					const button = actions?.querySelector( 'button' );
					const privacyDescription = privacy?.querySelector( 'p:last-child' );
					const footer = document.querySelector( '.onboarding-footer' );
					if ( ! stage || ! panel || ! privacy || ! actions || ! button
						|| ! privacyDescription || ! footer ) {
						return null;
					}
					const style = getComputedStyle( panel );
					return {
						background: getComputedStyle( stage ).backgroundImage,
						panelRadius: parseFloat( style.borderTopLeftRadius ),
						panelBorder: parseFloat( style.borderTopWidth ),
						panelWidth: panel.getBoundingClientRect().width,
						privacyBorder: parseFloat( getComputedStyle( privacy ).borderTopWidth ),
						actionRight: actions.getBoundingClientRect().right,
						buttonRight: button.getBoundingClientRect().right,
						privacyFontSize: parseFloat( getComputedStyle( privacyDescription ).fontSize ),
						footerLeft: footer.getBoundingClientRect().left,
						footerBottom: footer.getBoundingClientRect().bottom,
					};
				} );
				expect( layout, 'The original onboarding shell has distinct setup and privacy surfaces.' ).not.toBeNull();
				expect( layout?.background ).toContain( 'radial-gradient' );
				expect( layout?.panelRadius ).toBeGreaterThanOrEqual( 24 );
				expect( layout?.panelBorder ).toBe( 1 );
				expect( layout?.panelWidth ).toBeGreaterThan( 880 );
				expect( layout?.panelWidth ).toBeLessThan( 980 );
				expect( layout?.privacyBorder ).toBe( 1 );
				expect( Math.abs( ( layout?.actionRight ?? 0 ) - ( layout?.buttonRight ?? 1 ) ) ).toBeLessThan( 1 );
				expect( layout?.privacyFontSize ).toBeCloseTo( 13.8, 1 );
				expect( layout?.footerLeft ).toBe( 96 );
				expect( layout?.footerBottom ).toBeLessThanOrEqual( 1000 );
			} finally {
				await page.close();
			}
		} );
		it( 'keeps the original four-column language choices and two-column narrow layout', async () => {
			const page = await browser.newPage( { viewport: { width: 1440, height: 1000 } } );
			try {
				await page.goto( `${ origin }apps/extension/tests/ui/index.html?surface=${ PresentationSurface.ONBOARDING }` );
				const labels = [ 'English', 'Espa\u00f1ol', 'Portugu\u00eas', 'Italiano' ] as const;
				await page.getByRole( 'radio', { name: labels[ 0 ], exact: true } ).waitFor();
				const desktop = await Promise.all( labels.map( ( label ) =>
					page.getByRole( 'radio', { name: label, exact: true } ).boundingBox() ) );
				for ( const box of desktop ) {
					expect( box?.y ).toBe( desktop[ 0 ]?.y );
					expect( box?.height ).toBeGreaterThanOrEqual( 84 );
				}
				const labelStyle = await page.getByText( 'English', { exact: true } ).evaluate( ( element ) => ( {
					family: getComputedStyle( element ).fontFamily,
					alignment: getComputedStyle( element ).textAlign,
				} ) );
				expect( labelStyle.family ).toContain( 'Fredoka' );
				expect( labelStyle.alignment ).toBe( 'center' );
				await page.setViewportSize( { width: 390, height: 844 } );
				const narrow = await Promise.all( labels.map( ( label ) =>
					page.getByRole( 'radio', { name: label, exact: true } ).boundingBox() ) );
				expect( narrow[ 0 ]?.y ).toBe( narrow[ 1 ]?.y );
				expect( narrow[ 2 ]?.y ).toBe( narrow[ 3 ]?.y );
				expect( narrow[ 2 ]?.y ).toBeGreaterThan( narrow[ 0 ]?.y ?? 0 );
			} finally {
				await page.close();
			}
		} );
		it( 'keeps completed step checks after keyboard back navigation and prevents unvisited skipping', async () => {
			const page = await browser.newPage();
			page.setDefaultTimeout( 5000 );
			try {
				await page.goto( `${ origin }apps/extension/tests/ui/index.html?surface=${ PresentationSurface.ONBOARDING }` );
				const websites = page.getByRole( 'button', { name: 'Websites', exact: true } );
				expect( await websites.isDisabled() ).toBe( true );
				await page.getByRole( 'button', { name: 'Continue', exact: true } ).click();
				await page.getByRole( 'heading', { name: 'Make TOCus yours' } ).waitFor();
				await page.getByRole( 'button', { name: 'Continue', exact: true } ).click();
				const language = page.getByRole( 'button', { name: 'Language', exact: true } );
				await language.focus();
				await page.keyboard.press( 'Enter' );
				await page.getByRole( 'heading', { name: 'Choose your language' } ).waitFor();
				await expect.poll( () => language.locator( 'svg' ).count() ).toBe( 1 );
				await expect.poll( () => page.getByRole( 'button', { name: 'Appearance', exact: true } ).locator( 'svg' ).count() ).toBe( 1 );
			} finally {
				await page.close();
			}
		} );
		it( 'announces the next onboarding heading without scrolling the setup page', async () => {
			const page = await browser.newPage( { viewport: { width: 1440, height: 300 }, reducedMotion: 'reduce' } );
			try {
				await page.goto( `${ origin }apps/extension/tests/ui/index.html?surface=${ PresentationSurface.ONBOARDING }` );
				const action = page.getByRole( 'button', { name: 'Continue', exact: true } );
				await action.waitFor();
				await action.evaluate( ( element ) => {
					element.focus( { preventScroll: true } );
				} );
				const previousScroll = await page.evaluate( () => {
					window.scrollTo( 0, 300 );
					return window.scrollY;
				} );
				expect( previousScroll ).toBeGreaterThan( 0 );
				await page.keyboard.press( 'Enter' );
				const heading = page.getByRole( 'heading', { name: 'Make TOCus yours' } );
				await expect.poll( () => heading.evaluate(
					( element ) => element === document.activeElement,
				) ).toBe( true );
				expect( await page.evaluate( () => window.scrollY ) ).toBe( previousScroll );
			} finally {
				await page.close();
			}
		} );
		it( 'retains editable preferences after rejected or unavailable saves and locks pending navigation', async () => {
			const page = await browser.newPage();
			page.setDefaultTimeout( 5000 );
			try {
				for ( const save of [ PreferenceSaveScenario.REJECT, PreferenceSaveScenario.NULL,
					PreferenceSaveScenario.MISSING_LANGUAGE, PreferenceSaveScenario.MISSING_EDITOR ] ) {
					await page.goto( `${ origin }apps/extension/tests/ui/index.html?surface=${ PresentationSurface.ONBOARDING }&save=${ save }` );
					await page.getByRole( 'button', { name: 'Continue', exact: true } ).click();
					await page.getByRole( 'alert' ).waitFor();
					expect( await page.getByRole( 'heading', { name: 'Choose your language' } ).isVisible() ).toBe( true );
					expect( await page.getByRole( 'button', { name: 'Continue', exact: true } ).isDisabled() ).toBe( false );
				}
				await page.goto( `${ origin }apps/extension/tests/ui/index.html?surface=${ PresentationSurface.ONBOARDING }&save=${ PreferenceSaveScenario.PENDING }` );
				await page.getByRole( 'button', { name: 'Continue', exact: true } ).click();
				expect( await page.getByRole( 'radio', { name: 'English', exact: true } ).isDisabled() ).toBe( true );
				expect( await page.getByRole( 'button', { name: 'Appearance', exact: true } ).isDisabled() ).toBe( true );
				await page.evaluate( ( event ) => document.dispatchEvent( new Event( event ) ),
					PresentationFixtureEvent.SETTLE_SAVE );
				await page.getByRole( 'heading', { name: 'Make TOCus yours' } ).waitFor();
			} finally {
				await page.close();
			}
		} );
		it( 'validates draft addresses, retains overlap errors and restores removed-row focus', async () => {
			const page = await browser.newPage();
			page.setDefaultTimeout( 5000 );
			try {
				await openSites( page );
				const address = page.getByRole( 'textbox' );
				const add = page.getByRole( 'button', { name: 'Add site', exact: true } );
				expect( await add.isDisabled() ).toBe( true );
				for ( const invalid of [ ' ', 'not a website', '*.example.com' ] ) {
					await address.fill( invalid );
					if ( invalid.trim() ) {
						await add.click(); await page.getByRole( 'alert' ).waitFor();
						expect( await address.getAttribute( 'aria-invalid' ) ).toBe( 'true' );
						const descriptions = await address.evaluate( ( element ) =>
							element.getAttribute( 'aria-describedby' )?.split( /\s+/ ).map(
								( id ) => document.getElementById( id )?.textContent,
							) ?? [] );
						expect( descriptions ).toContain( await page.getByRole( 'alert' ).textContent() );
						expect( descriptions ).toContain( await page.locator( '#onboarding-site-help' ).textContent() );
					} else {
						expect( await add.isDisabled() ).toBe( true );
					}
					expect( await address.inputValue() ).toBe( invalid );
				}
				for ( const input of [ 'example.com', 'github.com/team/' ] ) {
					await address.fill( input );
					await address.press( 'Enter' );
					await expect.poll( () => address.inputValue() ).toBe( '' );
					expect( await address.getAttribute( 'aria-invalid' ) ).toBe( 'false' );
				}
				expect( await page.getByRole( 'listitem' ).count() ).toBe( 2 );
				await address.fill( 'sub.example.com' );
				await add.click();
				await page.getByRole( 'alert' ).waitFor();
				expect( await address.getAttribute( 'aria-invalid' ) ).toBe( 'true' );
				expect( await address.inputValue() ).toBe( 'sub.example.com' );
				expect( await page.getByRole( 'listitem' ).count() ).toBe( 2 );
				const remove = page.locator( '.onboarding-remove' );
				await remove.first().focus();
				await page.keyboard.press( 'Enter' );
				await expect.poll( () => remove.count() ).toBe( 1 );
				await expect.poll( () => remove.first().evaluate(
					( element ) => element === document.activeElement,
				) ).toBe( true );
				await page.keyboard.press( 'Enter' );
				await expect.poll( () => address.evaluate(
					( element ) => element === document.activeElement,
				) ).toBe( true );
				expect( await page.getByTestId( 'requests' ).textContent() ).toBe( '0' );
			} finally {
				await page.close();
			}
		} );
		it( 'updates a pre-existing live region for successive website additions without moving focus', async () => {
			const page = await browser.newPage();
			try {
				await openSites( page );
				const status = page.locator( '.onboarding-sites-step [role="status"][aria-live="polite"]' );
				expect( await status.count() ).toBe( 1 );
				expect( await status.textContent() ).toBe( '' );
				const region = await status.elementHandle();
				for ( const name of [ 'YouTube', 'Instagram' ] ) {
					const suggestion = page.getByRole( 'button', { name, exact: true } );
					await suggestion.focus();
					await page.keyboard.press( 'Enter' );
					await expect.poll( () => status.textContent() ).toContain( name );
					expect( await region.evaluate( ( element ) => element.isConnected ) ).toBe( true );
					expect( await region.textContent() ).toContain( name );
					expect( await suggestion.evaluate(
						( element ) => element === document.activeElement,
					) ).toBe( true );
				}
			} finally {
				await page.close();
			}
		} );
		it( 'shows selected suggestions and preserves consent denial drafts for one explicit batch retry', async () => {
			const page = await browser.newPage();
			page.setDefaultTimeout( 5000 );
			try {
				await openSites( page );
				const youtube = page.getByRole( 'button', { name: 'YouTube', exact: true } );
				await youtube.click();
				expect( await youtube.getAttribute( 'aria-pressed' ) ).toBe( 'true' );
				expect( await page.getByRole( 'listitem' ).count() ).toBe( 1 );
				await page.getByRole( 'button', { name: 'Instagram', exact: true } ).click();
				expect( await page.getByTestId( 'requests' ).textContent() ).toBe( '0' );
				const finish = page.getByRole( 'button', { name: 'Finish setup', exact: true } );
				await finish.click();
				await page.getByRole( 'alert' ).waitFor();
				expect( await page.getByTestId( 'requests' ).getAttribute( 'data-activation' ) ).toBe( 'true' );
				expect( await page.getByRole( 'listitem' ).count() ).toBe( 2 );
				await finish.click();
				expect( await page.getByTestId( 'requests' ).textContent() ).toBe( '2' );
				await youtube.click();
				expect( await youtube.getAttribute( 'aria-pressed' ) ).toBe( 'false' );
			} finally {
				await page.close();
			}
		} );
		it( 'finishes empty setup without consent and contains a rejected browser operation', async () => {
			const page = await browser.newPage();
			page.setDefaultTimeout( 5000 );
			try {
				await openSites( page );
				await page.getByRole( 'button', { name: 'Finish setup', exact: true } ).click();
				await page.getByRole( 'button', { name: 'Open Settings', exact: true } ).waitFor();
				expect( await page.getByTestId( 'requests' ).textContent() ).toBe( '0' );
				await openSites( page, `batch=${ SiteBatchScenario.REJECT }` );
				await page.getByRole( 'button', { name: 'YouTube', exact: true } ).click();
				await page.getByRole( 'button', { name: 'Finish setup', exact: true } ).click();
				await page.getByRole( 'alert' ).waitFor();
				expect( await page.getByRole( 'listitem' ).count() ).toBe( 1 );
				expect( await page.getByRole( 'button', { name: 'Finish setup', exact: true } ).isDisabled() ).toBe( false );
			} finally {
				await page.close();
			}
		} );
		it( 'localizes Spanish and Portuguese variant controls immediately without a reload', async () => {
			const page = await browser.newPage();
			try {
				await page.goto( `${ origin }apps/extension/tests/ui/index.html?surface=${ PresentationSurface.ONBOARDING }` );
				await page.getByRole( 'radio', { name: 'Español', exact: true } ).click();
				await page.getByRole( 'heading', { name: 'Elige tu idioma' } ).waitFor();
				expect( await page.getByText( 'Which Spanish should TOCus use', { exact: false } ).count() ).toBe( 0 );
				await page.getByRole( 'radio', { name: 'Vos', exact: true } ).click();
				expect( await page.getByRole( 'radio', { name: 'Vos', exact: true } ).getAttribute( 'aria-checked' ) ).toBe( 'true' );
				await page.getByRole( 'radio', { name: 'Español', exact: true } ).click();
				expect( await page.getByRole( 'radio', { name: 'Vos', exact: true } ).getAttribute( 'aria-checked' ) ).toBe( 'true' );
				await page.getByRole( 'radio', { name: 'Português', exact: true } ).click();
				await page.getByRole( 'radio', { name: 'Brasil', exact: true } ).waitFor();
				await page.getByRole( 'radio', { name: 'Portugal', exact: true } ).click();
				expect( await page.getByRole( 'radio', { name: 'Portugal', exact: true } ).getAttribute( 'aria-checked' ) ).toBe( 'true' );
			} finally {
				await page.close();
			}
		} );
		for ( const [ language, variant ] of [
			[ Language.PORTUGUESE_BRAZIL, 'Brasil' ],
			[ Language.PORTUGUESE_PORTUGAL, 'Portugal' ],
		] as const ) {
			it( `preserves restored progress and privacy surfaces through the ${ language } regional flow`, async () => {
				const page = await browser.newPage( { viewport: { width: 1440, height: 1000 } } );
				try {
					await page.goto( `${ origin }apps/extension/tests/ui/index.html?surface=${ PresentationSurface.ONBOARDING }` );
					await page.getByRole( 'radio', { name: 'Português', exact: true } ).click();
					await page.getByRole( 'radio', { name: variant, exact: true } ).click();
					await page.locator( '.tocus-preferences-actions button[type="submit"]' ).click();
					await page.locator( '.preferences-theme-card' ).first().waitFor();
					await page.locator( '.tocus-preferences-actions button[type="submit"]' ).click();
					await page.locator( '.manual-control input' ).waitFor();
					const steps = await page.locator( '.onboarding-progress-step' ).evaluateAll( ( elements ) =>
						elements.map( ( element ) => {
							const icon = element.querySelector( '.onboarding-progress-icon' );
							const label = element.querySelector( '.onboarding-progress-label' );
							if ( ! icon || ! label ) {
								throw new Error( 'Each restored step requires a visible icon and label.' );
							}
							const iconBox = icon.getBoundingClientRect();
							const labelBox = label.getBoundingClientRect();
							const underline = getComputedStyle( element, '::after' );
							return {
								labelLeft: labelBox.left, iconRight: iconBox.right,
								centerDifference: Math.abs(
									labelBox.y + labelBox.height / 2 - iconBox.y - iconBox.height / 2 ),
								underlineContent: underline.content, underlineBottom: underline.bottom,
								underlineHeight: parseFloat( underline.height ),
								underlineWidth: parseFloat( underline.width ),
								stepWidth: element.getBoundingClientRect().width,
							};
						} ) );
					expect( steps ).toHaveLength( 3 );
					for ( const step of steps ) {
						expect( step.labelLeft ).toBeGreaterThan( step.iconRight );
						expect( step.centerDifference ).toBeLessThan( 1 );
						expect( step.underlineContent ).toBe( '""' );
						expect( step.underlineBottom ).toBe( '0px' );
						expect( step.underlineHeight ).toBeGreaterThanOrEqual( 3 );
						expect( Math.abs( step.underlineWidth - step.stepWidth ) ).toBeLessThan( 1 );
					}
					const separators = await page.locator( '.onboarding-progress-separator' ).evaluateAll( ( elements ) =>
						elements.map( ( element ) => getComputedStyle( element ).display ) );
					expect( separators.every( ( display ) => display === 'none' ) ).toBe( true );
					await expect.poll( () => page.locator(
						'.onboarding-progress-step[data-completed-step] .tocus-icon svg',
					).count() ).toBe( 2 );
					const privacy = await page.locator( '.onboarding-privacy' ).evaluate( ( element ) => {
						const style = getComputedStyle( element );
						return {
							borderWidth: parseFloat( style.borderTopWidth ), borderStyle: style.borderTopStyle,
							borderColor: style.borderTopColor, background: style.backgroundColor,
							radius: parseFloat( style.borderTopLeftRadius ), opacity: style.opacity,
						};
					} );
					expect( privacy.borderWidth ).toBe( 1 );
					expect( privacy.borderStyle ).toBe( 'solid' );
					expect( privacy.borderColor ).not.toMatch( /transparent|rgba\(0, 0, 0, 0\)/ );
					expect( privacy.background ).not.toMatch( /transparent|rgba\(0, 0, 0, 0\)/ );
					expect( privacy.radius ).toBeGreaterThanOrEqual( 16 );
					expect( privacy.opacity ).toBe( '1' );
					const userLock = readFileSync( new URL(
						`../../../../packages/theme/assets/icons/${ IconName.USER_LOCK }.svg`, import.meta.url,
					), 'utf8' );
					/** Checks rendered artwork against the independent supplied SVG asset. */
					const correctPrivacyIcon = await page.locator( '.onboarding-privacy .tocus-icon svg' ).evaluate(
						( element, source ) => {
							const expected = new DOMParser().parseFromString( source, 'image/svg+xml' );
							/**
							 * Reads the actual vector paths independently of serialization whitespace.
							 * @param root - Parsed expected asset or rendered icon.
							 * @return Ordered path geometry.
							 */
							const paths = ( root: ParentNode ) => Array.from( root.querySelectorAll( 'path' ),
								( path ) => path.getAttribute( 'd' ) );
							return JSON.stringify( paths( element ) ) === JSON.stringify( paths( expected ) );
						}, userLock,
					);
					expect( correctPrivacyIcon, 'The privacy surface retains the supplied person-and-lock artwork.' ).toBe( true );
					await page.getByRole( 'button', { name: 'Idioma', exact: true } ).click();
					await expect.poll( () => page.getByRole( 'radio', { name: variant, exact: true } )
						.getAttribute( 'aria-checked' ) ).toBe( 'true' );
				} finally {
					await page.close();
				}
			} );
		}
		it( 'retains a pending removed row and does not steal focus after the user moves away', async () => {
			const page = await browser.newPage();
			page.setDefaultTimeout( 5000 );
			try {
				await openSites( page, `persisted=1&remove=${ SiteRemovalScenario.PENDING }` );
				await page.getByRole( 'button', { name: 'Remove site: GitHub', exact: true } ).click();
				expect( await page.getByRole( 'listitem' ).count() ).toBe( 2 );
				await page.getByRole( 'heading', { name: 'Choose websites', exact: true } ).focus();
				await page.evaluate( ( event ) => document.dispatchEvent( new Event( event ) ),
					PresentationFixtureEvent.SETTLE_REMOVE );
				await expect.poll( () => page.getByRole( 'listitem' ).count() ).toBe( 1 );
				expect( await page.getByRole( 'heading', { name: 'Choose websites', exact: true } ).evaluate( ( element ) => element === document.activeElement ) ).toBe( true );
			} finally {
				await page.close();
			}
		} );
		it( 'keeps the floating preview clear of scrolled controls at narrow and landscape sizes', async () => {
			const page = await browser.newPage( { colorScheme: 'dark' } );
			try {
				for ( const viewport of [ { width: 390, height: 844 }, { width: 844, height: 390 } ] ) {
					await page.setViewportSize( viewport );
					await page.goto( `${ origin }apps/extension/tests/ui/index.html?surface=${ PresentationSurface.ONBOARDING }` );
					await page.getByRole( 'button', { name: 'Continue', exact: true } ).click();
					const preview = page.locator( '.onboarding-preview' );
					await preview.waitFor();
					expect( await page.locator( '.onboarding-progress-label' ).evaluateAll( ( labels ) => labels.every(
						( label ) => {
							const fontSize = Number.parseFloat( getComputedStyle( label ).fontSize );
							return label.getBoundingClientRect().height <= fontSize * 1.5;
						},
					) ) ).toBe( true );
					// Offscreen form content is clipped by its own scrollport, not painted beneath the preview.
					const scrollport = page.locator( '.onboarding-layout' );
					const initialChoice = await scrollport.boundingBox();
					expect( await scrollport.evaluate( ( element ) => getComputedStyle( element ).overflowY ) ).toBe( 'auto' );
					const initialPreview = await preview.boundingBox();
					if ( ! initialChoice || ! initialPreview ) {
						throw new Error( 'Missing initial appearance bounds.' );
					}
					expect( initialChoice.y ).toBeGreaterThanOrEqual( 0 );
					expect( initialChoice.y + initialChoice.height <= initialPreview.y
						|| initialChoice.x >= initialPreview.x + initialPreview.width ).toBe( true );
					for ( const name of [ 'Light', 'Dark', 'System' ] ) {
						await page.getByRole( 'radio', { name, exact: true } ).scrollIntoViewIfNeeded();
						const control = await page.getByRole( 'radio', { name, exact: true } ).boundingBox();
						const bounds = await preview.boundingBox();
						if ( ! control || ! bounds ) {
							throw new Error( 'Missing layout bounds.' );
						}
						const abovePreview = control.y + control.height <= bounds.y;
						const besidePreview = control.x >= bounds.x + bounds.width;
						expect( abovePreview || besidePreview ).toBe( true );
					}
					await page.getByRole( 'button', { name: 'Continue', exact: true } ).scrollIntoViewIfNeeded();
					expect( await preview.evaluate( ( element ) => getComputedStyle( element ).position ) ).toBe( 'fixed' );
					const bottomInset = await preview.evaluate(
						( element ) => Math.round( innerHeight - element.getBoundingClientRect().bottom ),
					);
					expect( bottomInset ).toBe( 16 );
				}
			} finally {
				await page.close();
			}
		} );
		it( 'preserves onboarding drafts during back navigation and batches access only at Finish', async () => {
			const page = await browser.newPage( { viewport: { width: 1440, height: 1000 } } );
			try {
				await page.goto( `${ origin }apps/extension/tests/ui/index.html?surface=${ PresentationSurface.ONBOARDING }` );
				await page.getByRole( 'heading', { name: 'Choose your language' } ).waitFor( { timeout: 4000 } );
				await page.getByRole( 'button', { name: 'Continue', exact: true } ).click();
				await page.getByRole( 'heading', { name: 'Make TOCus yours' } ).waitFor();
				await page.getByRole( 'button', { name: 'Continue', exact: true } ).click();
				await page.getByRole( 'textbox' ).fill( 'github.com' );
				await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
				await page.getByRole( 'listitem' ).filter( { hasText: 'github.com' } ).waitFor();
				expect( await page.getByTestId( 'requests' ).textContent() ).toBe( '0' );
				await page.getByRole( 'button', { name: 'Language', exact: true } ).click();
				await page.getByRole( 'button', { name: 'Continue', exact: true } ).click();
				await page.getByRole( 'button', { name: 'Continue', exact: true } ).click();
				await page.getByRole( 'listitem' ).filter( { hasText: 'github.com' } ).waitFor();
				await page.getByRole( 'button', { name: 'Finish setup', exact: true } ).click();
				await page.getByTestId( 'requests' ).filter( { hasText: '1' } ).waitFor();
			} finally {
				await page.close();
			}
		} );
		it( 'keeps popup enrollment synchronous, compact and clearly actionable', async () => {
			const page = await browser.newPage( { viewport: { width: 352, height: 700 } } );
			try {
				await page.goto( `${ origin }apps/extension/tests/ui/index.html?surface=${ PresentationSurface.POPUP }` );
				const action = page.getByRole( 'button', { name: 'Pause site', exact: true } );
				await action.waitFor( { timeout: 4000 } );
				await action.focus();
				await page.keyboard.press( 'Space' );
				await page.getByTestId( 'requests' ).filter( { hasText: '1' } ).waitFor();
				expect( await page.getByRole( 'button', { name: 'Adding', exact: false } ).isDisabled() ).toBe( true );
				expect( await page.getByRole( 'link', { name: 'Settings', exact: true } ).getAttribute( 'href' ) ).toContain( 'options.html' );
				expect( await page.getByRole( 'link', { name: 'Statistics', exact: true } ).getAttribute( 'href' ) ).toContain( '#statistics' );
				expect( await page.evaluate( () => document.documentElement.scrollWidth <= innerWidth ) ).toBe( true );
			} finally {
				await page.close();
			}
		} );
	} );
}
