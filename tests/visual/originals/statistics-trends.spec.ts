import { Palette, ThemeMode } from '../../../apps/extension/src/domains/preferences/types';
import { SettingsDestination } from '../../../apps/extension/src/features/settings/services/settings-navigation/types';
import { expect, ExtensionOrigin, test } from '../helpers';
import { compareScreenshot, ScreenshotColorOptions } from '../helpers/compare-screenshot';

for ( const theme of [ ThemeMode.LIGHT, ThemeMode.DARK ] ) {
	for ( const width of [ 1280, 390 ] ) {
		test( `Statistics trends ${ String( width ) } ${ theme }`, async ( { page } ) => {
			await page.setViewportSize( { width, height: 1100 } );
			const query = new URLSearchParams( { theme, palette: Palette.BROWN, trends: '1' } );
			await page.goto( `${ ExtensionOrigin }/apps/extension/src/features/settings/components/shell/__fixtures__/?${ query.toString() }#${ SettingsDestination.STATISTICS }` );
			const period = page.getByRole( 'button', { name: 'Period: Current week', exact: true } );
			await period.click();
			await page.getByRole( 'switch', { name: 'Compare with previous period', exact: true } ).check();
			await page.keyboard.press( 'Escape' );
			await expect( page.locator( '.settings-statistics-trend-tag' ) ).toHaveText( [
				'20% more than last week', '20% fewer than last week',
			] );
			await expect( page.locator( '.settings-statistics-outcome-summary-row' ) ).toHaveCount( 2 );
			await page.evaluate( () => document.fonts.ready );
			const actual = await page.locator( '.settings-layout' ).screenshot( { caret: 'hide' } );
			const name = `statistics-trends-${ String( width ) }-${ theme }`;
			await test.info().attach( name, { body: actual, contentType: 'image/png' } );
			await compareScreenshot( actual, [ 'apps', 'extension', 'src', 'features', 'statistics', 'components',
				'settings-screen', '__snapshots__', 'chromium', `${ name }.png` ], ScreenshotColorOptions );
		} );
	}
}
