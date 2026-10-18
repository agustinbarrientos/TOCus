import { Palette, ThemeMode } from '../../../apps/extension/src/domains/preferences/types';
import { SettingsDestination } from '../../../apps/extension/src/features/settings/services/settings-navigation/types';
import { expect, ExtensionOrigin, test } from '../helpers';
import { compareScreenshot, ScreenshotColorOptions } from '../helpers/compare-screenshot';

// New aggregate views supplement the unchanged original case inventory.
for ( const theme of [ ThemeMode.LIGHT, ThemeMode.DARK ] ) {
	for ( const width of [ 1280, 390 ] ) {
		test( `Statistics outcomes ${ String( width ) } ${ theme }`, async ( { page } ) => {
			await page.setViewportSize( { width, height: 1100 } );
			await page.goto( `${ ExtensionOrigin }/apps/extension/src/features/settings/components/shell/__fixtures__/#${ SettingsDestination.STATISTICS }` );
			await page.evaluate( ( { theme, palette } ) => {
				window.settingsTest.externalPreferences( { theme, palette } );
			}, { theme, palette: Palette.BROWN } );
			await expect( page.locator( 'html' ) ).toHaveAttribute( 'data-tocus-theme', theme );
			await expect( page.locator( '.settings-statistics-site-list li' ) ).toHaveCount( 2 );
			await expect( page.locator( '.settings-statistics-daily .recharts-surface' ) ).toBeVisible();
			await expect( page.locator( '.settings-statistics-hourly .recharts-surface' ) ).toBeVisible();
			await page.evaluate( () => document.fonts.ready );
			const actual = await page.locator( '.settings-layout' ).screenshot( { caret: 'hide' } );
			const name = `statistics-outcomes-${ String( width ) }-${ theme }`;
			await test.info().attach( name, { body: actual, contentType: 'image/png' } );
			await compareScreenshot( actual, [ 'apps', 'extension', 'src', 'features', 'statistics', 'components',
				'settings-screen', '__snapshots__', 'chromium', `${ name }.png` ], ScreenshotColorOptions );
		} );
	}
}
