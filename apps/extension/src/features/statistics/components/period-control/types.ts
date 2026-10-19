import type { StatisticsRange } from '../../utils/select-statistics-range/types';
import type { StatisticsSettingsScreenCopy } from '../settings-screen/types';

/**
 * Transient calendar selection and independently eligible comparison state.
 * @since 1.1.0
 */
export interface StatisticsPeriodControlProps {
	copy: StatisticsSettingsScreenCopy;
	range: StatisticsRange;
	comparison: boolean;
	canCompare: boolean;
	onRangeChange: ( range: StatisticsRange ) => void;
	onComparisonChange: ( enabled: boolean ) => void;
}
