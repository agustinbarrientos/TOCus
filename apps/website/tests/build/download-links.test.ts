import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { describe, expect, test } from 'vitest';

const WebsiteOutput = new URL( '../../dist/', import.meta.url );

describe( 'browser-specific download links', () => {
	for ( const scenario of [
		{ browser: 'chrome', userAgent: 'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36' },
		{ browser: 'firefox', userAgent: 'Mozilla/5.0 Firefox/130.0' },
		{ browser: 'safari', userAgent: 'Mozilla/5.0 Version/18.0 Safari/605.1.15' },
	] ) {
		test( `${ scenario.browser }: one badge and two plain alternatives link directly to stores`, async () => {
			const browser = await chromium.launch();
			const externalRequests: string[] = [];
			try {
				const page = await browser.newPage( { userAgent: scenario.userAgent } );
				await page.route( '**/*', async ( route ) => {
					const url = new URL( route.request().url() );
					if ( url.origin !== 'http://website.test' ) {
						externalRequests.push( url.href );
						await route.abort();
						return;
					}
					const path = url.pathname.endsWith( '/' ) ? `${ url.pathname }index.html` : url.pathname;
					await route.fulfill( { path: fileURLToPath( new URL( `.${ path }`, WebsiteOutput ) ) } );
				} );
				await page.goto( 'http://website.test/' );
				const groups = page.locator( '.store-links' );
				expect( await groups.count() ).toBeGreaterThan( 0 );
				expect( await groups.first().locator( 'img' ).count() ).toBe( 1 );
				await page.waitForFunction( ( expected ) =>
					document.querySelector( '.store-links [data-download-primary]' )?.getAttribute( 'data-store' )
						=== expected, scenario.browser,
				);
				for ( const group of await groups.all() ) {
					const primary = group.locator( '[data-download-primary]' );
					expect( await primary.getAttribute( 'href' ) ).toMatch( /^https:\/\//u );
					expect( await primary.getAttribute( 'href' ) ).not.toContain( '#downloads' );
					expect( await primary.getAttribute( 'data-store' ) ).toBe( scenario.browser );
					const alternatives = group.locator( '.store-alternatives a' );
					expect( await alternatives.count() ).toBe( 2 );
					expect( await alternatives.locator( 'img' ).count() ).toBe( 0 );
					for ( const alternative of await alternatives.all() ) {
						expect( await alternative.getAttribute( 'data-store' ) ).not.toBe( scenario.browser );
						expect( await alternative.getAttribute( 'href' ) ).toMatch( /^https:\/\//u );
					}
					expect( await page.locator( '.site-header [data-download-primary]' ).getAttribute( 'href' ) )
						.toBe( await primary.getAttribute( 'href' ) );
				}
				expect( externalRequests ).toEqual( [] );
			} finally {
				await browser.close();
			}
		} );
	}
} );
