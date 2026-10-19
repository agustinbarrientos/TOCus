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
	it( 'selects matching website outcomes and local hours without reconstructing earlier history', () => {
		const input = Object.assign( projection( [ '2026-09-13', '2026-09-14', '2026-09-16' ] ), {
			firstRecordedDate: '2026-09-13',
			visitOutcomes: {
				recordedFromDate: '2026-09-15',
				dailySites: [
					{ date: '2026-09-13', siteHost: 'youtube.com', reconsideredVisitCount: 20, visitedAfterPauseCount: 30 },
					{ date: '2026-09-15', siteHost: 'youtube.com', reconsideredVisitCount: 2, visitedAfterPauseCount: 3 },
					{ date: '2026-09-16', siteHost: 'youtube.com', reconsideredVisitCount: 4, visitedAfterPauseCount: 1 },
					{ date: '2026-09-16', siteHost: 'reddit.com', reconsideredVisitCount: 1, visitedAfterPauseCount: 2 },
					{ date: '2026-09-17', siteHost: 'reddit.com', reconsideredVisitCount: 40, visitedAfterPauseCount: 50 },
				],
				dailyHours: [
					{ date: '2026-09-13', hour: 9, reconsideredVisitCount: 20 },
					{ date: '2026-09-15', hour: 9, reconsideredVisitCount: 2 },
					{ date: '2026-09-16', hour: 9, reconsideredVisitCount: 4 },
					{ date: '2026-09-16', hour: 18, reconsideredVisitCount: 1 },
					{ date: '2026-09-17', hour: 9, reconsideredVisitCount: 40 },
				],
			},
		} );
		const before = JSON.stringify( input );
		const selected = selectStatisticsRange( input, StatisticsRange.CURRENT_WEEK );
		expect( selected ).toMatchObject( { startDate: '2026-09-14', endDate: '2026-09-16',
			breakdowns: { recordedFromDate: '2026-09-15', partialHistory: true,
				siteOutcomes: [
					{ siteHost: 'youtube.com', reconsideredVisitCount: 6, visitedAfterPauseCount: 4 },
					{ siteHost: 'reddit.com', reconsideredVisitCount: 1, visitedAfterPauseCount: 2 },
				] } } );
		expect( selected.breakdowns.hourlyReconsideredVisits ).toHaveLength( 24 );
		expect( selected.breakdowns.hourlyReconsideredVisits[ 9 ] ).toEqual( { hour: 9, reconsideredVisitCount: 6 } );
		expect( selected.breakdowns.hourlyReconsideredVisits[ 18 ] ).toEqual( { hour: 18, reconsideredVisitCount: 1 } );
		expect( selected.breakdowns.hourlyReconsideredVisits[ 0 ] ).toEqual( { hour: 0, reconsideredVisitCount: 0 } );
		expect( JSON.stringify( input ) ).toBe( before );
	} );
	it( 'distinguishes unrecorded breakdown history from a recorded period with no outcomes', () => {
		const legacy = selectStatisticsRange( projection( [] ), StatisticsRange.CURRENT_WEEK );
		expect( legacy ).toMatchObject( { startDate: '2026-09-14', endDate: '2026-09-16', breakdowns: {
			recordedFromDate: null, partialHistory: true, siteOutcomes: [], hourlyReconsideredVisits: [],
		} } );
		const recorded = selectStatisticsRange( Object.assign( projection( [] ), {
			firstRecordedDate: '2026-09-14',
			visitOutcomes: { recordedFromDate: '2026-09-14', dailySites: [], dailyHours: [] },
		} ), StatisticsRange.CURRENT_WEEK );
		expect( recorded.breakdowns.partialHistory ).toBe( false );
		expect( recorded.breakdowns.hourlyReconsideredVisits ).toHaveLength( 24 );
		expect( recorded.breakdowns.hourlyReconsideredVisits
			.every( ( hour ) => hour.reconsideredVisitCount === 0 ) ).toBe( true );
	} );
	it( 'retains genuine all-time coverage dates while keeping legacy totals separate from newer breakdowns', () => {
		const input = Object.assign( projection( [ '2026-09-14' ] ), {
			firstRecordedDate: '2025-01-01',
			visitOutcomes: { recordedFromDate: '2026-09-14', dailySites: [], dailyHours: [] },
		} );
		expect( selectStatisticsRange( input ) ).toMatchObject( { startDate: '2025-01-01', endDate: '2026-09-16',
			breakdowns: { partialHistory: true } } );
		expect( selectStatisticsRange( projection( [] ) ).startDate ).toBeNull();
		expect( selectStatisticsRange( input, StatisticsRange.CURRENT_MONTH ).startDate ).toBe( '2026-09-01' );
	} );
	it( 'preserves lifetime totals after clock rollback without displaying future coverage or an inverted date range', () => {
		const input = Object.assign( projection( [ '2026-09-18' ] ), {
			firstRecordedDate: '2026-09-18',
			visitOutcomes: { recordedFromDate: '2026-09-18',
				dailySites: [ { date: '2026-09-18', siteHost: 'youtube.com',
					reconsideredVisitCount: 1, visitedAfterPauseCount: 2 } ],
				dailyHours: [ { date: '2026-09-18', hour: 9, reconsideredVisitCount: 1 } ] },
		} );
		const selected = selectStatisticsRange( input );
		expect( selected ).toMatchObject( { startDate: null, endDate: '2026-09-16',
			totals: { reconsideredVisitCount: 1, estimatedReclaimedMilliseconds: 125_000 },
			chartBuckets: [], breakdowns: { recordedFromDate: null, partialHistory: true,
				siteOutcomes: [], hourlyReconsideredVisits: [] } } );
		expect( selectStatisticsRange( input, StatisticsRange.CURRENT_WEEK ) ).toMatchObject( {
			startDate: '2026-09-14', endDate: '2026-09-16', totals: { reconsideredVisitCount: 0 },
		} );
		expect( input.firstRecordedDate ).toBe( '2026-09-18' );
		expect( input.visitOutcomes.recordedFromDate ).toBe( '2026-09-18' );
	} );
	it( 'ranks equal website outcomes consistently and ignores zero rows and observations outside the selected month', () => {
		const input = Object.assign( projection( [] ), { visitOutcomes: {
			recordedFromDate: '2026-08-01',
			dailySites: [
				{ date: '2026-08-31', siteHost: 'old.test', reconsideredVisitCount: 10, visitedAfterPauseCount: 10 },
				{ date: '2026-09-01', siteHost: 'b.test', reconsideredVisitCount: 0, visitedAfterPauseCount: 1 },
				{ date: '2026-09-01', siteHost: 'a.test', reconsideredVisitCount: 0, visitedAfterPauseCount: 1 },
				{ date: '2026-09-01', siteHost: 'c.test', reconsideredVisitCount: 0, visitedAfterPauseCount: 2 },
				{ date: '2026-09-01', siteHost: 'zero.test', reconsideredVisitCount: 0, visitedAfterPauseCount: 0 },
			],
			dailyHours: [],
		} } );
		const selected = selectStatisticsRange( input, StatisticsRange.CURRENT_MONTH );
		expect( selected.breakdowns.siteOutcomes.map( ( site ) => site.siteHost ) ).toEqual( [ 'c.test', 'a.test', 'b.test' ] );
		expect( selected.breakdowns.partialHistory ).toBe( false );
		expect( selectStatisticsRange( input ).breakdowns.partialHistory ).toBe( true );
		expect( selectStatisticsRange( input ).breakdowns.siteOutcomes[ 0 ]?.siteHost ).toBe( 'old.test' );
	} );
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
	it( 'selects January through today for the current year and excludes future observations', () => {
		const input = projection( [ '2025-12-31', '2026-01-01', '2026-09-16', '2026-09-17' ] );
		const result = selectStatisticsRange( input, StatisticsRange.CURRENT_YEAR );
		expect( result ).toMatchObject( { startDate: '2026-01-01', endDate: '2026-09-16',
			totals: { reconsideredVisitCount: 2, completedWaitCount: 4 } } );
		expect( result.chartBuckets.map( ( day ) => day.date ) ).toEqual( [ '2026-01-01', '2026-09-13' ] );
	} );
	it( 'saturates chart and metric sums at the maximum safe integer', () => {
		const input = projection( [ '2026-09-14', '2026-09-15' ] );
		const maximumTotals = { estimatedReclaimedMilliseconds: Number.MAX_SAFE_INTEGER,
			focusedPauseMilliseconds: Number.MAX_SAFE_INTEGER, reconsideredVisitCount: Number.MAX_SAFE_INTEGER,
			completedWaitCount: Number.MAX_SAFE_INTEGER, allowanceGrantedCount: Number.MAX_SAFE_INTEGER };
		for ( const day of input.dailyTotals ) {
			Object.assign( day, maximumTotals );
		}
		const result = selectStatisticsRange( input, StatisticsRange.CURRENT_WEEK );
		expect( result.totals ).toEqual( maximumTotals );
		expect( result.chartBuckets.every( ( day ) =>
			Number.isSafeInteger( day.reconsideredVisitCount ) ) ).toBe( true );
	} );
	it( 'saturates website and hour sums while retaining their exact selected coverage', () => {
		const input = Object.assign( projection( [] ), { visitOutcomes: {
			recordedFromDate: '2026-09-01', dailySites: [
				{ date: '2026-09-14', siteHost: 'example.test',
					reconsideredVisitCount: Number.MAX_SAFE_INTEGER, visitedAfterPauseCount: Number.MAX_SAFE_INTEGER },
				{ date: '2026-09-15', siteHost: 'example.test', reconsideredVisitCount: 1, visitedAfterPauseCount: 1 },
			], dailyHours: [
				{ date: '2026-09-14', hour: 9, reconsideredVisitCount: Number.MAX_SAFE_INTEGER },
				{ date: '2026-09-15', hour: 9, reconsideredVisitCount: 1 },
			],
		} } );
		const result = selectStatisticsRange( input, StatisticsRange.CURRENT_WEEK );
		expect( result.breakdowns.siteOutcomes ).toEqual( [ { siteHost: 'example.test',
			reconsideredVisitCount: Number.MAX_SAFE_INTEGER, visitedAfterPauseCount: Number.MAX_SAFE_INTEGER } ] );
		expect( result.breakdowns.hourlyReconsideredVisits[ 9 ]?.reconsideredVisitCount )
			.toBe( Number.MAX_SAFE_INTEGER );
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
