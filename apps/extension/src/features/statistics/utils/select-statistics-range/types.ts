import { z } from 'zod';
import type { DailyStatisticsTotals, StatisticsTotals } from '../../../../domains/statistics/types/statistics-document';
import type { LocalDate } from '../../../../domains/protection/types/protection-value';

/**
 * Calendar periods shared by every Statistics metric and chart.
 * @since 1.0.0
 */
export const StatisticsRange = {
	CURRENT_WEEK: 'current-week',
	CURRENT_MONTH: 'current-month',
	ALL_TIME: 'all-time',
} as const;

/**
 * Validates a user-selected calendar period.
 * @since 1.0.0
 */
export const StatisticsRangeSchema = z.enum( StatisticsRange );

/**
 * Supported calendar period.
 * @since 1.0.0
 */
export type StatisticsRange = z.infer<typeof StatisticsRangeSchema>;

/**
 * One chart interval containing the complete sum of its recorded days.
 * @since 1.0.0
 */
export interface StatisticsChartBucket extends DailyStatisticsTotals {
	endDate: LocalDate;
}

/**
 * Selected calendar period with bounded chart intervals and matching totals.
 * @since 1.0.0
 */
export interface StatisticsRangeView {
	range: StatisticsRange;
	startDate: LocalDate | null;
	endDate: LocalDate;
	totals: StatisticsTotals;
	chartBuckets: StatisticsChartBucket[];
	incompleteHistory: boolean;
	breakdowns: StatisticsBreakdownsView;
}

/**
 * Recorded outcomes for one exact website without retaining URLs or page contents.
 * @since 1.1.0
 */
export interface StatisticsSiteOutcomes {
	siteHost: string;
	reconsideredVisitCount: number;
	visitedAfterPauseCount: number;
}

/**
 * One local hour's recorded reconsidered visits.
 * @since 1.1.0
 */
export interface StatisticsHourlyVisits {
	hour: number;
	reconsideredVisitCount: number;
}

/**
 * Selected breakdowns with explicit coverage independent of older aggregate totals.
 * @since 1.1.0
 */
export interface StatisticsBreakdownsView {
	recordedFromDate: LocalDate | null;
	partialHistory: boolean;
	siteOutcomes: StatisticsSiteOutcomes[];
	hourlyReconsideredVisits: StatisticsHourlyVisits[];
}
