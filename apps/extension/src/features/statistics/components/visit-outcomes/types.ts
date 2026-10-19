import type { StatisticsBreakdownsView, StatisticsRangeView } from '../../utils/select-statistics-range/types';
import type { StatisticsSettingsScreenCopy, StatisticsSiteIdentity } from '../settings-screen/types';

/**
 * Recorded breakdowns and separately prepared website identities.
 * @since 1.1.0
 */
export interface VisitOutcomesProps {
	copy: StatisticsSettingsScreenCopy;
	breakdowns: StatisticsBreakdownsView;
	currentRange?: StatisticsRangeView;
	previousRange?: StatisticsRangeView | undefined;
	siteIdentities?: ReadonlyMap<string, StatisticsSiteIdentity>;
}
