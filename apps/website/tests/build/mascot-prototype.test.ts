import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const WebsiteOutput = new URL( '../../dist/', import.meta.url );

test.describe( 'isolated real 3D mascot comparison', () => {
	test.use( { contextOptions: {
		viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce', colorScheme: 'light',
	} } );

	test( 'renders local geometry, respects stillness, changes view and disposes after context loss', async ( { context, page } ) => {
		test.setTimeout( 30000 );
		context.setDefaultTimeout( 10000 );
		const externalRequests: string[] = [];
		const modelRequests: string[] = [];
		await context.route( '**/*', async ( route ) => {
			const url = new URL( route.request().url() );
			if ( url.pathname.endsWith( '.glb' ) ) {
				modelRequests.push( url.pathname );
			}
			if ( url.origin !== 'http://website.test' ) {
				externalRequests.push( url.href );
				await route.abort();
				return;
			}
			const path = url.pathname.endsWith( '/' ) ? `${ url.pathname }index.html` : url.pathname;
			const file = fileURLToPath( new URL( `.${ path }`, WebsiteOutput ) );
			if ( ! existsSync( file ) ) {
				await route.fulfill( { status: 404, body: 'Not found' } );
				return;
			}
			await route.fulfill( { path: file } );
		} );
		const errors: string[] = [];
		page.on( 'pageerror', ( error ) => errors.push( error.message ) );
		await page.goto( 'http://website.test/mascot-lab/' );
		await page.evaluate( () => document.fonts.ready );
		const canvas = page.getByRole( 'img', { name: 'Interactive 3D capybara prototype' } );
		expect( await canvas.count() ).toBe( 1 );
		await page.waitForFunction( () =>
			document.querySelector( '.mascot-prototype canvas' )?.getAttribute( 'data-status' ) === 'ready',
		);
		expect( modelRequests ).toEqual( [ '/models/mascot.glb' ] );
		expect( await canvas.getAttribute( 'data-animation' ) ).toBe( 'Greeting' );
		expect( await canvas.getAttribute( 'data-still' ) ).toBe( 'true' );
		await page.waitForTimeout( 200 );
		const still = await canvas.getAttribute( 'data-frame' );
		const frontView = await canvas.screenshot();
		await page.waitForTimeout( 200 );
		expect( await canvas.getAttribute( 'data-frame' ) ).toBe( still );
		await page.evaluate( () => window.dispatchEvent( new PageTransitionEvent( 'pagehide', { persisted: true } ) ) );
		expect( await canvas.getAttribute( 'data-status' ) ).toBe( 'ready' );
		await page.evaluate( () => window.dispatchEvent( new PageTransitionEvent( 'pageshow', { persisted: true } ) ) );
		const turn = page.getByRole( 'slider', { name: 'Turn the 3D model' } );
		await turn.focus();
		await page.keyboard.press( 'End' );
		const turnedView = await canvas.screenshot();
		expect( turnedView.equals( frontView ) ).toBe( false );
		await test.step( 'Play and pause the model animation', async () => {
			const beforePlayback = Number( await canvas.getAttribute( 'data-frame' ) );
			await page.getByRole( 'button', { name: 'Play animation' } ).click();
			expect( await canvas.getAttribute( 'data-still' ) ).toBe( 'false' );
			await expect.poll( async () => Number( await canvas.getAttribute( 'data-frame' ) ) )
				.toBeGreaterThan( beforePlayback + 1 );
			// Capture the advanced pose after stopping the render loop, including on software GPUs.
			await page.getByRole( 'button', { name: 'Pause animation' } ).click();
			expect( await canvas.getAttribute( 'data-still' ) ).toBe( 'true' );
			expect( ( await canvas.screenshot() ).equals( turnedView ) ).toBe( false );
		} );
		await test.step( 'Suspend and resume animation through the page cache', async () => {
			await page.getByRole( 'button', { name: 'Play animation' } ).click();
			expect( await canvas.getAttribute( 'data-still' ) ).toBe( 'false' );
			await page.evaluate( () => window.dispatchEvent( new PageTransitionEvent( 'pagehide', { persisted: true } ) ) );
			expect( await canvas.getAttribute( 'data-still' ) ).toBe( 'true' );
			const cachedFrame = await canvas.getAttribute( 'data-frame' );
			await page.waitForTimeout( 200 );
			expect( await canvas.getAttribute( 'data-frame' ) ).toBe( cachedFrame );
			await page.evaluate( () => window.dispatchEvent( new PageTransitionEvent( 'pageshow', { persisted: true } ) ) );
			expect( await canvas.getAttribute( 'data-still' ) ).toBe( 'false' );
			await page.getByRole( 'button', { name: 'Pause animation' } ).click();
			expect( await canvas.getAttribute( 'data-still' ) ).toBe( 'true' );
		} );
		await test.step( 'Observe hidden-page stillness and motion preference changes', async () => {
			await page.getByRole( 'button', { name: 'Play animation' } ).click();
			await page.evaluate( () => {
				Object.defineProperty( document, 'visibilityState', { configurable: true, value: 'hidden' } );
				document.dispatchEvent( new Event( 'visibilitychange' ) );
			} );
			const hiddenFrame = await canvas.getAttribute( 'data-frame' );
			await page.waitForTimeout( 200 );
			expect( await canvas.getAttribute( 'data-frame' ) ).toBe( hiddenFrame );
			await page.evaluate( () => {
				Object.defineProperty( document, 'visibilityState', { configurable: true, value: 'visible' } );
				document.dispatchEvent( new Event( 'visibilitychange' ) );
			} );
			expect( await canvas.getAttribute( 'data-still' ) ).toBe( 'false' );
			await page.emulateMedia( { reducedMotion: 'no-preference' } );
			await page.emulateMedia( { reducedMotion: 'reduce' } );
			expect( await canvas.getAttribute( 'data-still' ) ).toBe( 'true' );
		} );
		await test.step( 'Keep the reference visible after losing the WebGL context', async () => {
			await canvas.evaluate( ( element ) => element.dispatchEvent( new Event( 'webglcontextlost' ) ) );
			expect( await canvas.getAttribute( 'data-status' ) ).toBe( 'unavailable' );
			await expect( page.getByText( '3D is unavailable in this browser. The reference remains visible.' ) ).toBeVisible();
			await expect( page.getByRole( 'img', { name: 'Supplied capybara reference' } ) ).toBeVisible();
		} );
		expect( errors ).toEqual( [] );
		expect( externalRequests ).toEqual( [] );
	} );
} );
