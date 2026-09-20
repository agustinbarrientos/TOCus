import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const WebsiteOutput = new URL( '../../dist/', import.meta.url );

test( 'privacy links and media services stay with their claims, and hero interaction respects reduced motion', async ( { page } ) => {
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
	const privacy = page.locator( '.privacy-statement' );
	await expect( privacy.locator( ':scope > *' ) ).toHaveCount( 2 );
	const local = privacy.locator( '.privacy-copy' ).filter( { has: page.getByRole( 'heading', { name: 'Stored on your device' } ) } );
	const open = privacy.locator( '.privacy-copy' ).filter( { has: page.getByRole( 'heading', { name: 'Free and open source' } ) } );
	await expect( local ).toContainText( 'without an account' );
	await expect( local ).toContainText( 'no analytics' );
	await expect( local ).toContainText( 'does not contact external services' );
	await expect( open ).toContainText( 'advertising' );
	await expect( open.getByRole( 'link', { name: 'Agustin Barrientos' } ) ).toBeVisible();
	const links = await privacy.locator( 'a' ).evaluateAll( ( elements ) => elements.map( ( element ) => {
		const style = getComputedStyle( element );
		return [ style.fontSize, style.fontFamily, style.fontWeight, style.lineHeight ];
	} ) );
	expect( new Set( links.map( ( value ) => JSON.stringify( value ) ) ).size ).toBe( 1 );
	const video = page.locator( '.feature-strip > li' ).filter( { hasText: 'Your video pauses, too' } );
	await expect( video.locator( '.supported-services li' ) ).toHaveCount( 6 );
	expect( await video.locator( '.supported-services img' ).first().evaluate( ( element ) => element.getBoundingClientRect().width ) ).toBeLessThanOrEqual( 20 );
	expect( await page.title() ).not.toContain( '\u2014' );
	const scene = page.locator( '.beach-scene' );
	await scene.scrollIntoViewIfNeeded();
	await expect( scene ).toHaveAttribute( 'data-playing', 'true' );
	await scene.getByRole( 'button' ).press( 'Enter' );
	await expect( scene ).toHaveAttribute( 'data-reacting', 'true' );
	await page.emulateMedia( { reducedMotion: 'reduce' } );
	await expect( scene ).toHaveAttribute( 'data-playing', 'false' );
	await expect( scene.locator( 'img' ) ).toBeVisible();
	await expect( page.locator( '.footer-mascot img' ) ).toHaveAttribute( 'src', '/images/mascot-peek.webp' );
} );
