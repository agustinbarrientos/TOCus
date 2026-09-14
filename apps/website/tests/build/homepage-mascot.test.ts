import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Route } from '@playwright/test';
import { MotionPreference } from './types';

const WebsiteOutput = new URL( '../../dist/', import.meta.url );

/**
 * Serves the built website without allowing external resources.
 * @param route - Browser request for a packaged website file.
 */
async function serveAsset( route: Route ): Promise<void> {
	const url = new URL( route.request().url() );
	const pathname = url.pathname.endsWith( '/' ) ? `${ url.pathname }index.html` : url.pathname;
	const file = fileURLToPath( new URL( `.${ pathname }`, WebsiteOutput ) );
	if ( url.origin !== 'http://website.test' || ! existsSync( file ) ) {
		await route.abort();
		return;
	}
	await route.fulfill( { path: file } );
}

test.describe( 'homepage raster mascot', () => {
	for ( const { viewport, bodyFont } of [
		{ viewport: { width: 1440, height: 900 } },
		{ viewport: { width: 1280, height: 720 } },
		{ viewport: { width: 390, height: 844 } },
		{ viewport: { width: 1440, height: 900 }, bodyFont: 'sans-serif' },
		{ viewport: { width: 1280, height: 720 }, bodyFont: 'sans-serif' },
		// A generic fixed-width face reliably exercises wider glyphs on every host, without a local font dependency.
		{ viewport: { width: 1440, height: 900 }, bodyFont: 'monospace' },
		{ viewport: { width: 1280, height: 720 }, bodyFont: 'monospace' },
	] ) {
		for ( const reducedMotion of Object.values( MotionPreference ) ) {
			test.describe( () => {
				test.use( { contextOptions: {
					viewport, reducedMotion,
				} } );

				test( `${ String( viewport.width ) } (${ bodyFont ?? 'system' }, ${ reducedMotion }): prominent artwork meets the browser without loading a model`, async ( { page } ) => {
					const requests: string[] = [];
					page.on( 'request', ( request ) => requests.push( request.url() ) );
					await page.route( '**/*', serveAsset );
					await page.goto( 'http://website.test/' );
					await page.locator( '.homepage[data-enhanced="true"]' ).waitFor();
					if ( bodyFont ) {
						await page.locator( '[data-tocus-ui]' ).first().evaluate( ( element, font ) => {
							( element as HTMLElement ).style.setProperty( '--tocus-font-family-body', font );
						}, bodyFont );
					}
					await page.evaluate( () => document.fonts.ready );
					const mascot = page.locator( '.hero-art img[data-mascot]' );
					await mascot.evaluate( ( element ) => ( element as HTMLImageElement ).decode() );
					const image = await mascot.boundingBox();
					const frame = await page.locator( '.product-demo-browser' ).boundingBox();
					if ( ! image || ! frame ) {
						throw new Error( 'The mascot and browser must both be rendered.' );
					}
					expect( requests.some( ( url ) => /\.(?:glb|gltf)(?:\?|$)/u.test( url ) ) ).toBe( false );
					expect( await page.locator( '.hero-art canvas' ).count() ).toBe( 0 );
					expect( image.width ).toBeGreaterThan( viewport.width * ( viewport.width < 600 ? 0.75 : 0.3 ) );
					expect( Math.abs( image.x + image.width / 2 - viewport.width / 2 ) ).toBeLessThan( 2 );
					expect( Math.abs( image.y + image.height - frame.y ) ).toBeLessThan( 45 );
					expect( frame.y ).toBeLessThan( viewport.height );
					await page.locator( '[data-story-chapter] button' ).first().click();
					await expect.poll( () => mascot.isVisible() ).toBe( false );
					expect( await mascot.getAttribute( 'alt' ) ).toBeTruthy();
					expect( await page.evaluate( () =>
						document.documentElement.scrollWidth <= window.innerWidth ) ).toBe( true );
				} );
			} );
		}
	}

	test.describe( () => {
		test.use( { contextOptions: { javaScriptEnabled: false } } );

		test( 'keeps the artwork and direct store links usable without JavaScript', async ( { page } ) => {
			await page.route( '**/*', serveAsset );
			await page.goto( 'http://website.test/' );
			await expect( page.locator( '.hero-art img[data-mascot]' ) ).toBeVisible();
			const download = page.locator( '.hero [data-download-primary]' );
			await expect( download ).toBeVisible();
			expect( await download.getAttribute( 'href' ) ).toMatch( /^https:\/\//u );
			expect( await page.locator( 'main section' ).count() ).toBeGreaterThanOrEqual( 6 );
		} );
	} );
} );
