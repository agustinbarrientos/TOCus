import type { ProtectedSiteRule } from '../../../../domains/protection/types/protected-site-rule';
import type { ProtectedSiteConfiguration } from '../../../../domains/protection/types/protected-site-configuration';
import type { TimingConfiguration } from '../../../../domains/protection/types/timing-configuration';
import type { ScheduleDraft } from '../../../settings/utils/schedule-draft/types';

/**
 * Editable website details, including incomplete weekly fields.
 * @since 1.0.0
 */
export interface WebsiteDetailsDraft {
	displayName: string;
	schedule: ScheduleDraft | null;
	behavior: NonNullable<ProtectedSiteRule['behavior']>;
	timingConfiguration: TimingConfiguration | null;
}

/**
 * Complete page draft guarded during Settings navigation.
 * @since 1.0.0
 */
export interface WebsitesDraft {
	sites: ProtectedSiteConfiguration[];
	address: string;
	newSite: WebsiteDetailsDraft;
	detailsByRuleKey: Record<string, WebsiteDetailsDraft>;
}
