import type { StatisticsRangeView } from '../../utils/select-statistics-range/types';
import type { StatisticsSettingsScreenCopy } from '../settings-screen/types';

/**
 * Already-visible metric with exact current and previous calendar periods.
 * @since 1.1.0
 */
export interface StatisticsTrendTagProps {
	copy: StatisticsSettingsScreenCopy;
	metric: string;
	current: number;
	previous: number;
	currentRange: StatisticsRangeView;
	previousRange: StatisticsRangeView;
}
