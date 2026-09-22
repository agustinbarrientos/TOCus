import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { WebsiteBrowser } from '../../src/config/downloads';

const WebsiteOutput = new URL( '../../dist/', import.meta.url );

test.describe( 'browser-specific download links', () => {
	for ( const scenario of [
		{ name: 'Chrome desktop', browser: WebsiteBrowser.CHROME,
			userAgent: 'Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36', available: true },
		{ name: 'Firefox desktop', browser: WebsiteBrowser.FIREFOX,
			userAgent: 'Mozilla/5.0 Firefox/140.0', available: true },
		{ name: 'Safari desktop', browser: WebsiteBrowser.SAFARI,
			userAgent: 'Mozilla/5.0 Version/18.0 Safari/605.1.15', available: true },
		{ name: 'Edge desktop', browser: WebsiteBrowser.EDGE,
			userAgent: 'Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0', available: false },
		{ name: 'Edge on iOS', browser: WebsiteBrowser.CHROME,
			userAgent: 'Mozilla/5.0 EdgiOS/140.0 Mobile Safari/605.1', available: true },
		{ name: 'Edge on Android', browser: WebsiteBrowser.CHROME,
			userAgent: 'Mozilla/5.0 EdgA/140.0 Mobile Safari/537.36', available: true },
	] ) {
		test.describe( () => {
			test.use( { contextOptions: {
				userAgent: scenario.userAgent,
				viewport: { width: 320, height: 800 },
			} } );

			test( `${ scenario.name }: exposes only available store destinations`, async ( { page } ) => {
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
					const alternatives = group.locator( '.store-alternatives [data-store]' );
					expect( await alternatives.count() ).toBe( 3 );
					expect( await alternatives.locator( 'img' ).count() ).toBe( 0 );
					for ( const alternative of await group.locator( '.store-alternatives a[data-store]' ).all() ) {
						expect( await alternative.getAttribute( 'data-store' ) ).not.toBe( scenario.browser );
						expect( await alternative.getAttribute( 'href' ) ).toMatch( /^https:\/\//u );
					}
					const unavailable = group.locator( '.store-alternatives [aria-disabled="true"]' );
					if ( scenario.available ) {
						expect( await primary.getAttribute( 'href' ) ).toMatch( /^https:\/\//u );
						expect( await primary.getAttribute( 'href' ) ).not.toContain( '#downloads' );
						expect( await primary.locator( 'img' ).count() ).toBe( 1 );
						expect( await unavailable.getAttribute( 'data-store' ) ).toBe( WebsiteBrowser.EDGE );
						expect( await unavailable.innerText() ).toContain( 'Coming soon' );
					} else {
						expect( await primary.getAttribute( 'href' ) ).toBeNull();
						expect( await primary.getAttribute( 'aria-disabled' ) ).toBe( 'true' );
						expect( await primary.innerText() ).toContain( 'Edge' );
						expect( await primary.innerText() ).toContain( 'Coming soon' );
						expect( await primary.locator( 'img' ).count() ).toBe( 0 );
						expect( await unavailable.count() ).toBe( 0 );
					}
					const headerPrimary = page.locator( '.site-header [data-download-primary]' );
					expect( await headerPrimary.getAttribute( 'href' ) ).toBe( await primary.getAttribute( 'href' ) );
					expect( await headerPrimary.getAttribute( 'data-store' ) ).toBe( scenario.browser );
				}
				expect( await page.evaluate(
					() => document.documentElement.scrollWidth <= window.innerWidth,
				) ).toBe( true );
				if ( ! scenario.available ) {
					const disabledControls = page.locator( '[data-download-primary][aria-disabled="true"]' );
					expect( await disabledControls.count() ).toBe( ( await groups.count() ) + 1 );
					const focusableCount = await page.locator( 'a[href], button, input, select, textarea, [tabindex]' )
						.evaluateAll( ( elements ) => elements.filter( ( element ) =>
							! ( element as HTMLElement ).matches( ':disabled, [tabindex="-1"]' )
						).length );
					for ( let index = 0; index <= focusableCount; index += 1 ) {
						await page.keyboard.press( 'Tab' );
						expect( await disabledControls.evaluateAll( ( elements ) =>
							elements.every( ( element ) => element !== document.activeElement )
						) ).toBe( true );
					}
				}
				expect( externalRequests ).toEqual( [] );
			} );
		} );
	}
} );
