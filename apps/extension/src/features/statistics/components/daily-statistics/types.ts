import type { SVGProps } from 'react';
import type { StatisticsChartBucket } from '../../utils/select-statistics-range/types';
import type { StatisticsSettingsScreenCopy } from '../settings-screen/types';

/**
 * Recorded daily aggregates and localized chart presentation.
 * @since 1.0.0
 */
export interface DailyStatisticsProps {
	totals: readonly StatisticsChartBucket[];
	copy: StatisticsSettingsScreenCopy;
}

/**
 * Accessible naming attributes forwarded by the chart library to its root SVG.
 * @since 1.0.0
 */
export type DailyStatisticsChartAccessibility = Pick<SVGProps<SVGSVGElement>, 'aria-labelledby'>;
