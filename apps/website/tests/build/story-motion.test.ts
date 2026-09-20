import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { DemoChapter } from '../../src/components/product-demo/types';

const WebsiteOutput = new URL( '../../dist/', import.meta.url );

for ( const engine of [ 'chromium', 'firefox', 'webkit' ] as const ) {
	const engineTest = test.extend( { browserName: engine } );
	for ( const viewport of [ { width: 1280, height: 720 }, { width: 360, height: 800 } ] ) {
		engineTest( `${ engine } ${ String( viewport.width ) }: reduced-motion chapter selection retains focus and never scrubs on scroll`, async ( { context, page } ) => {
			await page.setViewportSize( viewport );
			await page.emulateMedia( { reducedMotion: 'reduce' } );
			await context.route( '**/*', async ( route ) => {
				const url = new URL( route.request().url() );
				if ( url.origin !== 'http://website.test' ) {
					await route.abort();
					return;
				}
				const path = url.pathname.endsWith( '/' ) ? `${ url.pathname }index.html` : url.pathname;
				await route.fulfill( { path: fileURLToPath( new URL( `.${ path }`, WebsiteOutput ) ) } );
			} );
			await page.goto( 'http://website.test/' );
			await expect( page.locator( '.homepage' ) ).toHaveAttribute( 'data-enhanced', 'true' );
			const demo = page.locator( '.product-demo' );
			await expect( page.locator( '.how-it-works' ) ).toHaveAttribute( 'data-playing', 'false' );
			for ( const chapter of [ DemoChapter.PAUSE, DemoChapter.BROWSE, DemoChapter.CONTINUE,
				DemoChapter.VISIT, DemoChapter.CHOOSE ] ) {
				const button = page.locator( `[data-story-chapter="${ chapter }"] button` );
				await button.scrollIntoViewIfNeeded();
				await button.focus();
				const before = await page.evaluate( () => window.scrollY );
				await button.press( chapter === DemoChapter.BROWSE ? 'Space' : 'Enter' );
				await expect( demo ).toHaveAttribute( 'data-scene', chapter );
				await expect( button ).toBeFocused();
				await expect( page.locator( '[aria-current="step"]' ) ).toHaveCount( 1 );
				await expect( page.locator( '.story-caption[aria-hidden="false"]' ) ).toHaveAttribute( 'data-caption-chapter', chapter );
				expect( await page.evaluate( () => window.scrollY ) ).toBe( before );
				await page.mouse.wheel( 0, 100 );
				await expect( demo ).toHaveAttribute( 'data-scene', chapter );
			}
			await expect( page.locator( '.experience-stage' ) ).toHaveCSS( 'position', 'static' );
			expect( await page.locator( '.pin-spacer' ).count() ).toBe( 0 );
			expect( await page.evaluate( () =>
				document.documentElement.scrollWidth <= window.innerWidth ) ).toBe( true );
		} );
	}
}
