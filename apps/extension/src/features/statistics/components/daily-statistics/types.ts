import { z } from 'zod';
import type { SVGProps } from 'react';
import type { StatisticsChartBucket } from '../../utils/select-statistics-range/types';
import type { StatisticsComparisonView } from '../../utils/select-statistics-comparison/types';
import type { StatisticsSettingsScreenCopy } from '../settings-screen/types';

/**
 * Recorded daily aggregates and localized chart presentation.
 * @since 1.0.0
 */
export interface DailyStatisticsProps {
	totals: readonly StatisticsChartBucket[];
	copy: StatisticsSettingsScreenCopy;
	comparison?: StatisticsComparisonView;
}

/**
 * Accessible naming attributes forwarded by the chart library to its root SVG.
 * @since 1.0.0
 */
export type DailyStatisticsChartAccessibility = Pick<SVGProps<SVGSVGElement>, 'aria-labelledby'>;

/**
 * Metrics available in the recorded daily activity chart.
 * @since 1.1.0
 */
export const DailyStatisticsMetric = {
	RECONSIDERED: 'reconsideredVisitCount',
	COMPLETED: 'completedWaitCount',
	ESTIMATE: 'estimatedReclaimedMilliseconds',
} as const;

/**
 * Validates the metric selected in the daily activity control.
 * @since 1.1.0
 */
export const DailyStatisticsMetricSchema = z.enum( DailyStatisticsMetric );

/**
 * Selected daily chart metric.
 * @since 1.1.0
 */
export type DailyStatisticsMetric = z.infer<typeof DailyStatisticsMetricSchema>;
