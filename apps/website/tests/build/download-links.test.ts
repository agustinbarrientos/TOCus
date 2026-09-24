import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { DownloadStores, getDownloadStore, WebsiteBrowser } from '../../src/config/downloads';

const WebsiteOutput = new URL( '../../dist/', import.meta.url );

test.describe( 'browser-specific download links', () => {
	test.use( { reducedMotion: 'reduce' } );
	for ( const [ locale, chromeLocale, edgeLocale, firefoxLocale ] of [
		[ '', 'en', 'en-US', 'en-US' ],
		[ 'es', 'es', 'es-ES', 'es-ES' ],
		[ 'es-ar', 'es-419', 'es-MX', 'es-AR' ],
		[ 'pt-br', 'pt-BR', 'pt-BR', 'pt-BR' ],
		[ 'pt-pt', 'pt-PT', 'pt-PT', 'pt-PT' ],
		[ 'fr', 'fr', 'fr-FR', 'fr' ],
		[ 'it', 'it', 'it-IT', 'it' ],
		[ 'de', 'de', 'de-DE', 'de' ],
		[ 'ja', 'ja', 'ja-JP', 'ja' ],
		[ 'ru', 'ru', 'ru-RU', 'ru' ],
	] as const ) {
		test( `${ locale || 'en' }: small-screen alternative browser icons stay together`, async ( { page } ) => {
			const html = readFileSync( new URL( `${ locale ? `${ locale }/` : '' }index.html`, WebsiteOutput ), 'utf8' );
			expect( html ).toContain( `https://chromewebstore.google.com/detail/tocus/gagjpniodbnbjdggjlkliabjffcnnfmh?hl=${ chromeLocale }` );
			expect( html ).toContain( `https://microsoftedge.microsoft.com/addons/detail/ifpmfcopmabjjgggeefgoejnlbjpaehh?hl=${ edgeLocale }` );
			expect( html ).toContain( `https://addons.mozilla.org/${ firefoxLocale }/firefox/addon/tocus/` );
			expect( html ).not.toContain( 'apps.apple.com' );
			expect( html ).not.toContain( 'browser-safari' );
			await page.route( '**/*', async ( route ) => {
				const url = new URL( route.request().url() );
				if ( url.origin !== 'http://website.test' ) {
					await route.abort();
					return;
				}
				const path = url.pathname.endsWith( '/' ) ? `${ url.pathname }index.html` : url.pathname;
				await route.fulfill( { path: fileURLToPath( new URL( `.${ path }`, WebsiteOutput ) ) } );
			} );
			await page.goto( `http://website.test/${ locale ? `${ locale }/` : '' }` );
			await expect( page.locator( '.homepage' ) ).toHaveAttribute( 'data-enhanced', 'true' );
			for ( const group of await page.locator( '.store-links' ).all() ) {
				await expect( group.locator( 'a[data-store="chrome"]' ) ).toHaveAttribute( 'href',
					`https://chromewebstore.google.com/detail/tocus/gagjpniodbnbjdggjlkliabjffcnnfmh?hl=${ chromeLocale }` );
				await expect( group.locator( 'a[data-store="firefox"]' ) ).toHaveAttribute( 'href',
					`https://addons.mozilla.org/${ firefoxLocale }/firefox/addon/tocus/` );
				await expect( group.locator( 'a[data-store="edge"]' ) ).toHaveAttribute( 'href',
					`https://microsoftedge.microsoft.com/addons/detail/ifpmfcopmabjjgggeefgoejnlbjpaehh?hl=${ edgeLocale }` );
			}
			await page.evaluate( () => document.fonts.ready );
			const groups = page.locator( '.store-alternatives' );
			await expect( groups ).toHaveCount( 2 );
			for ( const width of [ 320, 390 ] ) {
				await page.setViewportSize( { width, height: 844 } );
				for ( const group of await groups.all() ) {
					const links = group.locator( '[data-store]' );
					await expect( links ).toHaveCount( 2 );
					const bounds = await links.evaluateAll( ( elements ) => elements.map( ( element ) => {
						const { top, left, right } = element.getBoundingClientRect();
						return { top, left, right };
					} ) );
					expect( new Set( bounds.map( ( item ) => item.top ) ).size ).toBe( 1 );
					for ( const item of bounds ) {
						expect( item.left ).toBeGreaterThanOrEqual( 0 );
						expect( item.right ).toBeLessThanOrEqual( width );
					}
				}
			}
		} );
	}

	test( 'alternative browser names hide only on small screens while links remain accessible and easy to tap', async ( { page } ) => {
		await page.route( '**/*', async ( route ) => {
			const url = new URL( route.request().url() );
			if ( url.origin !== 'http://website.test' ) {
				await route.abort();
				return;
			}
			const path = url.pathname.endsWith( '/' ) ? `${ url.pathname }index.html` : url.pathname;
			await route.fulfill( { path: fileURLToPath( new URL( `.${ path }`, WebsiteOutput ) ) } );
		} );
		await page.setViewportSize( { width: 320, height: 844 } );
		await page.goto( 'http://website.test/' );
		await expect( page.locator( '.homepage' ) ).toHaveAttribute( 'data-enhanced', 'true' );
		const groups = page.locator( '.store-links' );
		await expect( groups ).toHaveCount( 2 );
		const alternatives = Object.values( DownloadStores )
			.map( ( entry ) => getDownloadStore( entry.browser ) )
			.filter( ( entry ) => entry.browser !== WebsiteBrowser.CHROME );
		for ( const width of [ 320, 560, 561, 960 ] ) {
			await page.setViewportSize( { width, height: 844 } );
			for ( const group of await groups.all() ) {
				await expect( group.locator( '[data-download-primary]' ) ).toHaveText( /Download for Chrome/u );
				for ( const store of alternatives ) {
					const link = group.getByRole( 'link', { name: store.name, exact: true } );
					await expect( link ).toBeVisible();
					await expect( link ).toHaveAttribute( 'href', String( store.href ) );
					await expect( link.locator( 'img' ) ).toBeVisible();
					const label = link.locator( '.store-alternative-name' );
					await expect( label ).toHaveCount( 1 );
					if ( width <= 560 ) {
						await expect( label ).toBeHidden();
						const bounds = await link.boundingBox();
						expect( bounds?.width ).toBeGreaterThanOrEqual( 44 );
						expect( bounds?.height ).toBeGreaterThanOrEqual( 44 );
					} else {
						await expect( label ).toBeVisible();
						await expect( label ).toHaveText( store.name );
					}
				}
			}
			expect( await page.evaluate( () => document.documentElement.scrollWidth <= innerWidth ) ).toBe( true );
		}
	} );

	for ( const scenario of [
		{ name: 'Chrome desktop', browser: WebsiteBrowser.CHROME,
			userAgent: 'Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36' },
		{ name: 'Firefox desktop', browser: WebsiteBrowser.FIREFOX,
			userAgent: 'Mozilla/5.0 Firefox/140.0' },
		{ name: 'Safari desktop falls back to Chrome', browser: WebsiteBrowser.CHROME,
			userAgent: 'Mozilla/5.0 Version/18.0 Safari/605.1.15' },
		{ name: 'Unknown browser falls back to Chrome', browser: WebsiteBrowser.CHROME,
			userAgent: 'UnknownBrowser/1.0' },
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

			test( `${ scenario.name }: exposes the configured store destinations`, async ( { page } ) => {
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
					expect( await alternatives.count() ).toBe( 2 );
					await expect( alternatives.locator( 'img' ) ).toHaveCount( 2 );
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
					await expect( primary ).toHaveAttribute( 'href', String( getDownloadStore( scenario.browser ).href ) );
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
