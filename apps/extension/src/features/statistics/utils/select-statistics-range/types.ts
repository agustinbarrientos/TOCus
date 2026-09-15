import { z } from 'zod';
import type { DailyStatisticsTotals, StatisticsTotals } from '../../../../domains/statistics/types/statistics-document';
import type { LocalDate } from '../../../../domains/protection/types/protection-value';

/**
 * Calendar periods shared by every Statistics metric and chart.
 * @since 0.1.0
 */
export const StatisticsRange = {
	CURRENT_WEEK: 'current-week',
	CURRENT_MONTH: 'current-month',
	ALL_TIME: 'all-time',
} as const;

/**
 * Validates a user-selected calendar period.
 * @since 0.1.0
 */
export const StatisticsRangeSchema = z.enum( StatisticsRange );

/**
 * Supported calendar period.
 * @since 0.1.0
 */
export type StatisticsRange = z.infer<typeof StatisticsRangeSchema>;

/**
 * One chart interval containing the complete sum of its recorded days.
 * @since 0.1.0
 */
export interface StatisticsChartBucket extends DailyStatisticsTotals {
	endDate: LocalDate;
}

/**
 * Selected calendar period with bounded chart intervals and matching totals.
 * @since 0.1.0
 */
export interface StatisticsRangeView {
	range: StatisticsRange;
	totals: StatisticsTotals;
	chartBuckets: StatisticsChartBucket[];
	incompleteHistory: boolean;
}
