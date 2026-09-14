import type { SVGProps } from 'react';
import type { DailyStatisticsTotals } from '../../../../domains/statistics/types/statistics-document';
import type { StatisticsSettingsScreenCopy } from '../settings-screen/types';

/**
 * Recorded daily aggregates and localized chart presentation.
 * @since 0.1.0
 */
export interface DailyStatisticsProps {
	totals: readonly DailyStatisticsTotals[];
	copy: StatisticsSettingsScreenCopy;
}

/**
 * Accessible naming attributes forwarded by the chart library to its root SVG.
 * @since 0.1.0
 */
export type DailyStatisticsChartAccessibility = Pick<SVGProps<SVGSVGElement>, 'aria-labelledby'>;
