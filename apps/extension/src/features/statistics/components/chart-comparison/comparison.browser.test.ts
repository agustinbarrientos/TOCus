import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { SettingsDestination } from '../../../settings/services/settings-navigation/types';
import { test } from '../../../settings/utils/browser-test-harness';

/**
 * Enables the production period comparison without bypassing its shared control.
 * @param page - Mounted Statistics screen.
 * @return Completion of the user-facing switch interaction.
 */
async function enableComparison( page: Page ): Promise<void> {
	await page.getByRole( 'button', { name: 'Period: Current week', exact: true } ).click();
	await page.getByRole( 'switch', { name: 'Compare with previous period', exact: true } ).check();
	await page.keyboard.press( 'Escape' );
}

test( 'compares aligned daily observations with exact dates, dashed bars and keyboard tooltips', async ( { open } ) => {
	const page = await open( SettingsDestination.STATISTICS );
	await page.evaluate( () => {
		window.settingsTest.externalStatistics( {
			currentDate: '2026-09-16', firstRecordedDate: '2026-09-01',
			dailyTotals: [
				{ date: '2026-09-07', estimatedReclaimedMilliseconds: 120_000, focusedPauseMilliseconds: 60_000,
					reconsideredVisitCount: 2, completedWaitCount: 1, allowanceGrantedCount: 0 },
				{ date: '2026-09-08', estimatedReclaimedMilliseconds: 300_000, focusedPauseMilliseconds: 120_000,
					reconsideredVisitCount: 5, completedWaitCount: 2, allowanceGrantedCount: 0 },
				{ date: '2026-09-14', estimatedReclaimedMilliseconds: 420_000, focusedPauseMilliseconds: 180_000,
					reconsideredVisitCount: 7, completedWaitCount: 3, allowanceGrantedCount: 0 },
			],
		} );
	} );
	await enableComparison( page );
	const daily = page.getByRole( 'region', { name: 'Daily activity', exact: true } );
	const legend = daily.locator( '.settings-statistics-comparison-legend' );
	await expect( legend ).toContainText( /Sep 14.*16, 2026/ );
	await expect( legend ).toContainText( /Sep 7.*9, 2026/ );
	const table = daily.getByRole( 'table' );
	await expect( table.getByRole( 'row' ).nth( 1 ).locator( 'th, td' ) ).toHaveText( [ 'Sep 14, 2026', '7', 'Sep 7, 2026', '2' ] );
	await expect( table.getByRole( 'row' ).nth( 2 ).locator( 'th, td' ) ).toHaveText( [ 'Sep 15, 2026', '-', 'Sep 8, 2026', '5' ] );
	const previousBars = daily.locator( '.recharts-bar-rectangle path[stroke-dasharray]' );
	await expect( previousBars ).toHaveCount( 2 );
	await expect( previousBars.first() ).toHaveAttribute( 'fill', 'none' );
	const keyboardSurface = daily.getByRole( 'application', { name: 'Daily activity Reconsidered visits', exact: true } );
	await daily.locator( '.recharts-bar-rectangle' ).first().hover();
	const tooltip = daily.locator( '.recharts-tooltip-wrapper' );
	await expect( tooltip ).toContainText( 'Sep 14, 2026' );
	await expect( tooltip ).toContainText( 'Sep 7, 2026' );
	await expect( tooltip.locator( '.settings-statistics-comparison-marker circle[stroke-dasharray]' ) ).toHaveCount( 1 );
	await page.mouse.move( 0, 0 );
	await keyboardSurface.focus();
	await keyboardSurface.press( 'ArrowRight' );
	await expect( tooltip ).toContainText( 'Sep 15, 2026' );
	await expect( tooltip ).toContainText( 'Sep 8, 2026' );
	await daily.getByRole( 'combobox', { name: 'Daily activity metric', exact: true } ).selectOption( 'estimatedReclaimedMilliseconds' );
	await expect( table ).toContainText( '7 minutes' );
	await expect( table ).toContainText( '2 minutes' );
} );

test( 'retains previous-only charts and exact all-website outcomes while sharing one outcome key', async ( { open } ) => {
	const page = await open( SettingsDestination.STATISTICS );
	await page.evaluate( () => {
		window.settingsTest.externalStatistics( {
			currentDate: '2026-09-16', firstRecordedDate: '2026-09-01',
			dailyTotals: [ {
				date: '2026-09-07', estimatedReclaimedMilliseconds: 120_000, focusedPauseMilliseconds: 60_000,
				reconsideredVisitCount: 2, completedWaitCount: 1, allowanceGrantedCount: 0,
			} ],
			visitOutcomes: {
				recordedFromDate: '2026-09-01',
				dailySites: [ { date: '2026-09-07', siteHost: 'youtube.com', reconsideredVisitCount: 2, visitedAfterPauseCount: 3 } ],
				dailyHours: [ { date: '2026-09-07', hour: 9, reconsideredVisitCount: 2 } ],
			},
		} );
	} );
	await enableComparison( page );
	const daily = page.getByRole( 'region', { name: 'Daily activity', exact: true } );
	await expect( daily.getByRole( 'application' ) ).toHaveCount( 1 );
	const outcomes = page.getByRole( 'region', { name: 'All websites', exact: true } );
	await expect( outcomes.locator( '[data-period="current"] [data-outcome] strong' ) ).toHaveText( [ '0', '0' ] );
	await expect( outcomes.locator( '[data-period="previous"] [data-outcome] strong' ) ).toHaveText( [ '2', '3' ] );
	await expect( outcomes.locator( '[data-period="previous"]' ) ).toContainText( 'Sep 7' );
	await expect( page.getByRole( 'group', { name: 'Visit outcome key', exact: true } ) ).toHaveCount( 1 );
	const hourly = page.getByRole( 'region', { name: 'Reconsidered visits by hour', exact: true } );
	await expect( hourly.getByRole( 'application' ) ).toHaveCount( 1 );
	await expect( hourly.getByRole( 'table' ).getByRole( 'row', { name: '09:00 0 2', exact: true } ) ).toHaveCount( 1 );
	const tooltip = hourly.locator( '.recharts-tooltip-wrapper' );
	await hourly.locator( '.recharts-bar-rectangle path[stroke-dasharray]' ).first().hover();
	await expect( tooltip ).toContainText( '09:00' );
	await page.mouse.move( 0, 0 );
	await hourly.getByRole( 'application' ).focus();
	await expect( tooltip ).toContainText( '00:00' );
	for ( let hour = 1; hour <= 9; hour += 1 ) {
		await hourly.getByRole( 'application' ).press( 'ArrowRight' );
		await expect( tooltip ).toContainText( `0${ String( hour ) }:00` );
	}
	await expect( tooltip ).toContainText( '09:00' );
	await expect( tooltip ).toContainText( 'Sep 14' );
	await expect( tooltip ).toContainText( 'Sep 7' );
	await expect( page.getByText( 'Your local time', { exact: true } ) ).toHaveCount( 0 );
	await page.getByRole( 'button', { name: 'Period: Current week', exact: true } ).click();
	await page.getByRole( 'switch', { name: 'Compare with previous period', exact: true } ).uncheck();
	await page.keyboard.press( 'Escape' );
	await expect( outcomes.locator( '[data-period="previous"]' ) ).toHaveCount( 0 );
	await expect( hourly.getByRole( 'application' ) ).toHaveCount( 0 );
	await expect( daily.getByRole( 'application' ) ).toHaveCount( 0 );
} );

test( 'keeps current all-website outcomes without comparison and hides incomplete previous details', async ( { open } ) => {
	const page = await open( SettingsDestination.STATISTICS );
	await page.evaluate( () => {
		window.settingsTest.externalStatistics( {
			currentDate: '2026-09-16', firstRecordedDate: '2026-09-01',
			dailyTotals: [
				{ date: '2026-09-07', estimatedReclaimedMilliseconds: 120_000, focusedPauseMilliseconds: 60_000,
					reconsideredVisitCount: 2, completedWaitCount: 1, allowanceGrantedCount: 0 },
				{ date: '2026-09-14', estimatedReclaimedMilliseconds: 420_000, focusedPauseMilliseconds: 180_000,
					reconsideredVisitCount: 7, completedWaitCount: 3, allowanceGrantedCount: 0 },
			],
			visitOutcomes: {
				recordedFromDate: '2026-09-14',
				dailySites: [ { date: '2026-09-14', siteHost: 'youtube.com', reconsideredVisitCount: 7, visitedAfterPauseCount: 4 } ],
				dailyHours: [ { date: '2026-09-14', hour: 9, reconsideredVisitCount: 7 } ],
			},
		} );
	} );
	const outcomes = page.getByRole( 'region', { name: 'All websites', exact: true } );
	await expect( outcomes.locator( '[data-period="current"] [data-outcome] strong' ) ).toHaveText( [ '7', '4' ] );
	await enableComparison( page );
	await expect( outcomes.locator( '[data-period="previous"]' ) ).toHaveCount( 0 );
	await expect( page.getByRole( 'region', { name: 'Daily activity', exact: true } ).locator( '.settings-statistics-comparison-legend' ) ).toBeVisible();
	const hourly = page.getByRole( 'region', { name: 'Reconsidered visits by hour', exact: true } );
	await expect( hourly.locator( '.settings-statistics-comparison-legend' ) ).toHaveCount( 0 );
	await expect( hourly.getByRole( 'table' ).getByRole( 'row', { name: '09:00 7', exact: true } ) ).toHaveCount( 1 );
	await page.setViewportSize( { width: 320, height: 1000 } );
	await page.evaluate( () => {
		document.documentElement.style.fontSize = '200%';
	} );
	await expect.poll( () => page.evaluate( () => document.documentElement.scrollWidth <= innerWidth ) ).toBe( true );
} );

test( 'retains full large outcome summary counts at narrow widths and enlarged text', async ( { open } ) => {
	const page = await open( SettingsDestination.STATISTICS );
	await page.evaluate( () => {
		window.settingsTest.externalStatistics( {
			currentDate: '2026-09-16', firstRecordedDate: '2026-09-01',
			visitOutcomes: {
				recordedFromDate: '2026-09-01',
				dailySites: [ { date: '2026-09-14', siteHost: 'youtube.com',
					reconsideredVisitCount: Number.MAX_SAFE_INTEGER,
					visitedAfterPauseCount: Number.MAX_SAFE_INTEGER } ],
				dailyHours: [ { date: '2026-09-14', hour: 9, reconsideredVisitCount: Number.MAX_SAFE_INTEGER } ],
			},
		} );
	} );
	const outcomes = page.getByRole( 'region', { name: 'All websites', exact: true } );
	const values = outcomes.locator( '[data-period="current"] [data-outcome] strong' );
	await expect( values ).toHaveText( [ '9,007,199,254,740,991', '9,007,199,254,740,991' ] );
	await page.evaluate( () => document.fonts.ready );
	for ( const [ width, size ] of [ [ 1280, '100%' ], [ 320, '100%' ], [ 320, '200%' ] ] as const ) {
		await page.setViewportSize( { width, height: 1000 } );
		await page.evaluate( ( fontSize ) => {
			document.documentElement.style.fontSize = fontSize;
		}, size );
		await outcomes.scrollIntoViewIfNeeded();
		await expect.poll( () => outcomes.evaluate( ( summary ) => {
			const bounds = summary.getBoundingClientRect();
			return {
				pageFits: document.documentElement.scrollWidth <= innerWidth,
				summaryFits: summary.scrollWidth <= summary.clientWidth &&
						bounds.left >= 0 && bounds.right <= innerWidth,
				valuesFit: [ ...summary.querySelectorAll( '[data-outcome] strong' ) ].every( ( value ) => {
					const text = document.createRange();
					text.selectNodeContents( value );
					return getComputedStyle( value ).textOverflow !== 'ellipsis' && [ ...text.getClientRects() ].every( ( rect ) =>
						rect.left >= bounds.left && rect.right <= bounds.right );
				} ),
			};
		} ), { message: `Full all-website counts at ${ String( width ) }px and ${ size } text` } ).toEqual( {
			pageFits: true, summaryFits: true, valuesFit: true,
		} );
		await expect( values ).toHaveText( [ '9,007,199,254,740,991', '9,007,199,254,740,991' ] );
	}
} );
