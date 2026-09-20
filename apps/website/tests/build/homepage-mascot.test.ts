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

test.describe( 'homepage beach scene', () => {
	test( 'responds to the pointer and keyboard while preserving the footer artwork', async ( { page } ) => {
		await page.route( '**/*', serveAsset );
		await page.goto( 'http://website.test/' );
		const scene = page.locator( '.beach-scene' );
		await expect( scene ).toHaveAttribute( 'data-ready', 'true' );
		const artwork = scene.locator( 'img' );
		const before = await artwork.evaluate( ( element ) => getComputedStyle( element ).transform );
		await scene.hover( { position: { x: 30, y: 30 } } );
		await expect.poll( () => artwork.evaluate(
			( element ) => getComputedStyle( element ).transform ) ).not.toBe( before );
		await scene.getByRole( 'button' ).focus();
		await page.keyboard.press( 'Enter' );
		await expect( scene ).toHaveAttribute( 'data-reacting', 'true' );
		await expect( page.locator( '.footer-mascot img' ) ).toHaveAttribute( 'src', '/images/mascot-peek.webp' );
		await page.locator( '.site-footer' ).scrollIntoViewIfNeeded();
		await expect( scene ).toHaveAttribute( 'data-playing', 'false' );
	} );
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

				test( `${ String( viewport.width ) } (${ bodyFont ?? 'system' }, ${ reducedMotion }): prominent artwork introduces the story without loading a model`, async ( { page } ) => {
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
					const caption = await page.getByRole( 'heading', { name: 'How TOCus works' } ).boundingBox();
					const navigation = await page.locator( '.story-steps' ).boundingBox();
					if ( ! image || ! frame || ! caption || ! navigation ) {
						throw new Error( 'The mascot, caption, chapter controls and browser must all be rendered.' );
					}
					expect( requests.some( ( url ) => /\.(?:glb|gltf)(?:\?|$)/u.test( url ) ) ).toBe( false );
					expect( await page.locator( '.hero-art canvas' ).count() ).toBe( 0 );
					expect( image.width ).toBeGreaterThan( viewport.width * ( viewport.width < 600 ? 0.75 : 0.3 ) );
					if ( viewport.width < 600 ) {
						expect( Math.abs( image.x + image.width / 2 - viewport.width / 2 ) ).toBeLessThan( 8 );
					} else {
						expect( image.x ).toBeGreaterThan( viewport.width / 2 );
						expect( Math.min( image.height, viewport.height - image.y ) / image.height )
							.toBeGreaterThan( 0.8 );
					}
					expect( caption.y ).toBeGreaterThanOrEqual( image.y + image.height );
					expect( navigation.y ).toBeGreaterThan( caption.y + caption.height );
					if ( viewport.width < 600 ) {
						expect( frame.y ).toBeGreaterThan( navigation.y + navigation.height );
					} else {
						expect( frame.x ).toBeGreaterThan( navigation.x + navigation.width );
					}
					await page.locator( '[data-story-chapter] button' ).first().click();
					if ( await page.locator( '.homepage' ).evaluate( ( element ) => element.hasAttribute( 'data-story-pinned' ) ) ) {
						await expect( mascot ).toBeHidden();
					} else {
						// In normal flow the mascot may remain above the caption, but cannot cover it.
						const picture = await mascot.boundingBox();
						const heading = await page.getByRole( 'heading', { name: 'How TOCus works' } ).boundingBox();
						if ( picture && heading ) {
							expect( picture.y + picture.height ).toBeLessThanOrEqual( heading.y );
						}
					}
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
