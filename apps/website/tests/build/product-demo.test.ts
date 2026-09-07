import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';
import { describe, expect, test } from 'vitest';
import { DemoChapter } from '../../src/components/product-demo/types';

const WebsiteOutput = new URL( '../../dist/', import.meta.url );

describe( 'the product story', () => {
	for ( const engine of [ chromium, firefox, webkit ] ) {
		for ( const viewport of [
			{ width: 1280, height: 720 }, { width: 1440, height: 600 },
			{ width: 900, height: 400 }, { width: 360, height: 800 },
		] ) {
			test( `${ engine.name() } ${ String( viewport.width ) }: keyboard readers can inspect every step with reduced motion`, async () => {
				const browser = await engine.launch();
				const context = await browser.newContext( {
					viewport, reducedMotion: 'reduce',
				} );
				const externalRequests: string[] = [];
				await context.route( '**/*', async ( route ) => {
					const url = new URL( route.request().url() );
					if ( url.origin !== 'http://website.test' ) {
						externalRequests.push( url.href );
						await route.abort();
						return;
					}
					const path = url.pathname.endsWith( '/' ) ? `${ url.pathname }index.html` : url.pathname;
					await route.fulfill( { path: fileURLToPath( new URL( `.${ path }`, WebsiteOutput ) ) } );
				} );
				try {
					const page = await context.newPage();
					await page.goto( 'http://website.test/' );
					const demo = page.locator( '.product-demo' );
					expect( await page.locator( '[data-story-chapter]' ).count() ).toBe( 5 );
					await expect.poll( () => page.locator( '[data-story-chapter][data-current]' ).count() ).toBe( 5 );
					for ( const chapter of Object.values( DemoChapter ) ) {
						const button = page.locator( `[data-story-chapter="${ chapter }"] button` );
						await button.focus();
						await page.keyboard.press( 'Enter' );
						await expect.poll( () => demo.getAttribute( 'data-scene' ) ).toBe( chapter );
						expect( await button.getAttribute( 'aria-current' ) ).toBe( 'step' );
						expect( await demo.isVisible() ).toBe( true );
						const bounds = await demo.locator( '.product-demo-browser' ).boundingBox();
						if ( ! bounds ) {
							throw new Error( 'The current chapter must have a visible browser illustration.' );
						}
						expect( bounds.y ).toBeGreaterThanOrEqual( 0 );
						expect( bounds.y + bounds.height ).toBeLessThanOrEqual( viewport.height );
						if ( chapter === DemoChapter.CHOOSE ) {
							expect( await demo.locator( '.product-demo-site-option' ).count() ).toBe( 6 );
							expect( await demo.locator( '.product-demo-site-option[data-selected="true"]' ).count() ).toBeGreaterThan( 0 );
							for ( const name of [ 'YouTube', 'Instagram', 'Reddit' ] ) {
								expect( await demo.getByText( name, { exact: true } ).isVisible() ).toBe( true );
							}
						}
						if ( chapter === DemoChapter.VISIT || chapter === DemoChapter.BROWSE ) {
							expect( await demo.locator( '.product-demo-address' ).innerText() ).toBe( 'youtube.com' );
							expect( await demo.locator( '.product-demo-youtube' ).isVisible() ).toBe( true );
						}
						if ( chapter === DemoChapter.PAUSE ) {
							const canvas = demo.locator( 'canvas' );
							expect( await canvas.getAttribute( 'data-still' ) ).toBe( 'true' );
							await expect.poll( () => canvas.evaluate( ( element ) =>
								( element as HTMLCanvasElement ).width,
							) ).not.toBe( 300 );
							const frame = await canvas.evaluate( ( element ) =>
								( element as HTMLCanvasElement ).toDataURL(),
							);
							await page.waitForTimeout( 160 );
							expect( await canvas.evaluate( ( element ) =>
								( element as HTMLCanvasElement ).toDataURL(),
							) ).toBe( frame );
							expect( await demo.locator( '.product-demo-continue' ).isEnabled() ).toBe( false );
						}
						if ( chapter === DemoChapter.CONTINUE ) {
							expect( await demo.locator( '.product-demo-ready' ).isVisible() ).toBe( true );
							expect( await demo.locator( '.product-demo-continue' ).innerText() ).toBe( 'Continue' );
							await demo.locator( '.product-demo-continue' ).focus();
							await page.keyboard.press( 'Space' );
							await expect.poll( () => demo.getAttribute( 'data-scene' ) ).toBe( DemoChapter.BROWSE );
							const browseButton = page.locator( `[data-story-chapter="${ DemoChapter.BROWSE }"] button` );
							expect( await browseButton.evaluate( ( element ) =>
								element === document.activeElement,
							) ).toBe( true );
							// macOS WebKit uses Option+Tab to include links in keyboard navigation.
							const nextControlKey = process.platform === 'darwin' && engine.name() === 'webkit'
								? 'Alt+Tab' : 'Tab';
							await page.keyboard.press( nextControlKey );
							expect( await page.locator( '#privacy a' ).evaluate( ( element ) =>
								element === document.activeElement,
							) ).toBe( true );
						}
						if ( chapter === DemoChapter.BROWSE ) {
							expect( await demo.locator( '.product-demo-time-left time' ).innerText() ).toBe( '5:00' );
						}
					}
					expect( await demo.getByRole( 'button', { name: /start|replay|next pause/i } ).count() ).toBe( 0 );
					expect( await page.evaluate( () => ( {
						local: localStorage.length, session: sessionStorage.length,
					} ) ) ).toEqual( { local: 0, session: 0 } );
					expect( externalRequests ).toEqual( [] );
				} finally {
					await browser.close();
				}
			}, 30_000 );
		}
	}
} );
