import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import { chromium, firefox, webkit, type Browser } from 'playwright';
import { createLocalizationViteConfig } from '../../../../../config/vite/services/create-localization-vite-config';
import type {} from './__fixtures__/browser-types';

let server: ViteDevServer;
let origin: string;
beforeAll( async () => {
	server = await createServer( { configFile: false, root: process.cwd(),
		plugins: createLocalizationViteConfig().plugins,
		server: { host: '127.0.0.1', port: 0, watch: null, hmr: false }, logLevel: 'error',
		optimizeDeps: { entries: [ 'apps/extension/src/features/interruption/components/screen/__fixtures__/browser.html' ] } } );
	await server.listen();
	const address = server.resolvedUrls?.local[ 0 ];
	if ( ! address ) {
		throw new Error( 'The pause fixture server did not expose a URL.' );
	}
	origin = `${ address }apps/extension/src/features/interruption/components/screen/__fixtures__/browser.html`;
} );
afterAll( async () => {
	await server.close();
} );

for ( const [ name, engine ] of Object.entries( { chromium, firefox, webkit } ) ) {
	describe( `${ name } React pause`, () => {
		let browser: Browser;
		beforeAll( async () => {
			browser = await engine.launch();
		} );
		afterAll( async () => {
			await browser.close();
		} );
		it( 'uses the shared packaged control and preserves focused progress and real Space', async () => {
			const page = await browser.newPage();
			try {
				await page.goto( origin );
				await page.locator( 'html[data-ready]' ).waitFor();
				await page.evaluate( async () => {
					window.pauseFixture.environment.advance( 2000 );
					await window.pauseFixture.screen.updateComplete;
				} );
				expect( await page.locator( '.remaining' ).textContent() ).toBe( '8s remaining' );
				await page.evaluate( async () => {
					window.pauseFixture.environment.setWindowFocused( false );
					window.pauseFixture.environment.advance( 5000 );
					await window.pauseFixture.screen.updateComplete;
				} );
				expect( await page.evaluate( () =>
					window.pauseFixture.screen.getFocusedProgressMilliseconds() ) ).toBe( 2000 );
				await page.evaluate( async () => {
					window.pauseFixture.screen.state = window.pauseFixture.states.READY;
					await window.pauseFixture.screen.updateComplete;
				} );
				const button = page.getByRole( 'button', { name: 'Continue', exact: true } );
				expect( await button.getAttribute( 'class' ) ).toContain( 'mantine-Button-root' );
				await page.keyboard.press( 'Space' );
				expect( await page.evaluate( () => window.pauseFixture.continues ) ).toBe( 1 );
			} finally {
				await page.close();
			}
		} );
		it( 'retains recovery announcements, focus and discrete reduced-motion progress', async () => {
			const page = await browser.newPage();
			try {
				await page.goto( origin );
				await page.locator( 'html[data-ready]' ).waitFor();
				await page.evaluate( async () => {
					const { screen } = window.pauseFixture;
					screen.reducedMotion = true;
					await screen.updateComplete;
				} );
				expect( await page.evaluate( () => [ window.pauseFixture.environment.getFrameCount(),
					window.pauseFixture.environment.getTimerCount() ] ) ).toEqual( [ 0, 1 ] );
				await page.evaluate( async () => {
					window.pauseFixture.screen.state = window.pauseFixture.states.UNAVAILABLE;
					await window.pauseFixture.screen.updateComplete;
				} );
				const retry = page.locator( '.retry-button' );
				expect( await retry.evaluate( ( button ) =>
					button === window.pauseFixture.screen.shadowRoot?.activeElement ) ).toBe( true );
				await page.keyboard.press( 'Enter' );
				expect( await page.evaluate( () => window.pauseFixture.retries ) ).toBe( 1 );
				await page.evaluate( async () => {
					window.pauseFixture.screen.recovering = true;
					await window.pauseFixture.screen.updateComplete;
				} );
				expect( await retry.isDisabled() ).toBe( true );
				expect( await page.locator( '[aria-live]' ).textContent() ).toBe( 'Trying to restore your pause.' );
				expect( await page.locator( '.scene' ).evaluate( ( scene ) => scene === window.pauseFixture.screen.shadowRoot?.activeElement ) ).toBe( true );
				await page.evaluate( async () => {
					window.pauseFixture.screen.recovering = false;
					await window.pauseFixture.screen.updateComplete;
				} );
				expect( await page.locator( '[aria-live]' ).textContent() ).toBe( 'TOCus still could not restore this pause.' );
				expect( await retry.evaluate( ( button ) =>
					button === window.pauseFixture.screen.shadowRoot?.activeElement ) ).toBe( true );
				await page.evaluate( async () => {
					window.pauseFixture.screen.state = window.pauseFixture.states.WAITING;
					await window.pauseFixture.screen.updateComplete;
				} );
				expect( await page.locator( '.scene' ).evaluate( ( scene ) => scene === window.pauseFixture.screen.shadowRoot?.activeElement ) ).toBe( true );
			} finally {
				await page.close();
			}
		} );
		it( 'repairs native closure and guarded removal while preserving the controlled screen', async () => {
			const page = await browser.newPage();
			try {
				await page.goto( `${ origin }?injected&csp` );
				await page.locator( 'html[data-ready]' ).waitFor();
				const result = await page.evaluate( async () => {
					const { layer, screen } = window.pauseFixture;
					if ( ! layer ) {
						throw new Error( 'Missing injected layer.' );
					}
					const root = screen.getRootNode();
					if ( ! ( root instanceof ShadowRoot ) ) {
						throw new Error( 'Missing closed root.' );
					}
					const dialog = root.querySelector( 'dialog' );
					if ( ! dialog ) {
						throw new Error( 'Missing native dialog.' );
					}
					screen.progressing = true;
					await screen.updateComplete;
					const closed = new Promise<void>( ( resolve ) => {
						dialog.addEventListener( 'close', () => {
							resolve();
						}, { once: true } );
					} );
					dialog.close();
					await closed;
					const repaired = dialog.open && ! screen.progressing;
					layer.connectionGuardEnabled = true;
					screen.progressing = true;
					layer.remove();
					await Promise.resolve();
					await layer.updateComplete;
					const reconnected = layer.isConnected && dialog.open && ! screen.progressing;
					const sameScreen = layer.getInterruptionScreen() === screen;
					layer.connectionGuardEnabled = false;
					return { repaired, reconnected, sameScreen };
				} );
				expect( result ).toEqual( { repaired: true, reconnected: true, sameScreen: true } );
			} finally {
				await page.close();
			}
		} );
		it( 'keeps canvas artwork live, previews contained and detached clocks stopped', async () => {
			const page = await browser.newPage();
			try {
				await page.goto( origin );
				await page.locator( 'html[data-ready]' ).waitFor();
				const canvas = page.locator( 'canvas' );
				expect( await canvas.evaluate( ( element: HTMLCanvasElement ) => {
					const pixels = element.getContext( '2d' )?.getImageData( 0, 0, element.width, element.height ).data;
					return pixels?.some( ( value, index ) => index % 4 === 3 && value > 0 );
				} ) ).toBe( true );
				const initial = await canvas.evaluate( ( element: HTMLCanvasElement ) => element.toDataURL() );
				await page.evaluate( async () => {
					window.pauseFixture.environment.advance( 2000 );
					await window.pauseFixture.screen.updateComplete;
				} );
				expect( await canvas.evaluate( ( element: HTMLCanvasElement ) =>
					element.toDataURL() ) ).not.toBe( initial );
				await page.evaluate( async () => {
					const { screen } = window.pauseFixture;
					const container = document.createElement( 'div' );
					container.style.cssText = 'position:relative;width:384px;height:240px';
					document.body.append( container );
					screen.preview = true;
					container.append( screen );
					await screen.updateComplete;
				} );
				expect( await page.locator( '.scene' ).evaluate( ( element ) => element.getBoundingClientRect().height ) ).toBe( 240 );
				expect( await page.locator( '.cue' ).evaluate( ( element ) =>
					parseFloat( getComputedStyle( element ).fontSize ) ) ).toBeCloseTo( 16.56, 1 );
				await page.evaluate( async () => {
					const { screen, environment } = window.pauseFixture;
					environment.advance( 10000 );
					await screen.updateComplete;
					screen.remove();
				} );
				expect( await page.evaluate( () => [ window.pauseFixture.environment.getFrameCount(),
					window.pauseFixture.environment.getTimerCount() ] ) ).toEqual( [ 0, 0 ] );
			} finally {
				await page.close();
			}
		} );
		it( 'keeps long localized recovery labels reachable in a short narrow viewport', async () => {
			const page = await browser.newPage( { viewport: { width: 320, height: 320 } } );
			try {
				await page.goto( origin );
				await page.locator( 'html[data-ready]' ).waitFor();
				await page.evaluate( async () => {
					const { screen } = window.pauseFixture;
					screen.copy = { ...screen.copy, retryLabel: 'Versuche es bitte noch einmal ganz in Ruhe',
						unavailableTitle: 'Lass es uns noch einmal ganz in Ruhe versuchen' };
					screen.state = window.pauseFixture.states.UNAVAILABLE;
					await screen.updateComplete;
				} );
				expect( await page.locator( '.mantine-Button-label' ).evaluate( ( label ) =>
					label.scrollWidth <= label.clientWidth ) ).toBe( true );
				expect( await page.locator( '.scene' ).evaluate( ( scene ) => scene.scrollWidth <= scene.clientWidth ) ).toBe( true );
				await page.locator( '.retry-button' ).click();
				expect( await page.evaluate( () => window.pauseFixture.retries ) ).toBe( 1 );
			} finally {
				await page.close();
			}
		} );
		it( 'retains six-palette contrast, live appearance and owned styles under strict CSP', async () => {
			const page = await browser.newPage();
			try {
				await page.goto( `${ origin }?injected&csp` );
				await page.locator( 'html[data-ready]' ).waitFor();
				const results = await page.evaluate( async () => {
					const { screen, layer } = window.pauseFixture;
					if ( ! layer ) {
						throw new Error( 'Missing injected layer.' );
					}
					const values: number[] = [];
					const backgrounds: string[] = [];
					for ( const theme of [ window.pauseFixture.themes.LIGHT, window.pauseFixture.themes.DARK ] ) {
						for ( const palette of Object.values( window.pauseFixture.palettes ) ) {
							layer.setAttribute( 'data-tocus-theme', theme );
							layer.setAttribute( 'data-tocus-palette', palette );
							await Promise.resolve();
							const states = [ window.pauseFixture.states.READY, window.pauseFixture.states.UNAVAILABLE ];
							for ( const state of states ) {
								screen.state = state;
								await screen.updateComplete;
								const button = screen.shadowRoot?.querySelector( 'button' );
								if ( ! button ) {
									throw new Error( 'Missing packaged pause action.' );
								}
								const style = getComputedStyle( button );
								backgrounds.push( style.backgroundColor );
								const luminances = [ style.color, style.backgroundColor ].map( ( color ) => {
									const rgb = color.match( /[\d.]+/g )?.slice( 0, 3 ).map( Number ) ?? [];
									return rgb.reduce( ( total, channel, index ) => {
										const value = channel / 255;
										const linear = value <= 0.04045 ? value / 12.92
											: ( ( value + 0.055 ) / 1.055 ) ** 2.4;
										return total + linear * ( [ 0.2126, 0.7152, 0.0722 ][ index ] ?? 0 );
									}, 0 );
								} );
								values.push( ( Math.max( ...luminances ) + 0.05 ) /
									( Math.min( ...luminances ) + 0.05 ) );
							}
						}
					}
					return { values, backgrounds, adopted: screen.shadowRoot?.adoptedStyleSheets.length,
						variablesInStyleTags: screen.shadowRoot?.querySelectorAll( '[data-mantine-styles]' ).length };
				} );
				expect( results.values ).toHaveLength( 24 );
				expect( Math.min( ...results.values ) ).toBeGreaterThanOrEqual( 4.5 );
				expect( new Set( results.backgrounds ).size ).toBe( 12 );
				expect( results.adopted ).toBe( 2 );
				expect( results.variablesInStyleTags ).toBe( 0 );
				await page.evaluate( async () => {
					const root = window.pauseFixture.screen.getRootNode();
					if ( root instanceof ShadowRoot ) {
						await Promise.all( root.querySelector( 'dialog' )?.getAnimations().map( ( animation ) => animation.finished ) ?? [] );
					}
				} );
			} finally {
				await page.close();
			}
		} );
		it( 'retains control sizing after responsive and stylesheet-driven host font changes', async () => {
			const page = await browser.newPage( { viewport: { width: 800, height: 600 } } );
			try {
				await page.goto( `${ origin }?injected&csp&responsive` );
				await page.locator( 'html[data-ready]' ).waitFor();
				await page.evaluate( async () => {
					window.pauseFixture.screen.state = window.pauseFixture.states.READY;
					await window.pauseFixture.screen.updateComplete;
				} );
				/** @return Computed size of the closed-boundary Continue control. */
				const readFont = () => page.evaluate( () => {
					const button = window.pauseFixture.screen.shadowRoot?.querySelector( 'button' );
					if ( ! button ) {
						throw new Error( 'Missing injected Continue button.' );
					}
					return parseFloat( getComputedStyle( button ).fontSize );
				} );
				expect( await readFont() ).toBeCloseTo( 16.1, 1 );
				await page.setViewportSize( { width: 1000, height: 600 } );
				expect( await page.evaluate( () => getComputedStyle( document.documentElement ).fontSize ) ).toBe( '20px' );
				await expect.poll( readFont, { timeout: 3000 } ).toBeCloseTo( 16.1, 1 );
				await page.evaluate( () => {
					const sheet = new CSSStyleSheet();
					sheet.replaceSync( 'html {font-size:10px!important}' );
					document.adoptedStyleSheets = [ ...document.adoptedStyleSheets, sheet ];
				} );
				expect( await page.evaluate( () => getComputedStyle( document.documentElement ).fontSize ) ).toBe( '10px' );
				await expect.poll( readFont, { timeout: 3000 } ).toBeCloseTo( 16.1, 1 );
			} finally {
				await page.close();
			}
		} );
		for ( const csp of [ false, true ] ) {
			it( `isolates native dialog, packaged styles and real keyboard behavior with CSP ${ String( csp ) }`, async () => {
				const page = await browser.newPage( { viewport: { width: 800, height: 600 } } );
				try {
					await page.goto( `${ origin }?injected${ csp ? '&csp' : '' }` );
					await page.locator( 'html[data-ready]' ).waitFor();
					expect( await page.evaluate( () => window.pauseFixture.layer?.shadowRoot ) ).toBe( null );
					expect( await page.evaluate( () =>
						window.pauseFixture.layer?.isInterruptionPresentationVisible() ) ).toBe( true );
					await page.keyboard.press( 'Escape' );
					expect( await page.evaluate( () =>
						window.pauseFixture.layer?.isInterruptionPresentationVisible() ) ).toBe( true );
					await page.evaluate( async () => {
						window.pauseFixture.screen.state = window.pauseFixture.states.READY;
						await window.pauseFixture.screen.updateComplete;
					} );
					const styles = await page.evaluate( () => {
						const button = window.pauseFixture.screen.shadowRoot?.querySelector( 'button' );
						if ( ! button ) {
							throw new Error( 'Missing injected Continue button.' );
						}
						const computed = getComputedStyle( button );
						const scene = window.pauseFixture.screen.shadowRoot?.querySelector( '.scene' );
						return { font: parseFloat( computed.fontSize ), color: computed.color,
							background: computed.backgroundColor, width: scene?.getBoundingClientRect().width,
							classes: button.className };
					} );
					expect( styles.classes ).toContain( 'mantine-Button-root' );
					expect( styles.font ).toBeCloseTo( 16.1, 1 );
					expect( styles.color ).not.toBe( 'rgb(255, 0, 0)' );
					expect( styles.background ).not.toBe( 'rgba(0, 0, 0, 0)' );
					expect( styles.width ).toBe( 800 );
					await page.keyboard.press( 'Space' );
					expect( await page.evaluate( () => window.pauseFixture.continues ) ).toBe( 1 );
					await page.evaluate( async () => {
						const { layer } = window.pauseFixture;
						if ( ! layer ) {
							throw new Error( 'Missing injected layer.' );
						}
						layer.interruptionLayerPresented = false;
						await layer.updateComplete;
					} );
					expect( await page.locator( '#website' ).evaluate( ( element ) => document.activeElement === element ) ).toBe( true );
					await page.keyboard.press( 'Space' );
					expect( await page.evaluate( () => window.pauseFixture.continues ) ).toBe( 1 );
				} finally {
					await page.close();
				}
			} );
		}
	} );
}
