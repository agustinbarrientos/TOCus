import { fileURLToPath } from 'node:url';
import { access } from 'node:fs/promises';
import { expect, test, type Route } from '@playwright/test';

const WebsiteOutput = new URL( '../../dist/', import.meta.url );

/**
 * Serves generated pages, retaining ordinary 404 behavior for missing translations.
 * @param route - Request for the built site.
 */
async function serveAsset( route: Route ) {
	const pathname = new URL( route.request().url() ).pathname;
	const path = pathname.endsWith( '/' ) ? `${ pathname }index.html` : pathname;
	const filename = fileURLToPath( new URL( `.${ path }`, WebsiteOutput ) );
	try {
		await access( filename );
	} catch {
		await route.fulfill( { status: 404, body: 'Not found' } );
		return;
	}
	await route.fulfill( { path: filename } );
}

test( 'privacy keeps its paper background through the footer', async ( { page } ) => {
	await page.route( 'http://website.test/**', serveAsset );
	await page.goto( 'http://website.test/privacy/' );
	const colors = await page.evaluate( () => {
		const site = document.querySelector( '.information-website' );
		const footer = document.querySelector( '.site-footer' );
		if ( ! site || ! footer ) {
			throw new Error( 'Missing information page or footer.' );
		}
		return [ getComputedStyle( site ).backgroundColor, getComputedStyle( footer ).backgroundColor ];
	} );
	expect( colors[ 1 ] ).toBe( colors[ 0 ] );
} );

for ( const browserName of [ 'chromium', 'firefox', 'webkit' ] as const ) {
	const engineTest = test.extend( { browserName } );
	engineTest( `${ browserName }: changing privacy language preserves the document and localized home link`, async ( { page } ) => {
		await page.route( 'http://website.test/**', serveAsset );
		await page.goto( 'http://website.test/privacy/' );
		await page.locator( '.language-shortcut' ).click();
		const german = page.getByRole( 'menuitem', { name: 'Deutsch', exact: true } );
		await expect( german ).toHaveAttribute( 'href', '/de/privacy/' );
		await german.click();
		await expect( page ).toHaveURL( 'http://website.test/de/privacy/' );
		await expect( page.locator( 'html' ) ).toHaveAttribute( 'lang', 'de' );
		await expect( page.locator( 'h1' ) ).toHaveText( 'Datenschutzerkl\u00e4rung' );
		await expect( page.locator( '.site-header .site-brand-link' ) ).toHaveAttribute( 'href', '/de/' );
		await page.locator( '.language-shortcut' ).click();
		await expect( page.locator( '[role="menu"] [aria-current="page"]' ) ).toHaveText( 'Deutsch' );
		await page.getByRole( 'menuitem', { name: 'English', exact: true } ).click();
		await expect( page ).toHaveURL( 'http://website.test/privacy/' );
	} );
}

test( 'every privacy translation and its links are available without JavaScript', async ( { browser } ) => {
	const context = await browser.newContext( { javaScriptEnabled: false, viewport: { width: 360, height: 800 } } );
	try {
		const page = await context.newPage();
		await page.route( 'http://website.test/**', serveAsset );
		await page.goto( 'http://website.test/privacy/' );
		const english = await page.locator( 'main h1, main h2, main h3, main p' ).allTextContents();
		for ( const [ home, tag, image ] of [
			[ '/es/', 'es', 'es-tu' ], [ '/es-ar/', 'es-AR', 'es-vos' ], [ '/de/', 'de', 'de' ],
			[ '/fr/', 'fr', 'fr' ], [ '/it/', 'it', 'it' ], [ '/ja/', 'ja', 'ja' ],
			[ '/pt-br/', 'pt-BR', 'pt-br' ], [ '/pt-pt/', 'pt-PT', 'pt-pt' ], [ '/ru/', 'ru', 'ru' ],
		] as const ) {
			await page.goto( `http://website.test${ home }` );
			await expect( page.locator( '.feature-link[href$="privacy/"]' ) ).toHaveAttribute( 'href', `${ home }privacy/` );
			await expect( page.locator( '.footer-links a[href$="privacy/"]' ) ).toHaveAttribute( 'href', `${ home }privacy/` );
			await page.goto( `http://website.test${ home }privacy/` );
			await expect( page.locator( 'html' ) ).toHaveAttribute( 'lang', tag );
			const translated = await page.locator( 'main h1, main h2, main h3, main p' ).allTextContents();
			expect( translated ).toHaveLength( english.length );
			translated.forEach( ( text, index ) => {
				expect( text.trim(), `${ tag } paragraph ${ String( index ) }` ).not.toBe( '' );
				expect( text.trim(), `${ tag } paragraph ${ String( index ) }` ).not.toBe( english[ index ]?.trim() );
			} );
			await page.evaluate( () => document.fonts.ready );
			for ( const heading of await page.locator( 'main h1, main h2, main h3' ).all() ) {
				expect( await heading.evaluate( ( element ) => element.scrollWidth <= element.clientWidth ),
					`${ tag }: ${ await heading.innerText() } must not be clipped` ).toBe( true );
			}
			await expect( page.locator( 'meta[property="og:image"]' ) ).toHaveAttribute( 'content', `https://tocus.uo.ar/images/og/${ image }.png` );
			await expect( page.locator( 'meta[name="twitter:image"]' ) ).toHaveAttribute( 'content', `https://tocus.uo.ar/images/og/${ image }.png` );
			await expect( page.locator( 'meta[property="og:url"]' ) ).toHaveAttribute( 'content', `https://tocus.uo.ar${ home }privacy/` );
			await expect( page.locator( 'link[rel="alternate"][hreflang="en"]' ) ).toHaveAttribute( 'href', '/privacy/' );
			await expect( page.locator( '#languages [aria-current="page"]' ) ).toHaveAttribute( 'href', `${ home }privacy/` );
			for ( const link of await page.locator( '#languages a' ).all() ) {
				expect( await link.getAttribute( 'href' ) ).toMatch( /\/privacy\/$/u );
			}
			expect( await page.evaluate( () => document.documentElement.scrollWidth <= innerWidth ) ).toBe( true );
		}
		await page.locator( '#languages a[lang="en"]' ).click();
		await expect( page ).toHaveURL( 'http://website.test/privacy/' );
	} finally {
		await context.close();
	}
} );
