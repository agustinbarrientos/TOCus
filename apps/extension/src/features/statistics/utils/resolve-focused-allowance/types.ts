import { type ProtectionCoordinatorStateSnapshot } from '../../../../domains/protection/services/protection-coordinator';
import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { type StatisticsDocument } from '../../../../domains/statistics/types/statistics-document';
import {
	type ProtectionRuntimeNavigation,
	type ProtectionRuntimeTab,
} from '../../../protection-runtime/types/browser-runtime';

/**
 * Browser and protection observations used to resolve focused allowance work.
 * @since 0.1.0 Initial implementation.
 */
export interface ResolveFocusedAllowanceInput {
	configuration: ProtectionConfigurationDocument;
	statisticsDocument: StatisticsDocument;
	statesByScope: ProtectionCoordinatorStateSnapshot;
	focusedTabId: number | null;
	nowEpochMilliseconds: number;
	tabs: ReadonlyArray<ProtectionRuntimeTab>;
	navigation?: ProtectionRuntimeNavigation;
}
