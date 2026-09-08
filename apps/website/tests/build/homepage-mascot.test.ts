import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, type Route } from 'playwright';
import { describe, expect, test } from 'vitest';

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

describe( 'homepage raster mascot', () => {
	for ( const viewport of [
		{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 390, height: 844 },
	] ) {
		test( `${ String( viewport.width ) }: prominent artwork meets the browser without loading a model`, async () => {
			const browser = await chromium.launch();
			try {
				const page = await browser.newPage( { viewport } );
				const requests: string[] = [];
				page.on( 'request', ( request ) => requests.push( request.url() ) );
				await page.route( '**/*', serveAsset );
				await page.goto( 'http://website.test/' );
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
			} finally {
				await browser.close();
			}
		} );
	}

	test( 'keeps the artwork and direct store links usable without JavaScript', async () => {
		const browser = await chromium.launch();
		try {
			const page = await browser.newPage( { javaScriptEnabled: false } );
			await page.route( '**/*', serveAsset );
			await page.goto( 'http://website.test/' );
			expect( await page.locator( '.hero-art img[data-mascot]' ).isVisible() ).toBe( true );
			const download = page.locator( '.hero [data-download-primary]' );
			expect( await download.isVisible() ).toBe( true );
			expect( await download.getAttribute( 'href' ) ).toMatch( /^https:\/\//u );
			expect( await page.locator( 'main section' ).count() ).toBeGreaterThanOrEqual( 6 );
		} finally {
			await browser.close();
		}
	} );
} );
