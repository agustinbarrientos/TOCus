import type { LocalDate } from '../../../../domains/protection/types/protection-value';
import type { StatisticsTotals } from '../../../../domains/statistics/types/statistics-document';
import type { StatisticsRangeView } from '../select-statistics-range/types';

/**
 * Matched relative chart intervals with exact dates and absent observations preserved.
 * @since 1.1.0
 */
export interface StatisticsComparisonChartBucket {
	date: LocalDate;
	endDate: LocalDate;
	previousDate: LocalDate;
	previousEndDate: LocalDate;
	current: StatisticsTotals | null;
	previous: StatisticsTotals | null;
}

/**
 * Eligible recorded previous period and aligned current/previous chart intervals.
 * @since 1.1.0
 */
export interface StatisticsComparisonView {
	previous: StatisticsRangeView;
	chartBuckets: StatisticsComparisonChartBucket[];
}
