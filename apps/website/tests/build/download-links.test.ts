import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { WebsiteBrowser } from '../../src/config/downloads';

const WebsiteOutput = new URL( '../../dist/', import.meta.url );

test.describe( 'browser-specific download links', () => {
	test.use( { reducedMotion: 'reduce' } );
	for ( const scenario of [
		{ name: 'Chrome desktop', browser: WebsiteBrowser.CHROME,
			userAgent: 'Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36' },
		{ name: 'Firefox desktop', browser: WebsiteBrowser.FIREFOX,
			userAgent: 'Mozilla/5.0 Firefox/140.0' },
		{ name: 'Safari desktop', browser: WebsiteBrowser.SAFARI,
			userAgent: 'Mozilla/5.0 Version/18.0 Safari/605.1.15' },
		{ name: 'Edge desktop', browser: WebsiteBrowser.EDGE,
			userAgent: 'Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0' },
		{ name: 'Edge on iOS', browser: WebsiteBrowser.CHROME,
			userAgent: 'Mozilla/5.0 EdgiOS/140.0 Mobile Safari/605.1' },
		{ name: 'Edge on Android', browser: WebsiteBrowser.CHROME,
			userAgent: 'Mozilla/5.0 EdgA/140.0 Mobile Safari/537.36' },
	] ) {
		test.describe( () => {
			test.use( { contextOptions: {
				userAgent: scenario.userAgent,
				viewport: { width: 320, height: 800 },
			} } );

			test( `${ scenario.name }: exposes the configured placeholder store destinations`, async ( { page } ) => {
				const externalRequests: string[] = [];
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
				await page.waitForFunction( ( expected ) =>
					document.querySelector( '.store-links [data-download-primary]' )?.getAttribute( 'data-store' )
						=== expected, scenario.browser,
				);
				for ( const group of await groups.all() ) {
					const primary = group.locator( '[data-download-primary]' );
					expect( await primary.getAttribute( 'data-store' ) ).toBe( scenario.browser );
					const alternatives = group.locator( '.store-alternatives a[data-store]' );
					expect( await alternatives.count() ).toBe( 3 );
					await expect( alternatives.locator( 'img' ) ).toHaveCount( 3 );
					for ( const alternative of await alternatives.all() ) {
						const browser = await alternative.getAttribute( 'data-store' );
						const icon = alternative.locator( 'img' );
						await expect( icon ).toHaveAttribute( 'src', `/badges/browser-${ String( browser ) }.svg` );
						await expect( icon ).toHaveAttribute( 'alt', '' );
						const fontSize = await alternative.evaluate( ( element ) =>
							parseFloat( getComputedStyle( element ).fontSize ),
						);
						expect( fontSize ).toBeGreaterThanOrEqual( 16 );
						expect( fontSize ).toBeLessThanOrEqual( 18 );
						await icon.evaluate( ( image: HTMLImageElement ) => image.decode() );
					}
					for ( const alternative of await group.locator( '.store-alternatives a[data-store]' ).all() ) {
						expect( await alternative.getAttribute( 'data-store' ) ).not.toBe( scenario.browser );
						expect( await alternative.getAttribute( 'href' ) ).toMatch( /^https:\/\//u );
					}
					expect( await primary.getAttribute( 'href' ) ).toMatch( /^https:\/\//u );
					expect( await primary.getAttribute( 'href' ) ).not.toContain( '#downloads' );
					await expect( primary.locator( 'img' ) ).toHaveCount( 1 );
					await expect( group.locator( '[aria-disabled="true"]' ) ).toHaveCount( 0 );
					await expect( page.locator( '.site-header [data-download-primary]' ) ).toHaveCount( 0 );
				}
				expect( await page.evaluate(
					() => document.documentElement.scrollWidth <= window.innerWidth,
				) ).toBe( true );
				expect( externalRequests ).toEqual( [] );
			} );
		} );
	}
} );
