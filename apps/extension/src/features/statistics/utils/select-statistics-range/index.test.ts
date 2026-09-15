import { describe, expect, it } from 'vitest';
import { AvailableStatisticsProjectionSchema } from '../../../../domains/statistics/types/statistics-projection';
import { selectStatisticsRange } from './index';
import { StatisticsRange } from './types';

/**
 * Creates recorded days with distinguishable contributions for each metric.
 * @param dates - Observed dates.
 * @param currentDate - Authoritative local date.
 * @return Validated projection whose estimates already contain pause time.
 */
function projection( dates: string[], currentDate = '2026-09-16' ) {
	return AvailableStatisticsProjectionSchema.parse( {
		status: 'available', currentDate,
		estimatedReclaimedMilliseconds: dates.length * 125_000,
		focusedPauseMilliseconds: dates.length * 5_000,
		reconsideredVisitCount: dates.length,
		completedWaitCount: dates.length * 2,
		allowanceGrantedCount: dates.length * 3,
		dailyTotals: dates.map( ( date ) => ( {
			date, estimatedReclaimedMilliseconds: 125_000, focusedPauseMilliseconds: 5_000,
			reconsideredVisitCount: 1, completedWaitCount: 2, allowanceGrantedCount: 3,
		} ) ),
	} );
}

describe( 'selectStatisticsRange', () => {
	it( 'defaults to complete lifetime totals without dropping history older than ninety days', () => {
		const result = selectStatisticsRange( projection( [ '2025-01-01', '2026-09-16' ] ) );
		expect( result.range ).toBe( StatisticsRange.ALL_TIME );
		expect( result.totals.estimatedReclaimedMilliseconds ).toBe( 250_000 );
		expect( result.chartBuckets ).toHaveLength( 2 );
		expect( result.incompleteHistory ).toBe( false );
	} );
	it( 'uses the same Monday-to-today days for chart and all five metrics without adding pause twice', () => {
		const result = selectStatisticsRange(
			projection( [ '2026-09-13', '2026-09-14', '2026-09-16', '2026-09-17' ] ), StatisticsRange.CURRENT_WEEK,
		);
		expect( result.totals ).toEqual( {
			estimatedReclaimedMilliseconds: 250_000, focusedPauseMilliseconds: 10_000,
			reconsideredVisitCount: 2, completedWaitCount: 4, allowanceGrantedCount: 6,
		} );
		expect( result.chartBuckets.map( ( day ) => day.date ) ).toEqual( [ '2026-09-14', '2026-09-16' ] );
	} );
	it.each( [
		[ '2027-01-03', StatisticsRange.CURRENT_WEEK, [ '2026-12-28', '2027-01-01', '2027-01-03' ] ],
		[ '2027-01-04', StatisticsRange.CURRENT_WEEK, [ '2027-01-04' ] ],
		[ '2027-01-03', StatisticsRange.CURRENT_MONTH, [ '2027-01-01', '2027-01-03' ] ],
		[ '2028-02-29', StatisticsRange.CURRENT_MONTH, [ '2028-02-01', '2028-02-29' ] ],
	] as const )( 'selects calendar boundaries on %s for %s', ( today, range, dates ) => {
		const input = projection( [ '2026-12-27', '2026-12-28', '2027-01-01', '2027-01-03', '2027-01-04', '2028-02-01', '2028-02-29', '2028-03-01' ], today );
		const result = selectStatisticsRange( input, range );
		expect( result.chartBuckets.map( ( day ) => day.date ) ).toEqual( dates );
	} );
	it( 'returns zero period metrics without fabricating daily observations', () => {
		const result = selectStatisticsRange( projection( [ '2026-01-01' ] ), StatisticsRange.CURRENT_MONTH );
		expect( result.totals.reconsideredVisitCount ).toBe( 0 );
		expect( result.chartBuckets ).toEqual( [] );
	} );
	it( 'bounds a century of sparse history while preserving every contribution and date labels', () => {
		const input = projection( Array.from( { length: 120 }, ( _, year ) => `${ String( 1900 + year ) }-01-01` ) );
		const before = JSON.stringify( input );
		for ( let read = 0; read < 2; read++ ) {
			const result = selectStatisticsRange( input );
			expect( result.chartBuckets.length ).toBeLessThanOrEqual( 60 );
			expect( result.chartBuckets.reduce(
				( total, bucket ) => total + bucket.estimatedReclaimedMilliseconds, 0,
			) ).toBe( 15_000_000 );
			expect( result.chartBuckets[ 0 ]?.date ).toBe( '1900-01-01' );
			expect( result.chartBuckets.at( -1 )?.endDate ).toBe( '2019-01-01' );
		}
		expect( JSON.stringify( input ) ).toBe( before );
	} );
	it( 'preserves lifetime totals and marks an incomplete historical chart without inventing past values', () => {
		const input = projection( [ '2026-09-16' ] );
		input.estimatedReclaimedMilliseconds = 500_000;
		const result = selectStatisticsRange( input );
		expect( result.totals.estimatedReclaimedMilliseconds ).toBe( 500_000 );
		expect( result.incompleteHistory ).toBe( true );
		expect( result.chartBuckets ).toMatchObject( [ { estimatedReclaimedMilliseconds: 125_000 } ] );
	} );
} );
