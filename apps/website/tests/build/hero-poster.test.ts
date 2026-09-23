import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Route } from '@playwright/test';
import { PNG } from 'pngjs';

const WebsiteOutput = new URL( '../../dist/', import.meta.url );

/** The head silhouette measured in CSS pixels, independent of GPU texture noise. */
interface HeadLandmark {
	top: number;
	center: number;
	width: number;
}

/**
 * Serves the packaged website with no external network dependencies.
 * @param route - A local page resource request.
 */
async function serveAsset( route: Route ): Promise<void> {
	const url = new URL( route.request().url() );
	if ( url.protocol === 'blob:' ) {
		await route.continue();
		return;
	}
	const pathname = url.pathname.endsWith( '/' ) ? `${ url.pathname }index.html` : url.pathname;
	const file = fileURLToPath( new URL( `.${ pathname }`, WebsiteOutput ) );
	if ( url.origin !== 'http://website.test' || ! existsSync( file ) ) {
		await route.abort();
		return;
	}
	await route.fulfill( { path: file } );
}

/**
 * Finds the orange head above the foliage without comparing exact shader colors.
 * @param screenshot - The hero rendered by the browser at CSS pixel scale.
 * @param heroHeight - The complete hero height, including its shore transition.
 * @return Stable silhouette landmarks, or an error for absent artwork.
 */
function findHead( screenshot: Buffer, heroHeight: number ): HeadLandmark {
	const image = PNG.sync.read( screenshot );
	const left = Math.round( image.width * 0.15 );
	const right = Math.round( image.width * 0.85 );
	/**
	 * Tests the warm orange character color, excluding sky and green foliage.
	 * @param x - Horizontal pixel coordinate.
	 * @param y - Vertical pixel coordinate.
	 * @return Whether the pixel belongs to the character's orange silhouette.
	 */
	function isCharacter( x: number, y: number ): boolean {
		const offset = ( y * image.width + x ) * 4;
		const red = image.data[ offset ] ?? 0;
		const green = image.data[ offset + 1 ] ?? 0;
		const blue = image.data[ offset + 2 ] ?? 0;
		return red > 135 && green > 70 && blue < 140 && red > green * 1.2 && green > blue * 1.4;
	}
	let top = -1;
	for ( let y = Math.round( heroHeight * 0.4 ); y < image.height * 0.9; y++ ) {
		let count = 0;
		for ( let x = left; x <= right; x++ ) {
			count += Number( isCharacter( x, y ) );
		}
		if ( count >= Math.max( 4, Math.round( heroHeight * 0.004 ) ) ) {
			top = y;
			break;
		}
	}
	if ( top < 0 ) {
		throw new Error( 'The loaded artwork must contain a visible orange capybara head.' );
	}
	let minimum = right;
	let maximum = left;
	const bandStart = Math.round( top + heroHeight * 0.035 );
	const bandEnd = Math.min( image.height, Math.round( top + heroHeight * 0.08 ) );
	for ( let y = bandStart; y < bandEnd; y++ ) {
		for ( let x = left; x <= right; x++ ) {
			if ( isCharacter( x, y ) ) {
				minimum = Math.min( minimum, x );
				maximum = Math.max( maximum, x );
			}
		}
	}
	if ( maximum <= minimum || minimum === left || maximum === right ) {
		throw new Error( 'The head landmark must be visible and contained inside the central scene.' );
	}
	return { top, center: ( minimum + maximum ) / 2, width: maximum - minimum };
}

for ( const viewport of [
	{ width: 1440, height: 900 },
	{ width: 390, height: 844 },
	{ width: 2560, height: 900 },
] ) {
	test( `${ String( viewport.width ) }: the poster and first live frame keep the character in place`, async ( { page }, testInfo ) => {
		await page.setViewportSize( viewport );
		// Hold animation time at zero without exposing capture controls in production.
		await page.addInitScript( () => {
			window.requestAnimationFrame = () => 0;
		} );
		let releaseModel: ( () => void ) | undefined;
		const pendingModel = new Promise<void>( ( resolve ) => {
			releaseModel = resolve;
		} );
		await page.route( '**/*', async ( route ) => {
			if ( route.request().url().endsWith( '/models/riverside/hero.glb' ) ) {
				await pendingModel;
			}
			await serveAsset( route );
		} );
		await page.goto( 'http://website.test/' );
		await page.addStyleTag( { content: '.hero-header, .hero-copy, .hero-shore-transition { visibility: hidden !important; }' } );
		const scene = page.locator( '.riverside-hero' );
		const poster = scene.locator( 'img' );
		await poster.evaluate( ( element: HTMLImageElement ) => element.decode() );
		await expect( scene.locator( 'canvas' ) ).toHaveCSS( 'opacity', '0' );
		const hero = await scene.boundingBox();
		if ( ! hero ) {
			throw new Error( 'The hero must have a rendered size before enhancement.' );
		}
		const still = await page.screenshot( { scale: 'css' } );
		releaseModel?.();
		await expect( scene ).toHaveAttribute( 'data-status', 'ready' );
		expect( Number( await scene.locator( 'canvas' ).getAttribute( 'data-yaw' ) ) ).toBeCloseTo( 42 * Math.PI / 180 );
		await expect( scene.locator( 'canvas' ) ).toHaveAttribute( 'data-animation-time', '0' );
		const live = await page.screenshot( { scale: 'css' } );
		await testInfo.attach( 'poster', { body: still, contentType: 'image/png' } );
		await testInfo.attach( 'initial-scene', { body: live, contentType: 'image/png' } );
		const before = findHead( still, hero.height );
		const after = findHead( live, hero.height );
		await testInfo.attach( 'head-landmarks', {
			body: JSON.stringify( { before, after } ), contentType: 'application/json',
		} );
		expect( Math.abs( after.top - before.top ), 'The capybara must not jump vertically on enhancement.' ).toBeLessThanOrEqual( 3 );
		expect( Math.abs( after.center - before.center ), 'The capybara must not jump horizontally on enhancement.' ).toBeLessThanOrEqual( 3 );
		expect( Math.abs( after.width - before.width ), 'The capybara must not change scale on enhancement.' ).toBeLessThanOrEqual( 6 );
	} );
}
