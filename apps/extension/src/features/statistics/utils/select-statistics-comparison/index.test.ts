import { describe, expect, it } from 'vitest';
import { AvailableStatisticsProjectionSchema } from '../../../../domains/statistics/types/statistics-projection';
import { LocalDateSchema } from '../../../../domains/protection/types/protection-value';
import { StatisticsRange } from '../select-statistics-range/types';
import { selectStatisticsComparison } from './index';

/**
 * Creates sparse observations and explicit daily recording coverage.
 * @param dates - Recorded calendar dates.
 * @param currentDate - Authoritative date anchoring the current period.
 * @param firstRecordedDate - Earliest known recording coverage.
 * @return Available local statistics with one distinct contribution per day.
 */
function projection( dates: string[], currentDate = '2026-09-16', firstRecordedDate: string | null = '2025-01-01' ) {
	return AvailableStatisticsProjectionSchema.parse( {
		status: 'available', currentDate, firstRecordedDate,
		estimatedReclaimedMilliseconds: dates.length * 125_000,
		focusedPauseMilliseconds: dates.length * 5_000,
		reconsideredVisitCount: dates.length, completedWaitCount: dates.length * 2,
		allowanceGrantedCount: dates.length * 3,
		dailyTotals: dates.map( ( date ) => ( { date, estimatedReclaimedMilliseconds: 125_000,
			focusedPauseMilliseconds: 5_000, reconsideredVisitCount: 1,
			completedWaitCount: 2, allowanceGrantedCount: 3 } ) ),
	} );
}

describe( 'selectStatisticsComparison', () => {
	it( 'compares Monday through the same elapsed weekday and omits later previous activity', () => {
		const input = projection( [ '2026-09-06', '2026-09-07', '2026-09-09', '2026-09-10',
			'2026-09-14', '2026-09-16', '2026-09-17' ] );
		const before = JSON.stringify( input );
		const result = selectStatisticsComparison( input, StatisticsRange.CURRENT_WEEK );
		const totals = { estimatedReclaimedMilliseconds: 125_000, focusedPauseMilliseconds: 5_000,
			reconsideredVisitCount: 1, completedWaitCount: 2, allowanceGrantedCount: 3 };
		expect( result?.previous ).toMatchObject( { range: StatisticsRange.CURRENT_WEEK,
			startDate: '2026-09-07', endDate: '2026-09-09', incompleteHistory: false,
			totals: { reconsideredVisitCount: 2, completedWaitCount: 4 } } );
		expect( result?.chartBuckets ).toEqual( [
			{ date: '2026-09-14', endDate: '2026-09-14', previousDate: '2026-09-07', previousEndDate: '2026-09-07',
				current: totals, previous: totals },
			{ date: '2026-09-15', endDate: '2026-09-15', previousDate: '2026-09-08', previousEndDate: '2026-09-08',
				current: null, previous: null },
			{ date: '2026-09-16', endDate: '2026-09-16', previousDate: '2026-09-09', previousEndDate: '2026-09-09',
				current: totals, previous: totals },
		] );
		expect( JSON.stringify( input ) ).toBe( before );
	} );
	it.each( [
		[ '2027-01-03', StatisticsRange.CURRENT_WEEK, '2026-12-21', '2026-12-27' ],
		[ '2027-01-04', StatisticsRange.CURRENT_WEEK, '2026-12-28', '2026-12-28' ],
		[ '2026-03-08', StatisticsRange.CURRENT_WEEK, '2026-02-23', '2026-03-01' ],
		[ '2026-11-01', StatisticsRange.CURRENT_WEEK, '2026-10-19', '2026-10-25' ],
		[ '2027-01-03', StatisticsRange.CURRENT_MONTH, '2026-12-01', '2026-12-03' ],
		[ '2026-03-31', StatisticsRange.CURRENT_MONTH, '2026-02-01', '2026-02-28' ],
		[ '2028-03-31', StatisticsRange.CURRENT_MONTH, '2028-02-01', '2028-02-29' ],
		[ '2028-02-29', StatisticsRange.CURRENT_YEAR, '2027-01-01', '2027-02-28' ],
		[ '2028-03-01', StatisticsRange.CURRENT_YEAR, '2027-01-01', '2027-03-01' ],
		[ '2027-12-31', StatisticsRange.CURRENT_YEAR, '2026-01-01', '2026-12-31' ],
	] as const )( 'selects equivalent elapsed %s for %s', ( currentDate, range, startDate, endDate ) => {
		const result = selectStatisticsComparison( projection( [], currentDate ), range );
		expect( result?.previous ).toMatchObject( { startDate, endDate } );
		expect( result?.chartBuckets.at( 0 ) ).toMatchObject( { previousDate: startDate } );
		expect( result?.chartBuckets.at( -1 ) ).toMatchObject( { endDate: currentDate,
			previousEndDate: endDate } );
	} );
	it.each( [ null, '2026-09-08', '2026-09-17' ] )( 'hides comparisons with unknown or partial daily coverage %s', ( firstDate ) => {
		expect( selectStatisticsComparison( projection( [ '2026-09-07' ], '2026-09-16', firstDate ),
			StatisticsRange.CURRENT_WEEK ) ).toBeNull();
	} );
	it( 'hides comparisons when legacy projections omit the daily recording date', () => {
		const input = projection( [ '2026-09-07' ] );
		delete input.firstRecordedDate;
		expect( selectStatisticsComparison( input, StatisticsRange.CURRENT_WEEK ) ).toBeNull();
	} );
	it( 'accepts complete known coverage with zero previous activity and preserves sparse chart gaps', () => {
		const input = projection( [ '2026-09-16' ], '2026-09-16', '2026-09-07' );
		const result = selectStatisticsComparison( input, StatisticsRange.CURRENT_WEEK );
		expect( result?.previous.totals.reconsideredVisitCount ).toBe( 0 );
		expect( result?.previous.chartBuckets ).toEqual( [] );
		expect( result?.chartBuckets.map( ( bucket ) => bucket.previous ) ).toEqual( [ null, null, null ] );
		expect( result?.chartBuckets.map( ( bucket ) => bucket.current?.reconsideredVisitCount ?? null ) )
			.toEqual( [ null, null, 1 ] );
	} );
	it( 'preserves previous-only observations and explicit recorded zeroes', () => {
		const input = projection( [ '2026-09-07', '2026-09-16' ] );
		const zero = input.dailyTotals[ 1 ];
		if ( zero === undefined ) {
			throw new Error( 'A zero-day fixture is required.' );
		}
		Object.assign( zero, { estimatedReclaimedMilliseconds: 0, focusedPauseMilliseconds: 0,
			reconsideredVisitCount: 0, completedWaitCount: 0, allowanceGrantedCount: 0 } );
		const result = selectStatisticsComparison( input, StatisticsRange.CURRENT_WEEK );
		expect( result?.chartBuckets[ 0 ] ).toMatchObject( { current: null, previous: { reconsideredVisitCount: 1 } } );
		expect( result?.chartBuckets[ 2 ] ).toMatchObject( { current: { reconsideredVisitCount: 0 }, previous: null } );
	} );
	it( 'does not offer previous comparisons for all time', () => {
		expect( selectStatisticsComparison( projection( [] ), StatisticsRange.ALL_TIME ) ).toBeNull();
	} );
	it.each( [
		[ '0000-01-03', StatisticsRange.CURRENT_WEEK ],
		[ '0000-01-08', StatisticsRange.CURRENT_WEEK ],
		[ '0000-01-31', StatisticsRange.CURRENT_MONTH ],
		[ '0000-12-31', StatisticsRange.CURRENT_YEAR ],
	] as const )( 'omits %s comparisons outside the supported date domain for %s', ( currentDate, range ) => {
		expect( selectStatisticsComparison( projection( [], currentDate, '0000-01-01' ), range ) ).toBeNull();
	} );
	it( 'selects previous website and hour values only inside the matched interval', () => {
		const input = Object.assign( projection( [] ), { visitOutcomes: {
			recordedFromDate: LocalDateSchema.parse( '2026-09-01' ), dailySites: [
				{ date: LocalDateSchema.parse( '2026-09-06' ), siteHost: 'outside.test', reconsideredVisitCount: 10, visitedAfterPauseCount: 10 },
				{ date: LocalDateSchema.parse( '2026-09-07' ), siteHost: 'previous.test', reconsideredVisitCount: 2, visitedAfterPauseCount: 3 },
				{ date: LocalDateSchema.parse( '2026-09-09' ), siteHost: 'previous.test', reconsideredVisitCount: 4, visitedAfterPauseCount: 1 },
				{ date: LocalDateSchema.parse( '2026-09-10' ), siteHost: 'later.test', reconsideredVisitCount: 20, visitedAfterPauseCount: 20 },
				{ date: LocalDateSchema.parse( '2026-09-16' ), siteHost: 'current.test', reconsideredVisitCount: 30, visitedAfterPauseCount: 30 },
			], dailyHours: [
				{ date: LocalDateSchema.parse( '2026-09-07' ), hour: 9, reconsideredVisitCount: 2 },
				{ date: LocalDateSchema.parse( '2026-09-09' ), hour: 9, reconsideredVisitCount: 4 },
				{ date: LocalDateSchema.parse( '2026-09-10' ), hour: 9, reconsideredVisitCount: 20 },
			],
		} } );
		const result = selectStatisticsComparison( input, StatisticsRange.CURRENT_WEEK );
		expect( result?.previous.breakdowns ).toMatchObject( { partialHistory: false,
			siteOutcomes: [ { siteHost: 'previous.test', reconsideredVisitCount: 6, visitedAfterPauseCount: 4 } ] } );
		expect( result?.previous.breakdowns.hourlyReconsideredVisits[ 9 ]?.reconsideredVisitCount ).toBe( 6 );
	} );
	it.each( [ '2026-09-08', '2026-09-14' ] )( 'retains aggregate comparisons when detail coverage starts at %s', ( recordedFromDate ) => {
		const input = Object.assign( projection( [ '2026-09-07', '2026-09-16' ] ), {
			visitOutcomes: { recordedFromDate: LocalDateSchema.parse( recordedFromDate ),
				dailySites: [], dailyHours: [] },
		} );
		expect( selectStatisticsComparison( input, StatisticsRange.CURRENT_WEEK )?.previous ).toMatchObject( {
			totals: { reconsideredVisitCount: 1 }, breakdowns: { partialHistory: true },
		} );
	} );
	it( 'bounds unequal full-year periods to matched intervals and keeps every contribution exactly once', () => {
		const input = projection( [ '2027-01-01', '2027-02-28', '2027-12-31',
			'2028-01-01', '2028-02-29', '2028-12-31', '2029-01-01' ], '2028-12-31' );
		const result = selectStatisticsComparison( input, StatisticsRange.CURRENT_YEAR );
		expect( result?.chartBuckets ).toHaveLength( 60 );
		expect( result?.previous.totals ).toMatchObject( { reconsideredVisitCount: 3, completedWaitCount: 6 } );
		expect( result?.chartBuckets.reduce(
			( sum, bucket ) => sum + ( bucket.current?.reconsideredVisitCount ?? 0 ), 0,
		) ).toBe( 3 );
		expect( result?.chartBuckets.reduce(
			( sum, bucket ) => sum + ( bucket.previous?.reconsideredVisitCount ?? 0 ), 0,
		) ).toBe( 3 );
		expect( result?.chartBuckets[ 0 ] ).toMatchObject( { date: '2028-01-01', endDate: '2028-01-06',
			previousDate: '2027-01-01', previousEndDate: '2027-01-06' } );
		expect( result?.chartBuckets.at( -1 ) ).toMatchObject( { endDate: '2028-12-31', previousEndDate: '2027-12-31' } );
		for ( const [ index, bucket ] of ( result?.chartBuckets ?? [] ).entries() ) {
			expect( bucket.date <= bucket.endDate && bucket.previousDate <= bucket.previousEndDate ).toBe( true );
			const next = result?.chartBuckets[ index + 1 ];
			if ( next !== undefined ) {
				expect( Date.parse( next.date ) - Date.parse( bucket.endDate ) ).toBe( 86_400_000 );
				expect( Date.parse( next.previousDate ) - Date.parse( bucket.previousEndDate ) ).toBe( 86_400_000 );
			}
		}
	} );
	it( 'saturates grouped previous and current values without overflowing', () => {
		const input = projection( [ '2025-01-01', '2025-01-02', '2026-01-01', '2026-01-02' ], '2026-12-31' );
		for ( const day of input.dailyTotals ) {
			day.reconsideredVisitCount = Number.MAX_SAFE_INTEGER;
		}
		const result = selectStatisticsComparison( input, StatisticsRange.CURRENT_YEAR );
		expect( result?.previous.totals.reconsideredVisitCount ).toBe( Number.MAX_SAFE_INTEGER );
		expect( result?.chartBuckets[ 0 ] ).toMatchObject( {
			current: { reconsideredVisitCount: Number.MAX_SAFE_INTEGER },
			previous: { reconsideredVisitCount: Number.MAX_SAFE_INTEGER } } );
	} );
} );
