import { Palette, ThemeMode } from '../../../apps/extension/src/domains/preferences/types';
import { SettingsDestination } from '../../../apps/extension/src/features/settings/services/settings-navigation/types';
import { expect, ExtensionOrigin, test } from '../helpers';
import { compareScreenshot, ScreenshotColorOptions } from '../helpers/compare-screenshot';

// New aggregate views supplement the unchanged original case inventory.
for ( const theme of [ ThemeMode.LIGHT, ThemeMode.DARK ] ) {
	for ( const width of [ 1280, 390 ] ) {
		test( `Statistics outcomes ${ String( width ) } ${ theme }`, async ( { page } ) => {
			await page.setViewportSize( { width, height: 1100 } );
			const appearance = new URLSearchParams( { theme, palette: Palette.BROWN } );
			await page.goto( `${ ExtensionOrigin }/apps/extension/src/features/settings/components/shell/__fixtures__/?${ appearance.toString() }#${ SettingsDestination.STATISTICS }` );
			await expect( page.locator( '.settings-statistics-site-list li' ) ).toHaveCount( 2 );
			await expect( page.locator( '.settings-statistics-daily .recharts-surface' ) ).toBeVisible();
			await expect( page.locator( '.settings-statistics-hourly .recharts-surface' ) ).toBeVisible();
			await expect( page.locator( 'html' ) ).toHaveAttribute( 'data-tocus-theme', theme );
			await page.evaluate( () => document.fonts.ready );
			const actual = await page.locator( '.settings-layout' ).screenshot( { caret: 'hide' } );
			const name = `statistics-outcomes-${ String( width ) }-${ theme }`;
			await test.info().attach( name, { body: actual, contentType: 'image/png' } );
			await compareScreenshot( actual, [ 'apps', 'extension', 'src', 'features', 'statistics', 'components',
				'settings-screen', '__snapshots__', 'chromium', `${ name }.png` ], ScreenshotColorOptions );
		} );
		test( `Statistics outcomes empty ${ String( width ) } ${ theme }`, async ( { page } ) => {
			await page.setViewportSize( { width, height: 1100 } );
			const appearance = new URLSearchParams( { theme, palette: Palette.BROWN } );
			await page.goto( `${ ExtensionOrigin }/apps/extension/src/features/settings/components/shell/__fixtures__/?${ appearance.toString() }#${ SettingsDestination.STATISTICS }` );
			await expect( page.locator( '.settings-statistics-site-list li' ) ).toHaveCount( 2 );
			await page.evaluate( () => {
				window.settingsTest.externalStatistics( { currentDate: '2026-09-14', firstRecordedDate: null,
					estimatedReclaimedMilliseconds: 0, focusedPauseMilliseconds: 0,
					reconsideredVisitCount: 0, completedWaitCount: 0, allowanceGrantedCount: 0, dailyTotals: [],
					visitOutcomes: { recordedFromDate: '2026-09-14', dailySites: [], dailyHours: [] },
				} );
			} );
			const daily = page.locator( '.settings-statistics-daily' );
			const outcomes = page.locator( '.settings-statistics-breakdowns' );
			await expect( page.locator( '.settings-metrics dd' ) ).toHaveText( [ '0', '0' ] );
			await expect( page.locator( '.settings-statistics-estimate dd' ) ).toHaveText( 'Not enough data yet' );
			await expect( page.locator( '.settings-statistics-empty' ) ).toHaveCount( 3 );
			await expect( daily.getByRole( 'heading', { name: 'No activity in this period', level: 3, exact: true } ) ).toBeVisible();
			await expect( daily.getByText( 'Your pauses and reconsidered visits will appear here.', { exact: true } ) ).toBeVisible();
			await expect( outcomes.getByText( 'No visit outcomes recorded in this period.', { exact: true } ) ).toBeVisible();
			await expect( outcomes.getByText( 'No reconsidered visits recorded in this period.', { exact: true } ) ).toBeVisible();
			await expect( outcomes.locator( '.settings-statistics-outcomes-legend' ) ).toHaveCount( 0 );
			await expect( page.locator( '.settings-statistics-summary .recharts-surface' ) ).toHaveCount( 0 );
			await expect( page.locator( 'html' ) ).toHaveAttribute( 'data-tocus-theme', theme );
			await page.evaluate( () => document.fonts.ready );
			const actual = await page.locator( '.settings-layout' ).screenshot( { caret: 'hide' } );
			const name = `statistics-outcomes-empty-${ String( width ) }-${ theme }`;
			await test.info().attach( name, { body: actual, contentType: 'image/png' } );
			await compareScreenshot( actual, [ 'apps', 'extension', 'src', 'features', 'statistics', 'components',
				'settings-screen', '__snapshots__', 'chromium', `${ name }.png` ], ScreenshotColorOptions );
		} );
	}
}
