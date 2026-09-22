import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const WebsiteOutput = new URL( '../../dist/', import.meta.url );

test( 'local and open-source claims remain readable while reduced motion uses the hero poster', async ( { page } ) => {
	await page.emulateMedia( { reducedMotion: 'reduce' } );
	await page.route( '**/*', async ( route ) => {
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
	const features = page.locator( '#features .feature-grid > li' );
	const local = features.filter( { has: page.getByRole( 'heading', { name: 'Everything is stored on your device', exact: true } ) } );
	const open = features.filter( { has: page.getByRole( 'heading', { name: 'It\u2019s free and open source', exact: true } ) } );
	await expect( local ).toBeVisible();
	await expect( local.locator( 'p' ) ).not.toHaveText( /^\s*$/u );
	await expect( open ).toBeVisible();
	await expect( open.locator( 'p' ) ).not.toHaveText( /^\s*$/u );
	await expect( page.locator( '.site-footer a[href="/privacy/"]' ) ).toBeVisible();
	await expect( page.locator( '.site-footer a[href="https://github.com/agustinbarrientos/TOCus"]' ) ).toBeVisible();
	expect( await page.title() ).not.toContain( '\u2014' );
	const scene = page.locator( '.riverside-hero' );
	await scene.scrollIntoViewIfNeeded();
	await expect( scene ).toHaveAttribute( 'data-status', 'poster' );
	await expect( scene.locator( 'canvas' ) ).toHaveCSS( 'opacity', '0' );
	await expect( scene.locator( 'img' ) ).toBeVisible();
} );
