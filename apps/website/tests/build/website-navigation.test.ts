import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';
import { describe, expect, test } from 'vitest';

const WebsiteOutput = new URL( '../../dist/', import.meta.url );

describe( 'website navigation and statistics presentation', () => {
	for ( const engine of [ chromium, firefox, webkit ] ) {
		test( `${ engine.name() }: light pages keep the header focused on downloading and locales reachable`, async () => {
			const browser = await engine.launch();
			try {
				const page = await browser.newPage( {
					viewport: { width: 390, height: 844 }, colorScheme: 'dark',
				} );
				await page.route( 'http://website.test/**', async ( route ) => {
					const url = new URL( route.request().url() );
					const path = url.pathname.endsWith( '/' ) ? `${ url.pathname }index.html` : url.pathname;
					await route.fulfill( { path: fileURLToPath( new URL( `.${ path }`, WebsiteOutput ) ) } );
				} );
				await page.goto( 'http://website.test/' );
				const header = page.locator( '.site-header' );
				expect( await header.locator( 'a' ).count() ).toBe( 1 );
				expect( await header.locator( 'button' ).count() ).toBe( 0 );
				expect( await header.locator( 'a' ).getAttribute( 'href' ) ).toMatch( /^https:/u );
				expect( await page.locator( '.website' ).evaluate( ( element ) =>
					getComputedStyle( element ).getPropertyValue( 'color-scheme' ) ) ).toBe( 'light' );
				await page.waitForFunction(
					() => document.querySelector( '.homepage' )?.getAttribute( 'data-enhanced' ) === 'true',
					undefined,
					{ timeout: 5000 },
				);
				const languageButton = page.locator( '#languages .language-shortcut' );
				await languageButton.scrollIntoViewIfNeeded();
				await languageButton.focus();
				const scrollPosition = await page.evaluate( () => window.scrollY );
				await page.keyboard.press( 'Enter' );
				const languageMenu = page.getByRole( 'menu' );
				await languageMenu.waitFor( { state: 'visible', timeout: 5000 } );
				expect( await languageMenu.isVisible() ).toBe( true );
				expect( await page.evaluate( () => window.scrollY ) ).toBe( scrollPosition );
				await page.keyboard.press( 'Escape' );
				await languageMenu.waitFor( { state: 'hidden', timeout: 5000 } );
				expect( await languageMenu.isVisible() ).toBe( false );
				await page.waitForFunction(
					() => document.activeElement?.classList.contains( 'language-shortcut' ),
					undefined,
					{ timeout: 5000 },
				);
				expect( await languageButton.evaluate(
					( element ) => element === document.activeElement,
				) ).toBe( true );
				expect( await page.evaluate( () => window.scrollY ) ).toBe( scrollPosition );
				await page.keyboard.press( 'Enter' );
				const languageOptions = page.getByRole( 'menuitem' );
				await languageMenu.waitFor( { state: 'visible', timeout: 5000 } );
				expect( await languageOptions.count() ).toBe( 10 );
				await page.keyboard.press( 'ArrowDown' );
				await page.waitForFunction(
					() => document.activeElement?.getAttribute( 'role' ) === 'menuitem',
					undefined,
					{ timeout: 5000 },
				);
				expect( await languageOptions.first().evaluate(
					( element ) => element === document.activeElement,
				) ).toBe( true );
				await page.keyboard.press( 'ArrowDown' );
				await page.keyboard.press( 'ArrowDown' );
				const language = page.getByRole( 'menuitem', { name: 'Español (vos)' } );
				await page.waitForFunction(
					() => document.activeElement?.textContent.trim() === 'Español (vos)',
					undefined,
					{ timeout: 5000 },
				);
				expect( await language.evaluate( ( element ) => element === document.activeElement ) ).toBe( true );
				await page.keyboard.press( 'Enter' );
				await page.waitForURL( '**/es-ar/' );
				expect( await page.locator( 'html' ).getAttribute( 'lang' ) ).toBe( 'es-AR' );
				expect( await page.locator( '#languages .language-shortcut' ).innerText() ).toBe( 'Español (vos)' );
				expect( await page.locator( '.site-header a' ).getAttribute( 'href' ) ).toMatch( /^https:/u );
			} finally {
				await browser.close();
			}
		}, 30_000 );
	}

	test( 'statistics are explicitly illustrative and expose the real product metrics without collecting data', async () => {
		const browser = await chromium.launch();
		try {
			const page = await browser.newPage();
			await page.route( 'http://website.test/**', async ( route ) => {
				const url = new URL( route.request().url() );
				const path = url.pathname.endsWith( '/' ) ? `${ url.pathname }index.html` : url.pathname;
				await route.fulfill( { path: fileURLToPath( new URL( `.${ path }`, WebsiteOutput ) ) } );
			} );
			await page.goto( 'http://website.test/' );
			const statistics = page.locator( '#statistics' );
			await statistics.waitFor( { timeout: 5000 } );
			expect( await statistics.getByText( 'Example data', { exact: true } ).count() ).toBe( 1 );
			expect( await statistics.locator( 'dt' ).count() ).toBe( 5 );
			expect( await statistics.getByText( 'Estimated time reclaimed', { exact: true } ).count() ).toBe( 1 );
			expect( await statistics.getByText( 'Reconsidered visits', { exact: true } ).count() ).toBe( 1 );
			expect( await page.evaluate( () => ( { local: localStorage.length, session: sessionStorage.length } ) ) )
				.toEqual( { local: 0, session: 0 } );
		} finally {
			await browser.close();
		}
	}, 30_000 );
} );
