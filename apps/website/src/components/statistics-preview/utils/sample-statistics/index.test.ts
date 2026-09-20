import { describe, expect, it } from 'vitest';
import { ExampleStatistics, selectSampleDays } from './index';
import { SamplePeriod } from '../../types';

describe( 'website statistics example', () => {
	it( 'provides two complete months for the all-time chart', () => {
		expect( ExampleStatistics.dailyTotals ).toHaveLength( 61 );
		expect( ExampleStatistics.dailyTotals[ 0 ]?.date ).toBe( '2026-06-01' );
		expect( ExampleStatistics.dailyTotals.at( -1 )?.date ).toBe( '2026-07-31' );
		expect( new Set( ExampleStatistics.dailyTotals.map( ( day ) => day.date ) ).size ).toBe( 61 );
	} );
	it( 'selects the current calendar week and month against the sample date', () => {
		const week = selectSampleDays( SamplePeriod.CURRENT_WEEK );
		expect( week.map( ( day ) => day.date ) ).toEqual( [
			'2026-07-27', '2026-07-28', '2026-07-29', '2026-07-30', '2026-07-31',
		] );
		const month = selectSampleDays( SamplePeriod.CURRENT_MONTH );
		expect( month ).toHaveLength( 31 );
		expect( month[ 0 ]?.date ).toBe( '2026-07-01' );
		expect( month.at( -1 )?.date ).toBe( '2026-07-31' );
	} );
	it( 'includes inactive days and activity that changes between weeks', () => {
		const days = ExampleStatistics.dailyTotals;
		expect( days.some( ( day ) =>
			day.completedWaitCount === 0 && day.focusedPauseMilliseconds === 0 ) ).toBe( true );
		expect( new Set( days.map( ( day ) => day.estimatedReclaimedMilliseconds ) ).size ).toBeGreaterThan( 20 );
		expect( days.slice( 7 ).some( ( day, index ) =>
			day.reconsideredVisitCount !== days[ index ]?.reconsideredVisitCount ) ).toBe( true );
	} );
	it( 'uses five configured minutes per reconsidered visit plus actual pause time', () => {
		for ( const day of ExampleStatistics.dailyTotals ) {
			expect( day.estimatedReclaimedMilliseconds ).toBe(
				day.focusedPauseMilliseconds + day.reconsideredVisitCount * 300_000,
			);
			expect( day.allowanceGrantedCount ).toBeLessThanOrEqual( day.completedWaitCount );
		}
	} );
	it( 'keeps every summary consistent with its daily records', () => {
		for ( const metric of [ 'estimatedReclaimedMilliseconds', 'focusedPauseMilliseconds',
			'reconsideredVisitCount', 'completedWaitCount', 'allowanceGrantedCount' ] as const ) {
			expect( ExampleStatistics[ metric ] ).toBe(
				ExampleStatistics.dailyTotals.reduce( ( total, day ) => total + day[ metric ], 0 ),
			);
		}
	} );
} );
