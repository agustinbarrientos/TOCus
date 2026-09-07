import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit, type Route } from 'playwright';
import { describe, expect, test } from 'vitest';

const WebsiteOutput = new URL( '../../dist/', import.meta.url );
const PublicRoutes = [ '/', '/de/', '/es/', '/es-ar/', '/fr/', '/it/', '/ja/', '/pt-br/', '/pt-pt/', '/ru/' ];

/**
 * Serves only local generated website assets.
 * @param route - Intercepted browser request.
 */
async function serveAsset( route: Route ): Promise<void> {
	const request = new URL( route.request().url() );
	const path = request.pathname.endsWith( '/' ) ? `${ request.pathname }index.html` : request.pathname;
	await route.fulfill( { path: fileURLToPath( new URL( `.${ path }`, WebsiteOutput ) ) } );
}

describe( 'public product presentation', () => {
	test( 'offers centralized download destinations and locally served artwork', async () => {
		const browser = await chromium.launch();
		try {
			const page = await browser.newPage();
			await page.route( 'http://website.test/**', serveAsset );
			await page.goto( 'http://website.test/' );
			const primaryDownload = page.locator( '#downloads .store-primary[data-download-primary]' );
			expect( await primaryDownload.count() ).toBe( 1 );
			expect( await primaryDownload.getAttribute( 'href' ) ).toMatch( /^https:/u );
			expect( await primaryDownload.innerText() ).toMatch( /\S/u );
			expect( await primaryDownload.locator( 'img' ).count() ).toBe( 1 );
			expect( await primaryDownload.locator( '.tocus-icon' ).count() ).toBe( 1 );
			expect( await page.locator( '#downloads a[href]' ).count() ).toBe( 3 );
			expect( await page.locator( 'main img[data-mascot]' ).count() ).toBe( 2 );
			expect( await page.locator( '.hero-art img[data-mascot]' ).getAttribute( 'src' ) ).toMatch( /^\//u );
			expect( await page.locator( '.footer-mascot img[data-mascot]' ).getAttribute( 'src' ) ).toMatch( /^\//u );
			expect( await page.locator( '.hero-actions a[data-store]' ).count() ).toBe( 3 );
			expect( await page.locator( 'a[href*="utm_medium=website"] img' ).getAttribute( 'src' ) ).toMatch( /^\//u );
			expect( await page.locator( 'a[href="/privacy/"]' ).count() ).toBeGreaterThan( 0 );
			expect( await page.locator( 'a[href="/support/"]' ).count() ).toBeGreaterThan( 0 );
		} finally {
			await browser.close();
		}
	} );
	for ( const engine of [ chromium, firefox, webkit ] ) {
		test( `${ engine.name() }: every locale explains the product without JavaScript`, async () => {
			const browser = await engine.launch();
			const context = await browser.newContext( {
				javaScriptEnabled: false, viewport: { width: 360, height: 800 },
			} );
			const externalRequests: string[] = [];
			await context.route( '**/*', async ( route ) => {
				if ( new URL( route.request().url() ).origin !== 'http://website.test' ) {
					externalRequests.push( route.request().url() );
					await route.abort();
				} else {
					await serveAsset( route );
				}
			} );
			try {
				const page = await context.newPage();
				for ( const route of PublicRoutes ) {
					await page.goto( `http://website.test${ route }` );
					expect( await page.locator( 'h1' ).innerText() ).not.toBe( 'TOCus' );
					expect( await page.locator( '.description' ).isVisible() ).toBe( true );
					const fallback = page.locator( '.story-fallback' );
					const fallbackItems = fallback.locator( ':scope > li' );
					expect( await fallbackItems.count() ).toBe( 5 );
					for ( const item of await fallbackItems.all() ) {
						const heading = item.locator( 'h3' );
						const description = item.locator( 'p' );
						expect( await heading.isVisible() ).toBe( true );
						expect( ( await heading.innerText() ).trim() ).not.toBe( '' );
						expect( await description.isVisible() ).toBe( true );
						expect( ( await description.innerText() ).trim() ).not.toBe( '' );
					}
					expect( await page.locator( '.story-step-action' ).count() ).toBe( 5 );
					expect( await page.locator( '.story-step-action:visible' ).count() ).toBe( 0 );
					expect( await fallback.evaluate(
						( element ) => element.scrollWidth <= element.clientWidth,
					) ).toBe( true );
					expect( await page.locator( '#settings' ).isVisible() ).toBe( true );
					expect( await page.locator( '#privacy' ).isVisible() ).toBe( true );
					expect( await page.locator( '.product-demo-browser' ).isVisible() ).toBe( true );
					expect( await page.locator( 'main img[data-mascot]' ).count() ).toBe( 2 );
					expect( await page.locator( '#languages a[lang]' ).count() ).toBe( 10 );
					expect( await page.locator( '#languages a[aria-current="page"]' ).count() ).toBe( 1 );
					const externalLinks = await page.locator( 'a[href^="https:"]' ).evaluateAll(
						( links ) => links.map( ( link ) => link.getAttribute( 'href' ) ),
					);
					expect( new Set( externalLinks ) ).toEqual( new Set( [
						'https://github.com/agustinbarrientos/TOCus',
						'https://agustinbarrientos.com/about/?utm_source=tocus&utm_medium=website&utm_campaign=about',
						'https://chromewebstore.google.com/detail/tocus/placeholder-listing-id',
						'https://addons.mozilla.org/firefox/addon/tocus-placeholder/',
						'https://apps.apple.com/app/tocus/id0000000000',
					] ) );
					for ( const link of await page.locator( 'a[target="_blank"]' ).all() ) {
						expect( await link.getAttribute( 'rel' ) ).toContain( 'noopener noreferrer' );
					}
					const fitsViewport = await page.evaluate(
						() => document.documentElement.scrollWidth <= window.innerWidth,
					);
					expect( fitsViewport, route ).toBe( true );
				}
				expect( externalRequests ).toEqual( [] );
			} finally {
				await browser.close();
			}
		}, 60_000 );
	}
} );
