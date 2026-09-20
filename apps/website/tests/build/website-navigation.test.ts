import { fileURLToPath } from 'node:url';
import { expect, test, type Locator } from '@playwright/test';

const WebsiteOutput = new URL( '../../dist/', import.meta.url );

/**
 * Waits for the menu's asynchronous focus trap before sending dropdown keyboard commands.
 * @param menu - Visible language dropdown whose keyboard handler needs the focused target.
 */
async function waitForMenuFocus( menu: Locator ): Promise<void> {
	await expect.poll( () => menu.evaluate( ( element ) => element.contains( document.activeElement ) ), {
		timeout: 5000,
	} ).toBe( true );
}

test.describe( 'website navigation and statistics presentation', () => {
	for ( const engine of [ 'chromium', 'firefox', 'webkit' ] as const ) {
		const engineTest = test.extend( { browserName: engine } );

		engineTest.describe( () => {
			engineTest.use( { contextOptions: {
				viewport: { width: 390, height: 844 }, colorScheme: 'dark',
			} } );

			engineTest( `${ engine }: light pages keep the header focused on downloading and locales reachable`, async ( { page } ) => {
				engineTest.setTimeout( 30_000 );
				await page.route( 'http://website.test/**', async ( route ) => {
					const url = new URL( route.request().url() );
					const path = url.pathname.endsWith( '/' ) ? `${ url.pathname }index.html` : url.pathname;
					await route.fulfill( { path: fileURLToPath( new URL( `.${ path }`, WebsiteOutput ) ) } );
				} );
				await engineTest.step( 'Load the light header and hydrate navigation', async () => {
					await page.goto( 'http://website.test/' );
					const header = page.locator( '.site-header' );
					expect( await header.locator( 'a' ).count() ).toBe( 1 );
					expect( await header.locator( 'a' ).getAttribute( 'href' ) ).toMatch( /^https:/u );
					expect( await page.locator( '.website' ).evaluate( ( element ) =>
						getComputedStyle( element ).getPropertyValue( 'color-scheme' ) ) ).toBe( 'light' );
					await page.waitForFunction(
						() => document.querySelector( '.homepage' )?.getAttribute( 'data-enhanced' ) === 'true',
						undefined,
						{ timeout: 5000 },
					);
					await expect( header.locator( 'button' ) ).toHaveCount( 1 );
				} );
				const languageButton = page.locator( '.site-header .language-shortcut' );
				await languageButton.scrollIntoViewIfNeeded();
				await languageButton.focus();
				const scrollPosition = await page.evaluate( () => window.scrollY );
				const languageMenu = page.getByRole( 'menu' );
				await engineTest.step( 'Open and dismiss the language menu without scrolling', async () => {
					await page.keyboard.press( 'Enter' );
					await languageMenu.waitFor( { state: 'visible', timeout: 5000 } );
					await waitForMenuFocus( languageMenu );
					await expect( languageMenu ).toBeVisible();
					expect( await page.evaluate( () => window.scrollY ) ).toBe( scrollPosition );
					await page.keyboard.press( 'Escape' );
					await languageMenu.waitFor( { state: 'hidden', timeout: 5000 } );
					await expect( languageMenu ).toBeHidden();
					await page.waitForFunction(
						() => document.activeElement?.classList.contains( 'language-shortcut' ),
						undefined,
						{ timeout: 5000 },
					);
					expect( await languageButton.evaluate(
						( element ) => element === document.activeElement,
					) ).toBe( true );
					expect( await page.evaluate( () => window.scrollY ) ).toBe( scrollPosition );
				} );
				await engineTest.step( 'Choose Argentine Spanish with the keyboard', async () => {
					await page.keyboard.press( 'Enter' );
					const languageOptions = page.getByRole( 'menuitem' );
					await languageMenu.waitFor( { state: 'visible', timeout: 5000 } );
					await waitForMenuFocus( languageMenu );
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
					const language = page.getByRole( 'menuitem', { name: 'Espa\u00f1ol (vos)' } );
					await page.waitForFunction(
						() => document.activeElement?.textContent.trim() === 'Espa\u00f1ol (vos)',
						undefined,
						{ timeout: 5000 },
					);
					expect( await language.evaluate( ( element ) => element === document.activeElement ) ).toBe( true );
					await page.keyboard.press( 'Enter' );
					await page.waitForURL( '**/es-ar/' );
					expect( await page.locator( 'html' ).getAttribute( 'lang' ) ).toBe( 'es-AR' );
					await expect( page.locator( '.site-header .language-shortcut' ) )
						.toHaveAttribute( 'aria-label', /Espa\u00f1ol \(vos\)/u );
					expect( await page.locator( '.site-header a' ).getAttribute( 'href' ) ).toMatch( /^https:/u );
				} );
			} );
		} );
	}

	test( 'statistics show product metrics without collecting data', async ( { page } ) => {
		test.setTimeout( 30_000 );
		await page.route( 'http://website.test/**', async ( route ) => {
			const url = new URL( route.request().url() );
			const path = url.pathname.endsWith( '/' ) ? `${ url.pathname }index.html` : url.pathname;
			await route.fulfill( { path: fileURLToPath( new URL( `.${ path }`, WebsiteOutput ) ) } );
		} );
		await page.goto( 'http://website.test/' );
		const statistics = page.locator( '#statistics' );
		await statistics.waitFor( { timeout: 5000 } );
		await expect( statistics.getByRole( 'heading', { name: 'See how much time you saved', exact: true } ) )
			.toBeVisible();
		await expect( page.getByText( 'Example data', { exact: true } ) ).toHaveCount( 0 );
		await expect( page.getByText( 'Example timing', { exact: true } ) ).toHaveCount( 0 );
		expect( await statistics.locator( 'dt' ).count() ).toBe( 5 );
		await expect( statistics.locator( 'dt' ).filter( { hasText: /^Estimated time reclaimed$/ } ) ).toHaveCount( 1 );
		await expect( statistics.getByRole( 'columnheader', { name: 'Estimated time reclaimed', exact: true } ) )
			.toHaveCount( 1 );
		expect( await statistics.getByText( 'Reconsidered visits', { exact: true } ).count() ).toBe( 1 );
		expect( await page.evaluate( () => ( { local: localStorage.length, session: sessionStorage.length } ) ) )
			.toEqual( { local: 0, session: 0 } );
	} );
} );
