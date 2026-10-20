import { ThemeMode } from '../../../apps/extension/src/domains/preferences/types';
import { expect, ExtensionOrigin, test } from '../helpers';
import { compareScreenshot, ScreenshotColorOptions } from '../helpers/compare-screenshot';

for ( const theme of [ ThemeMode.LIGHT, ThemeMode.DARK ] ) {
	for ( const width of [ 736, 320 ] ) {
		test( `Website exceptions ${ String( width ) } ${ theme }`, async ( { page } ) => {
			await page.setViewportSize( { width: width + 64, height: 900 } );
			const parameters = new URLSearchParams( {
				original: `protected-site-list-exceptions-${ theme }`, width: String( width ),
			} );
			await page.goto( `${ ExtensionOrigin }/apps/extension/src/features/settings/components/shell/__fixtures__/site-list.html?${ parameters }` );
			await expect( page.getByRole( 'heading', { name: 'YouTube', exact: true } ) ).toBeVisible();
			await expect( page.locator( '.settings-site-exception' ) ).toHaveCount( 3 );
			await expect( page.getByText( 'Exceptions', { exact: true } ) ).toBeVisible();
			await expect( page.getByText( 'Custom pause timing', { exact: true } ) ).toBeVisible();
			await expect( page.getByText( 'No pause', { exact: true } ) ).toBeVisible();
			await page.evaluate( () => document.fonts.ready );
			const actual = await page.locator( '.settings-site-groups' ).screenshot( { caret: 'hide' } );
			const name = `website-exceptions-${ String( width ) }-${ theme }`;
			await test.info().attach( name, { body: actual, contentType: 'image/png' } );
			await compareScreenshot( actual, [ 'apps', 'extension', 'src', 'features', 'protected-sites', 'components',
				'site-list', '__snapshots__', 'chromium', `${ name }.png` ], ScreenshotColorOptions );
		} );
	}
}
