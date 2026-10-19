import { expect } from '@playwright/test';
import { test } from '../../../settings/utils/browser-test-harness';
import { SettingsDestination } from '../../../settings/services/settings-navigation/types';
import { StatisticsRange } from '../../utils/select-statistics-range/types';
import { Language } from '../../../../domains/preferences/types';

test.describe( 'statistics period comparisons', () => {
	test( 'keeps every comparison behind the period switch and shows exact two-line trend details', async ( { open } ) => {
		const page = await open( SettingsDestination.STATISTICS );
		await page.evaluate( () => {
			window.settingsTest.externalStatistics( {
				currentDate: '2026-10-18', firstRecordedDate: '2026-10-01',
				dailyTotals: [
					{ date: '2026-10-05', estimatedReclaimedMilliseconds: 60_000, focusedPauseMilliseconds: 60_000,
						reconsideredVisitCount: 20, completedWaitCount: 35, allowanceGrantedCount: 1 },
					{ date: '2026-10-12', estimatedReclaimedMilliseconds: 120_000, focusedPauseMilliseconds: 60_000,
						reconsideredVisitCount: 24, completedWaitCount: 28, allowanceGrantedCount: 1 },
				],
				visitOutcomes: { recordedFromDate: '2026-10-01',
					dailySites: [
						{ date: '2026-10-05', siteHost: 'youtube.com', reconsideredVisitCount: 20, visitedAfterPauseCount: 20 },
						{ date: '2026-10-12', siteHost: 'youtube.com', reconsideredVisitCount: 24, visitedAfterPauseCount: 8 },
					],
					dailyHours: [
						{ date: '2026-10-05', hour: 9, reconsideredVisitCount: 20 },
						{ date: '2026-10-12', hour: 9, reconsideredVisitCount: 24 },
					],
				},
			} );
		} );
		const trigger = page.getByRole( 'button', { name: 'Period: Current week', exact: true } );
		const tags = page.locator( '.settings-statistics-trend-tag' );
		const summaryRows = page.locator( '.settings-statistics-outcome-summary-row' );
		await expect( trigger ).toBeVisible();
		await expect( tags ).toHaveCount( 0 );
		await expect( summaryRows ).toHaveCount( 1 );
		await trigger.click();
		const comparison = page.getByRole( 'switch', { name: 'Compare with previous period', exact: true } );
		await expect( comparison ).not.toBeChecked();
		await comparison.check();
		await page.keyboard.press( 'Escape' );
		await expect( trigger ).toBeFocused();
		await expect( trigger ).toContainText( 'vs previous period' );
		await expect( tags ).toHaveText( [ '20% more than last week', '20% fewer than last week' ] );
		await expect( summaryRows ).toHaveCount( 2 );
		await tags.last().focus();
		const tooltip = page.getByRole( 'tooltip' );
		await expect( tooltip ).toHaveText( 'Oct 12\u2009\u2013\u200918, 2026: 28\nOct 5\u2009\u2013\u200911, 2026: 35' );
		await expect( tooltip ).toHaveCSS( 'white-space', 'pre-line' );
		await trigger.click();
		await comparison.uncheck();
		await page.keyboard.press( 'Escape' );
		await expect( tags ).toHaveCount( 0 );
		await expect( summaryRows ).toHaveCount( 1 );
		await expect( trigger ).not.toContainText( 'vs previous period' );
		await trigger.click();
		await page.getByRole( 'combobox', { name: 'Period', exact: true } ).selectOption( StatisticsRange.ALL_TIME );
		await expect( comparison ).toHaveCount( 0 );
		await page.keyboard.press( 'Escape' );
		await expect( page.getByRole( 'button', { name: 'Period: All time', exact: true } ) ).toBeFocused();
	} );

	test( 'uses absolute changes for a known zero baseline and clears stale comparisons after history disappears', async ( { open } ) => {
		const page = await open( SettingsDestination.STATISTICS );
		await page.evaluate( () => {
			window.settingsTest.externalStatistics( { firstRecordedDate: '2026-09-01' } );
		} );
		const trigger = page.getByRole( 'button', { name: 'Period: Current week', exact: true } );
		await trigger.click();
		await page.getByRole( 'switch', { name: 'Compare with previous period', exact: true } ).check();
		await page.keyboard.press( 'Escape' );
		const tags = page.locator( '.settings-statistics-trend-tag' );
		await expect( tags ).toHaveText( [ '2 more than last week', '3 more than last week' ] );
		await page.evaluate( () => {
			window.settingsTest.externalStatistics( { firstRecordedDate: null } );
		} );
		await expect( tags ).toHaveCount( 0 );
		await expect( trigger ).not.toContainText( 'vs previous period' );
		await expect( page.locator( '.settings-statistics-comparison-legend' ) ).toHaveCount( 0 );
		await trigger.click();
		await expect( page.getByRole( 'switch', { name: 'Compare with previous period', exact: true } ) ).toHaveCount( 0 );
		await page.getByRole( 'combobox', { name: 'Period', exact: true } ).selectOption( StatisticsRange.CURRENT_YEAR );
		await page.keyboard.press( 'Escape' );
		await expect( page.getByRole( 'button', { name: 'Period: Current year', exact: true } ) ).toBeVisible();
		await expect( page.locator( '.settings-metrics dd' ) ).toHaveText( [ '2', '3' ] );
	} );

	test( 'keeps the active period and comparison text fully visible with long translations and enlarged text', async ( { open } ) => {
		const page = await open( SettingsDestination.STATISTICS, Language.GERMAN );
		await page.evaluate( () => {
			window.settingsTest.externalStatistics( { firstRecordedDate: '2026-09-01' } );
		} );
		const trigger = page.locator( '.settings-statistics-period-trigger' );
		await trigger.click();
		await page.getByRole( 'switch' ).check();
		await page.keyboard.press( 'Escape' );
		for ( const [ width, size ] of [ [ 1280, '100%' ], [ 320, '100%' ], [ 320, '200%' ] ] as const ) {
			await page.setViewportSize( { width, height: 1000 } );
			await page.evaluate( ( fontSize ) => {
				document.documentElement.style.fontSize = fontSize;
			}, size );
			await expect.poll( () => trigger.evaluate( ( button ) => {
				const label = button.querySelector( '.mantine-Button-label' );
				if ( label === null ) {
					throw new TypeError( 'The period trigger must keep its visible label.' );
				}
				const bounds = label.getBoundingClientRect();
				const ranges = [ ...label.querySelectorAll( ':scope > span' ) ].flatMap( ( child ) => {
					const range = document.createRange();
					range.selectNodeContents( child );
					return [ ...range.getClientRects() ];
				} );
				return { pageFits: document.documentElement.scrollWidth <= innerWidth,
					labelFits: ranges.every( ( rect ) => rect.left >= bounds.left && rect.right <= bounds.right + 1 &&
						rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1 ) };
			} ) ).toEqual( { pageFits: true, labelFits: true } );
		}
	} );
} );
