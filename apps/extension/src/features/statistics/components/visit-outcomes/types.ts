import type { StatisticsBreakdownsView } from '../../utils/select-statistics-range/types';
import type { StatisticsSettingsScreenCopy, StatisticsSiteIdentity } from '../settings-screen/types';

/**
 * Recorded breakdowns and separately prepared website identities.
 * @since 1.1.0
 */
export interface VisitOutcomesProps {
	copy: StatisticsSettingsScreenCopy;
	breakdowns: StatisticsBreakdownsView;
	siteIdentities?: ReadonlyMap<string, StatisticsSiteIdentity>;
}
