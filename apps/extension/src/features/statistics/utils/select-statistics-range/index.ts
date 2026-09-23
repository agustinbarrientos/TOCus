import type { AvailableStatisticsProjection } from '../../../../domains/statistics/types/statistics-projection';
import type { DailyStatisticsTotals, StatisticsTotals } from '../../../../domains/statistics/types/statistics-document';
import { LocalDateSchema, type LocalDate } from '../../../../domains/protection/types/protection-value';
import { createEmptyStatisticsTotals } from '../../../../domains/statistics/utils/create-statistics-document';
import { addStatisticsValues } from '../../../../domains/statistics/utils/add-statistics-values';
import { shiftStatisticsDate } from '../../../../domains/statistics/utils/statistics-calendar-date';
import { StatisticsRange, type StatisticsChartBucket, type StatisticsRangeView } from './types';

const MAXIMUM_CHART_BUCKETS = 60;
const CALENDAR_DAY_MILLISECONDS = 86_400_000;

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
	let startDate: LocalDate | null = null;
	if ( range === StatisticsRange.CURRENT_MONTH ) {
		startDate = LocalDateSchema.parse( `${ projection.currentDate.slice( 0, 7 ) }-01` );
	} else if ( range === StatisticsRange.CURRENT_WEEK ) {
		const weekday = new Date( `${ projection.currentDate }T00:00:00Z` ).getUTCDay();
		startDate = shiftStatisticsDate( projection.currentDate, -( ( weekday + 6 ) % 7 ) );
	}
	const days = projection.dailyTotals.filter( ( day ) =>
		( startDate === null || day.date >= startDate ) && day.date <= projection.currentDate );
	const recordedTotals = days.reduce<StatisticsTotals>( addTotals, createEmptyStatisticsTotals() );
	const lifetime = addTotals( createEmptyStatisticsTotals(), projection );
	const totals = range === StatisticsRange.ALL_TIME ? lifetime : recordedTotals;
	return {
		range, totals, chartBuckets: createChartBuckets( days ),
		incompleteHistory: range === StatisticsRange.ALL_TIME &&
			( recordedTotals.estimatedReclaimedMilliseconds !== lifetime.estimatedReclaimedMilliseconds ||
				recordedTotals.focusedPauseMilliseconds !== lifetime.focusedPauseMilliseconds ||
				recordedTotals.reconsideredVisitCount !== lifetime.reconsideredVisitCount ||
				recordedTotals.completedWaitCount !== lifetime.completedWaitCount ||
				recordedTotals.allowanceGrantedCount !== lifetime.allowanceGrantedCount ),
	};
}
