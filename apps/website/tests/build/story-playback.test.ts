import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { DemoChapter } from '../../src/components/product-demo/types';

const WebsiteOutput = new URL( '../../dist/', import.meta.url );

for ( const engine of [ 'chromium', 'firefox', 'webkit' ] as const ) {
	const engineTest = test.extend( { browserName: engine } );
	engineTest( `${ engine }: walkthrough plays on entry, pauses offscreen, and never opens YouTube before Continue`, async ( { page } ) => {
		await page.route( '**/*', async ( route ) => {
			const url = new URL( route.request().url() );
			if ( url.origin !== 'http://website.test' ) {
				await route.abort();
				return;
			}
			const path = url.pathname.endsWith( '/' ) ? `${ url.pathname }index.html` : url.pathname;
			await route.fulfill( { path: fileURLToPath( new URL( `.${ path }`, WebsiteOutput ) ) } );
		} );
		await page.emulateMedia( { reducedMotion: 'no-preference' } );
		await page.goto( 'http://website.test/' );
		const story = page.locator( '.how-it-works' );
		await expect( story.getByRole( 'button', { name: 'Play walkthrough', exact: true } ) ).toBeVisible();
		await page.clock.install();
		await page.locator( '.product-demo-browser' ).scrollIntoViewIfNeeded();
		await expect( story ).toHaveAttribute( 'data-playing', 'true' );
		await page.clock.runFor( 4_200 );
		await expect( page.locator( '.product-demo' ) ).toHaveAttribute( 'data-scene', DemoChapter.VISIT );
		await expect( page.locator( '.product-demo-youtube:visible' ) ).toHaveCount( 0 );
		await expect( page.locator( '.product-demo-address' ) ).toContainText( 'you' );
		await page.clock.runFor( 3_000 );
		await expect( page.locator( '.product-demo' ) ).toHaveAttribute( 'data-scene', DemoChapter.PAUSE );
		await story.getByRole( 'button', { name: 'Pause walkthrough', exact: true } ).click();
		const countdown = await page.locator( '.product-demo-countdown:visible' ).textContent();
		await page.clock.runFor( 2_000 );
		await expect( page.locator( '.product-demo-countdown:visible' ) ).toHaveText( countdown ?? '' );
		await story.getByRole( 'button', { name: 'Play walkthrough', exact: true } ).click();
		await page.evaluate( () => window.scrollTo( 0, document.body.scrollHeight ) );
		await expect( story ).toHaveAttribute( 'data-playing', 'false' );
		await page.clock.runFor( 20_000 );
		await page.locator( '.product-demo-browser' ).scrollIntoViewIfNeeded();
		await expect( story ).toHaveAttribute( 'data-playing', 'true' );
		await page.clock.runFor( 9_800 );
		await expect( page.locator( '.product-demo' ) ).toHaveAttribute( 'data-scene', DemoChapter.CONTINUE );
		await expect( page.locator( '.product-demo-youtube:visible' ) ).toHaveCount( 0 );
		await page.clock.runFor( 3_000 );
		await expect( page.locator( '.product-demo' ) ).toHaveAttribute( 'data-scene', DemoChapter.BROWSE );
		await expect( page.locator( '.product-demo-youtube:visible' ) ).toBeVisible();
		await page.clock.runFor( 6_000 );
		await expect( story ).toHaveAttribute( 'data-playing', 'false' );
		await story.getByRole( 'button', { name: 'Replay walkthrough', exact: true } ).click();
		await expect( page.locator( '.product-demo' ) ).toHaveAttribute( 'data-scene', DemoChapter.CHOOSE );
		expect( await page.locator( '.experience-stage' ).evaluate( ( element ) => getComputedStyle( element ).position ) ).toBe( 'static' );
	} );
}
