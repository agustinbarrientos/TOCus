import { expect } from '@playwright/test';
import { SettingsDestination } from '../../../settings/services/settings-navigation/types';
import { test } from '../../../settings/utils/browser-test-harness';

test( 'keeps short daily pause ticks distinct while preserving full accessible durations', async ( { open } ) => {
	const page = await open( SettingsDestination.STATISTICS );
	await page.evaluate( () => {
		window.settingsTest.externalStatistics( { dailyTotals: [ {
			date: '2026-09-14', estimatedReclaimedMilliseconds: 30_000, focusedPauseMilliseconds: 30_000,
			reconsideredVisitCount: 0, completedWaitCount: 0, allowanceGrantedCount: 0,
		} ] } );
	} );
	const chart = page.getByRole( 'region', { name: 'Activity', exact: true } );
	const labels = chart.locator( '.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value' );
	await expect( labels.first() ).toHaveText( '0s' );
	const ticks = await labels.allTextContents();
	expect( ticks.length ).toBeGreaterThan( 2 );
	expect( new Set( ticks ).size ).toBe( ticks.length );
	expect( ticks.every( ( tick ) => tick.length <= 5 ) ).toBe( true );
	await expect( chart.getByRole( 'table' ) ).toContainText( 'Less than 1 minute' );
} );

for ( const [ milliseconds, formattedDuration ] of [ [ 660_000, '11 minutes' ], [ 39_600_000, '11 hours' ] ] as const ) {
	test( `lets the chart choose rounded duration ticks for ${ formattedDuration }`, async ( { open } ) => {
		const page = await open( SettingsDestination.STATISTICS );
		await page.evaluate( ( value ) => {
			window.settingsTest.externalStatistics( { dailyTotals: [ {
				date: '2026-09-14', estimatedReclaimedMilliseconds: value, focusedPauseMilliseconds: value,
				reconsideredVisitCount: 0, completedWaitCount: 0, allowanceGrantedCount: 0,
			} ] } );
		}, milliseconds );
		const chart = page.getByRole( 'region', { name: 'Activity', exact: true } );
		const labels = chart.locator( '.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value' );
		await expect( labels.first() ).toHaveText( '0s' );
		const ticks = await labels.allTextContents();
		expect( ticks.length ).toBeGreaterThan( 2 );
		expect( ticks.every( ( tick ) => /^\d+[smh]$/.test( tick ) ) ).toBe( true );
		await expect( chart.getByRole( 'table' ) ).toContainText( formattedDuration );
	} );
}

test( 'lets keyboard users inspect the same daily values as pointer users', async ( { open } ) => {
	const page = await open( SettingsDestination.STATISTICS );
	await page.evaluate( () => {
		window.settingsTest.externalStatistics( { dailyTotals: [ {
			date: '2026-09-13', estimatedReclaimedMilliseconds: 120_000, focusedPauseMilliseconds: 120_000,
			reconsideredVisitCount: 0, completedWaitCount: 0, allowanceGrantedCount: 0,
		}, {
			date: '2026-09-14', estimatedReclaimedMilliseconds: 300_000, focusedPauseMilliseconds: 300_000,
			reconsideredVisitCount: 0, completedWaitCount: 0, allowanceGrantedCount: 0,
		} ] } );
	} );
	const chart = page.getByRole( 'region', { name: 'Activity', exact: true } );
	const keyboardSurface = chart.getByRole( 'application', { name: 'Activity Estimated time reclaimed', exact: true } );
	await expect( chart.getByRole( 'application' ) ).toHaveCount( 1 );
	await expect( keyboardSurface ).toHaveCount( 1 );
	await expect( keyboardSurface ).toHaveAttribute( 'tabindex', '0' );
	const tooltip = chart.locator( '.recharts-tooltip-wrapper' );
	await chart.locator( '.recharts-bar-rectangle' ).nth( 1 ).hover();
	await expect( tooltip ).toBeVisible();
	await expect( tooltip ).toContainText( 'Sep 14, 2026' );
	await expect( tooltip ).toContainText( '5 minutes' );
	await page.mouse.move( 0, 0 );
	await keyboardSurface.focus();
	await keyboardSurface.press( 'ArrowLeft' );
	await expect( tooltip ).toBeVisible();
	await expect( tooltip ).toContainText( 'Sep 13, 2026' );
	await expect( tooltip ).toContainText( '2 minutes' );
	await keyboardSurface.press( 'ArrowRight' );
	await expect( tooltip ).toBeVisible();
	await expect( tooltip ).toContainText( 'Sep 14, 2026' );
	await expect( tooltip ).toContainText( '5 minutes' );
	await expect( chart.getByRole( 'table' ) ).toContainText( '2 minutes' );
	await expect( chart.getByRole( 'table' ) ).toContainText( '5 minutes' );
} );
