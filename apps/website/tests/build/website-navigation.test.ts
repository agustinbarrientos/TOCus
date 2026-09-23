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

test.describe( 'website navigation and statistics explanation', () => {
	test.use( { reducedMotion: 'reduce' } );
	for ( const engine of [ 'chromium', 'firefox', 'webkit' ] as const ) {
		const engineTest = test.extend( { browserName: engine } );

		engineTest.describe( () => {
			engineTest.use( { contextOptions: {
				viewport: { width: 390, height: 844 }, colorScheme: 'dark', reducedMotion: 'reduce',
			} } );

			engineTest( `${ engine }: light pages keep a minimal header and locales reachable`, async ( { page } ) => {
				engineTest.setTimeout( 30_000 );
				await page.route( 'http://website.test/**', async ( route ) => {
					const url = new URL( route.request().url() );
					const path = url.pathname.endsWith( '/' ) ? `${ url.pathname }index.html` : url.pathname;
					await route.fulfill( { path: fileURLToPath( new URL( `.${ path }`, WebsiteOutput ) ) } );
				} );
				await engineTest.step( 'Load the light header and hydrate navigation', async () => {
					await page.goto( 'http://website.test/' );
					const header = page.locator( '.site-header' );
					await expect( header.locator( 'a' ) ).toHaveCount( 0 );
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
					await expect( page.locator( '.site-header [data-download-primary]' ) ).toHaveCount( 0 );
				} );
			} );
		} );
	}

	test( 'statistics are explained without example totals or visitor metrics', async ( { page } ) => {
		await page.route( 'http://website.test/**', async ( route ) => {
			const url = new URL( route.request().url() );
			const path = url.pathname.endsWith( '/' ) ? `${ url.pathname }index.html` : url.pathname;
			await route.fulfill( { path: fileURLToPath( new URL( `.${ path }`, WebsiteOutput ) ) } );
		} );
		await page.goto( 'http://website.test/' );
		await expect( page.locator( '.homepage' ) ).toHaveAttribute( 'data-enhanced', 'true' );
		const statistics = page.locator( '#features .feature-grid > li' ).filter( {
			has: page.getByRole( 'heading', { name: 'Check how much time you\u2019ve saved', exact: true } ),
		} );
		await expect( statistics ).toBeVisible();
		await expect( statistics.locator( 'p' ) ).not.toHaveText( /^\s*$/u );
		await expect( statistics.locator( '.feature-detail' ) ).toHaveCount( 0 );
		await expect( statistics ).not.toContainText( /24h 40m|254 reconsidered visits|Example:/u );
		await expect( statistics.locator( 'select, button, table, canvas, [role="application"]' ) ).toHaveCount( 0 );
		expect( await page.evaluate( () => ( { local: localStorage.length, session: sessionStorage.length } ) ) )
			.toEqual( { local: 0, session: 0 } );
	} );
} );
