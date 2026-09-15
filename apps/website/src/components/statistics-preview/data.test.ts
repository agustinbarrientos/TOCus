import { describe, expect, it } from 'vitest';
import { ExampleStatistics } from './data';

describe( 'website statistics example', () => {
	it( 'provides two complete months for the all-time chart', () => {
		expect( ExampleStatistics.dailyTotals ).toHaveLength( 61 );
		expect( ExampleStatistics.dailyTotals[ 0 ]?.date ).toBe( '2026-08-01' );
		expect( ExampleStatistics.dailyTotals.at( -1 )?.date ).toBe( '2026-09-30' );
		expect( new Set( ExampleStatistics.dailyTotals.map( ( day ) => day.date ) ).size ).toBe( 61 );
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
