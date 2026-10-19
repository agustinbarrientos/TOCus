import type { AvailableStatisticsProjection } from '../../../../domains/statistics/types/statistics-projection';
import type { DailyStatisticsTotals, StatisticsTotals } from '../../../../domains/statistics/types/statistics-document';
import { LocalDateSchema, type LocalDate } from '../../../../domains/protection/types/protection-value';
import { createEmptyStatisticsTotals } from '../../../../domains/statistics/utils/create-statistics-document';
import { addStatisticsValues } from '../../../../domains/statistics/utils/add-statistics-values';
import { shiftStatisticsDate } from '../../../../domains/statistics/utils/statistics-calendar-date';
import { StatisticsRange, type StatisticsChartBucket, type StatisticsRangeView, type StatisticsBreakdownsView,
	type StatisticsSiteOutcomes } from './types';

const MAXIMUM_CHART_BUCKETS = 60;
const CALENDAR_DAY_MILLISECONDS = 86_400_000;

/**
 * Selects recorded website and local-hour aggregates without reconstructing missing history.
 * @param projection - Authoritative aggregate-only projection.
 * @param startDate - Inclusive selected calendar boundary, or unknown lifetime start.
 * @return Selected outcomes and coverage of this period.
 */
function selectBreakdowns(
	projection: AvailableStatisticsProjection, startDate: LocalDate | null,
): StatisticsBreakdownsView {
	const recorded = projection.visitOutcomes;
	if ( recorded === undefined || recorded.recordedFromDate > projection.currentDate ) {
		// A clock rollback can leave real stored history entirely beyond the visible calendar period.
		return { recordedFromDate: null, partialHistory: true, siteOutcomes: [], hourlyReconsideredVisits: [] };
	}
	/**
	 * Keeps outcomes within actual recording coverage and the selected calendar interval.
	 * @param date - Recorded local date.
	 * @return Whether this observation belongs to the selected period.
	 */
	function includes( date: LocalDate ): boolean {
		return date >= recordedFromDate &&
			( startDate === null || date >= startDate ) && date <= projection.currentDate;
	}
	const recordedFromDate = recorded.recordedFromDate;
	const sites = new Map<string, StatisticsSiteOutcomes>();
	for ( const day of recorded.dailySites ) {
		if ( ! includes( day.date ) ) {
			continue;
		}
		const previous = sites.get( day.siteHost );
		sites.set( day.siteHost, { siteHost: day.siteHost,
			reconsideredVisitCount: addStatisticsValues(
				previous?.reconsideredVisitCount ?? 0, day.reconsideredVisitCount,
			),
			visitedAfterPauseCount: addStatisticsValues(
				previous?.visitedAfterPauseCount ?? 0, day.visitedAfterPauseCount,
			) } );
	}
	const hours = new Map<number, number>();
	for ( const day of recorded.dailyHours ) {
		if ( includes( day.date ) ) {
			hours.set( day.hour, addStatisticsValues( hours.get( day.hour ) ?? 0, day.reconsideredVisitCount ) );
		}
	}
	return { recordedFromDate: recorded.recordedFromDate,
		partialHistory: startDate === null || recorded.recordedFromDate > startDate,
		siteOutcomes: [ ...sites.values() ]
			.filter( ( site ) => site.reconsideredVisitCount + site.visitedAfterPauseCount > 0 )
			.sort( ( first, second ) => second.reconsideredVisitCount - first.reconsideredVisitCount ||
				second.visitedAfterPauseCount - first.visitedAfterPauseCount ||
				first.siteHost.localeCompare( second.siteHost ) ),
		hourlyReconsideredVisits: Array.from( { length: 24 }, ( _, hour ) =>
			( { hour, reconsideredVisitCount: hours.get( hour ) ?? 0 } ) ) };
}

/**
 * Adds already-projected values without counting their included pause time again.
 * @param left - Accumulated values.
 * @param right - Contribution to include.
 * @return Safely summed metric values.
 */
function addTotals( left: StatisticsTotals, right: StatisticsTotals ): StatisticsTotals {
	return {
		estimatedReclaimedMilliseconds: addStatisticsValues(
			left.estimatedReclaimedMilliseconds, right.estimatedReclaimedMilliseconds,
		),
		focusedPauseMilliseconds: addStatisticsValues( left.focusedPauseMilliseconds, right.focusedPauseMilliseconds ),
		reconsideredVisitCount: addStatisticsValues( left.reconsideredVisitCount, right.reconsideredVisitCount ),
		completedWaitCount: addStatisticsValues( left.completedWaitCount, right.completedWaitCount ),
		allowanceGrantedCount: addStatisticsValues( left.allowanceGrantedCount, right.allowanceGrantedCount ),
	};
}

/**
 * Groups long recorded histories into at most sixty complete calendar intervals.
 * @param days - Recorded local days in chronological order.
 * @return Sparse chart intervals; absent observations are never filled with zeroes.
 */
function createChartBuckets( days: DailyStatisticsTotals[] ): StatisticsChartBucket[] {
	const first = days.at( 0 );
	const last = days.at( -1 );
	if ( first === undefined || last === undefined ) {
		return [];
	}
	const firstEpoch = Date.parse( first.date );
	const span = Math.round( ( Date.parse( last.date ) - firstEpoch ) / CALENDAR_DAY_MILLISECONDS ) + 1;
	const intervalDays = Math.ceil( span / MAXIMUM_CHART_BUCKETS );
	const buckets = new Map<number, StatisticsChartBucket>();
	for ( const day of days ) {
		const index = Math.floor( ( Date.parse( day.date ) - firstEpoch ) / CALENDAR_DAY_MILLISECONDS / intervalDays );
		const date = shiftStatisticsDate( first.date, index * intervalDays );
		const remainingDays = Math.round(
			( Date.parse( last.date ) - Date.parse( date ) ) / CALENDAR_DAY_MILLISECONDS,
		);
		const endDate = shiftStatisticsDate( date, Math.min( intervalDays - 1, remainingDays ) );
		buckets.set( index, {
			date, endDate, ...addTotals( buckets.get( index ) ?? createEmptyStatisticsTotals(), day ),
		} );
	}
	return [ ...buckets.values() ];
}

/**
 * Selects a local calendar period for all five metrics and the activity chart.
 * @param projection - Authoritative lifetime totals and recorded daily values.
 * @param range - Desired period, defaulting to all time.
 * @return Period totals and complete chart intervals without reconstructed history.
 * @since 1.0.0
 */
export function selectStatisticsRange(
	projection: AvailableStatisticsProjection,
	range: StatisticsRange = StatisticsRange.ALL_TIME,
): StatisticsRangeView {
	let startDate: LocalDate | null = projection.firstRecordedDate ?? null;
	if ( startDate !== null && startDate > projection.currentDate ) {
		startDate = null;
	}
	if ( range === StatisticsRange.CURRENT_MONTH ) {
		startDate = LocalDateSchema.parse( `${ projection.currentDate.slice( 0, 7 ) }-01` );
	} else if ( range === StatisticsRange.CURRENT_WEEK ) {
		const weekday = new Date( `${ projection.currentDate }T00:00:00Z` ).getUTCDay();
		startDate = shiftStatisticsDate( projection.currentDate, -( ( weekday + 6 ) % 7 ) );
	}
	const days = projection.dailyTotals.filter( ( day ) =>
		( range === StatisticsRange.ALL_TIME || startDate === null || day.date >= startDate ) &&
		day.date <= projection.currentDate );
	const recordedTotals = days.reduce<StatisticsTotals>( addTotals, createEmptyStatisticsTotals() );
	const lifetime = addTotals( createEmptyStatisticsTotals(), projection );
	const totals = range === StatisticsRange.ALL_TIME ? lifetime : recordedTotals;
	return {
		range, startDate, endDate: projection.currentDate, totals, chartBuckets: createChartBuckets( days ),
		breakdowns: selectBreakdowns( projection, startDate ),
		incompleteHistory: range === StatisticsRange.ALL_TIME &&
			( recordedTotals.estimatedReclaimedMilliseconds !== lifetime.estimatedReclaimedMilliseconds ||
				recordedTotals.focusedPauseMilliseconds !== lifetime.focusedPauseMilliseconds ||
				recordedTotals.reconsideredVisitCount !== lifetime.reconsideredVisitCount ||
				recordedTotals.completedWaitCount !== lifetime.completedWaitCount ||
				recordedTotals.allowanceGrantedCount !== lifetime.allowanceGrantedCount ),
	};
}
