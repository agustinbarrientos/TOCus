import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { MotionPreference } from './types';

const websiteOutput = new URL( '../../dist/', import.meta.url );
const nativeLanguages = [
	'English', 'Espa\u00f1ol (t\u00fa)', 'Espa\u00f1ol (vos)', 'Portugu\u00eas (Brasil)',
	'Portugu\u00eas (Portugal)', 'Italiano', 'Fran\u00e7ais', 'Deutsch',
	'\u65e5\u672c\u8a9e', '\u0420\u0443\u0441\u0441\u043a\u0438\u0439',
];

const websiteTest = test.extend( {
	/**
	 * Loads production website files while keeping each browser context isolated.
	 * @param fixtures - Runner-owned browser fixtures.
	 * @param fixtures.page - Isolated test page.
	 * @param use - Runs the language navigation scenario.
	 */
	page: async ( { page }, use ) => {
		await page.route( 'http://website.test/**', async ( route ) => {
			const url = new URL( route.request().url() );
			const path = url.pathname.endsWith( '/' ) ? `${ url.pathname }index.html` : url.pathname;
			await route.fulfill( { path: fileURLToPath( new URL( `.${ path }`, websiteOutput ) ) } );
		} );
		await use( page );
	},
} );

for ( const browserName of [ 'chromium', 'firefox', 'webkit' ] as const ) {
	const browserTest = websiteTest.extend( { browserName } );

	browserTest.describe( `${ browserName } header language navigation`, () => {
		browserTest.use( { contextOptions: {
			viewport: { width: 320, height: 360 }, reducedMotion: MotionPreference.REDUCE,
		} } );

		browserTest( 'keeps the menu beside downloading and navigates native names on a short screen', async ( { page } ) => {
			const header = page.locator( '.site-header' );
			const trigger = header.getByRole( 'button', { name: 'Website language: English', exact: true } );
			const menu = page.getByRole( 'menu' );
			await browserTest.step( 'Keep language selection beside the header download', async () => {
				await page.goto( 'http://website.test/' );
				await expect( page.locator( '.homepage' ) ).toHaveAttribute( 'data-enhanced', 'true' );
				await expect( trigger ).toBeVisible();
				await expect( header.locator( '[data-download-primary]' ) ).toHaveAttribute( 'href', /^https:/u );
				await expect( page.locator( '.site-footer .language-shortcut' ) ).toHaveCount( 0 );
				expect( await page.evaluate( () => document.documentElement.scrollWidth <= innerWidth ) ).toBe( true );
			} );
			await browserTest.step( 'Bound the native-language menu and return focus after Escape', async () => {
				await trigger.click();
				await expect( menu ).toBeVisible();
				await expect( menu.getByRole( 'menuitem' ) ).toHaveText( nativeLanguages );
				await expect( menu.locator( '[aria-current="page"]' ) ).toHaveText( 'English' );
				expect( await menu.evaluate( ( element ) => {
					const bounds = element.getBoundingClientRect();
					return bounds.left >= 0 && bounds.right <= innerWidth &&
						bounds.top >= 0 && bounds.bottom <= innerHeight;
				} ) ).toBe( true );
				await page.keyboard.press( 'Escape' );
				await expect( menu ).toBeHidden();
				await expect( trigger ).toBeFocused();
			} );
			await browserTest.step( 'Choose Argentine Spanish with the keyboard', async () => {
				await page.keyboard.press( 'Enter' );
				await expect( menu ).toBeVisible();
				await expect.poll( () => menu.evaluate(
					( element ) => element.contains( document.activeElement ),
				) ).toBe( true );
				await page.keyboard.press( 'ArrowDown' );
				await expect( menu.getByRole( 'menuitem', { name: 'English', exact: true } ) ).toBeFocused();
				await page.keyboard.press( 'ArrowDown' );
				await page.keyboard.press( 'ArrowDown' );
				await expect( menu.getByRole( 'menuitem', { name: 'Espa\u00f1ol (vos)', exact: true } ) ).toBeFocused();
				await page.keyboard.press( 'Enter' );
				await expect( page ).toHaveURL( 'http://website.test/es-ar/' );
				await expect( page.locator( 'html' ) ).toHaveAttribute( 'lang', 'es-AR' );
			} );
			await browserTest.step( 'Indicate the new locale and choose German by pointer', async () => {
				const localizedTrigger = header.locator( '.language-shortcut' );
				await expect( localizedTrigger ).toHaveAttribute( 'aria-label', /Espa\u00f1ol \(vos\)/u );
				await localizedTrigger.click();
				await expect( menu.locator( '[aria-current="page"]' ) ).toHaveText( 'Espa\u00f1ol (vos)' );
				await menu.getByRole( 'menuitem', { name: 'Deutsch', exact: true } ).click();
				await expect( page ).toHaveURL( 'http://website.test/de/' );
			} );
		} );

		browserTest.describe( 'without JavaScript', () => {
			browserTest.use( { javaScriptEnabled: false } );
			browserTest( 'keeps every native language link available with the current locale indicated', async ( { page } ) => {
				await page.goto( 'http://website.test/' );
				const languages = page.locator( '#languages' );
				await expect( languages.getByRole( 'link' ) ).toHaveText( nativeLanguages );
				await expect( languages.locator( '[aria-current="page"]' ) ).toHaveText( 'English' );
				await languages.getByRole( 'link', { name: 'Fran\u00e7ais', exact: true } ).click();
				await expect( page ).toHaveURL( 'http://website.test/fr/' );
				await expect( page.locator( 'html' ) ).toHaveAttribute( 'lang', 'fr' );
				await expect( languages.locator( '[aria-current="page"]' ) ).toHaveText( 'Fran\u00e7ais' );
			} );
		} );
	} );
}
