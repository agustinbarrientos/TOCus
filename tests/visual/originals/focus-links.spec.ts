import { Palette, ThemeMode } from '../../../apps/extension/src/domains/preferences/types';
import { SettingsDestination } from '../../../apps/extension/src/features/settings/services/settings-navigation/types';
import { expect, ExtensionOrigin, test } from '../helpers';
import { compareScreenshot, ScreenshotColorOptions } from '../helpers/compare-screenshot';

// New feature references supplement the immutable pre-migration inventory.
for ( const theme of [ ThemeMode.LIGHT, ThemeMode.DARK ] ) {
	for ( const empty of [ false, true ] ) {
		test( `Focus links ${ empty ? 'empty ' : '' }settings ${ theme }`, async ( { page } ) => {
			await page.setViewportSize( { width: 1280, height: 1100 } );
			await page.goto( `${ ExtensionOrigin }/apps/extension/src/features/settings/components/shell/__fixtures__/#${ SettingsDestination.FOCUS_LINKS }` );
			await expect( page.getByRole( 'heading', { name: 'Focus links', exact: true } ) ).toBeVisible();
			await page.evaluate( ( { theme, palette, empty } ) => {
				window.settingsTest.externalPreferences( { theme, palette, focusLinks: empty ? [] : [
					{ id: 'focus_link_tasks', label: 'My task list', url: 'https://example.com/tasks' },
					{ id: 'focus_link_project', label: 'Current project', url: 'https://example.com/project' },
					{ id: 'focus_link_reading', label: 'Read a chapter', url: 'https://example.com/reading' },
				] } );
			}, { theme, palette: Palette.BROWN, empty } );
			await expect( page.locator( 'html' ) ).toHaveAttribute( 'data-tocus-theme', theme );
			if ( empty ) {
				await expect( page.getByRole( 'heading', { name: 'No websites yet', exact: true } ) ).toBeVisible();
				await expect( page.getByRole( 'button', { name: 'Add site', exact: true } ) ).toBeVisible();
			} else {
				await expect( page.getByLabel( 'Label', { exact: true } ).nth( 2 ) ).toHaveValue( 'Read a chapter' );
				await expect( page.getByRole( 'button', { name: 'Add site', exact: true } ) ).toHaveCount( 0 );
			}
			await page.evaluate( () => document.fonts.ready );
			const actual = await page.locator( '.settings-layout' ).screenshot( { caret: 'hide' } );
			await test.info().attach( `focus-links-${ empty ? 'empty-' : '' }${ theme }`, { body: actual, contentType: 'image/png' } );
			await compareScreenshot( actual, [ 'apps', 'extension', 'src', 'features', 'settings', 'components',
				'focus-links-screen', '__snapshots__', 'chromium', `focus-links-${ empty ? 'empty-' : '' }${ theme }.png` ], ScreenshotColorOptions );
		} );
	}
}
