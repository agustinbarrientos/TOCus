import type { AvailableStatisticsProjection } from '../../../../domains/statistics/types/statistics-projection';
import type { DailyStatisticsTotals, StatisticsTotals } from '../../../../domains/statistics/types/statistics-document';
import { LocalDateSchema, type LocalDate } from '../../../../domains/protection/types/protection-value';
import { shiftStatisticsDate } from '../../../../domains/statistics/utils/statistics-calendar-date';
import { createEmptyStatisticsTotals } from '../../../../domains/statistics/utils/create-statistics-document';
import { selectStatisticsRange } from '../select-statistics-range';
import { StatisticsRange } from '../select-statistics-range/types';
import { addStatisticsTotals } from '../select-statistics-range/add-statistics-totals';
import { statisticsPeriodStart } from '../select-statistics-range/statistics-period-start';
import type { StatisticsComparisonView } from './types';

const MAXIMUM_CHART_BUCKETS = 60;
const CALENDAR_DAY_MILLISECONDS = 86_400_000;

/**
 * Finds the same elapsed calendar endpoint in the preceding period.
 * @param currentDate - Inclusive current endpoint.
 * @param range - Comparable calendar period.
 * @return Clamped valid prior endpoint, or null outside the supported calendar domain.
 */
function previousEndpoint( currentDate: LocalDate, range: StatisticsRange ): LocalDate | null {
	const calendar = new Date( `${ currentDate }T00:00:00Z` );
	if ( range === StatisticsRange.CURRENT_WEEK ) {
		const weekdayOffset = ( calendar.getUTCDay() + 6 ) % 7;
		calendar.setUTCDate( calendar.getUTCDate() - 7 - weekdayOffset );
		if ( calendar.getUTCFullYear() < 0 ) {
			return null;
		}
		calendar.setUTCDate( calendar.getUTCDate() + weekdayOffset );
	} else {
		const day = calendar.getUTCDate();
		calendar.setUTCDate( 1 );
		if ( range === StatisticsRange.CURRENT_MONTH ) {
			calendar.setUTCMonth( calendar.getUTCMonth() - 1 );
		} else {
			calendar.setUTCFullYear( calendar.getUTCFullYear() - 1 );
		}
		const lastDay = new Date( calendar );
		lastDay.setUTCMonth( lastDay.getUTCMonth() + 1, 0 );
		calendar.setUTCDate( Math.min( day, lastDay.getUTCDate() ) );
	}
	const parsed = LocalDateSchema.safeParse( calendar.toISOString().slice( 0, 10 ) );
	return parsed.success ? parsed.data : null;
}

/**
 * Counts inclusive date-only days independently of the machine's time zone.
 * @param startDate - First calendar day.
 * @param endDate - Final calendar day.
 * @return Complete inclusive calendar span.
 */
function calendarSpan( startDate: LocalDate, endDate: LocalDate ): number {
	return Math.round( ( Date.parse( endDate ) - Date.parse( startDate ) ) / CALENDAR_DAY_MILLISECONDS ) + 1;
}

/**
 * Sums observations within one interval while retaining genuinely absent history.
 * @param days - Sparse recorded calendar observations.
 * @param startDate - Inclusive interval start.
 * @param endDate - Inclusive interval end.
 * @return Recorded totals, or null when the interval has no observation.
 */
function intervalTotals(
	days: DailyStatisticsTotals[], startDate: LocalDate, endDate: LocalDate,
): StatisticsTotals | null {
	const recorded = days.filter( ( day ) => day.date >= startDate && day.date <= endDate );
	return recorded.length === 0 ? null : recorded.reduce( addStatisticsTotals, createEmptyStatisticsTotals() );
}

/**
 * Selects a previous elapsed calendar period only when daily recording coverage is known.
 * @param projection - Authoritative lifetime totals and sparse recorded daily values.
 * @param range - Current calendar period to compare.
 * @return Previous recorded period and matched chart intervals, or no eligible comparison.
 * @since 1.1.0
 */
export function selectStatisticsComparison(
	projection: AvailableStatisticsProjection, range: StatisticsRange,
): StatisticsComparisonView | null {
	if ( range === StatisticsRange.ALL_TIME || projection.firstRecordedDate == null ) {
		return null;
	}
	const previousEnd = previousEndpoint( projection.currentDate, range );
	if ( previousEnd === null ) {
		return null;
	}
	const previousStart = statisticsPeriodStart( previousEnd, range );
	if ( projection.firstRecordedDate > previousStart ) {
		return null;
	}
	const previous = selectStatisticsRange( { ...projection, currentDate: previousEnd }, range );
	const currentStart = statisticsPeriodStart( projection.currentDate, range );
	const currentDays = calendarSpan( currentStart, projection.currentDate );
	const previousDays = calendarSpan( previousStart, previous.endDate );
	const bucketCount = Math.min( MAXIMUM_CHART_BUCKETS, currentDays, previousDays );
	return { previous, chartBuckets: Array.from( { length: bucketCount }, ( _, index ) => {
		const date = shiftStatisticsDate( currentStart, Math.floor( index * currentDays / bucketCount ) );
		const endDate = shiftStatisticsDate(
			currentStart, Math.floor( ( index + 1 ) * currentDays / bucketCount ) - 1,
		);
		const previousDate = shiftStatisticsDate( previousStart, Math.floor( index * previousDays / bucketCount ) );
		const previousEndDate = shiftStatisticsDate(
			previousStart, Math.floor( ( index + 1 ) * previousDays / bucketCount ) - 1,
		);
		return { date, endDate, previousDate, previousEndDate,
			current: intervalTotals( projection.dailyTotals, date, endDate ),
			previous: intervalTotals( projection.dailyTotals, previousDate, previousEndDate ) };
	} ) };
}
