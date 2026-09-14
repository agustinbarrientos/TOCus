import type { ProtectedSiteConfiguration } from '../../../../domains/protection/types/protected-site-configuration';
import type { ScheduleDraft } from '../../../settings/utils/schedule-draft/types';

/**
 * Editable website details, including incomplete weekly fields.
 * @since 0.1.0
 */
export interface WebsiteDetailsDraft {
	displayName: string;
	schedule: ScheduleDraft | null;
}

/**
 * Complete page draft guarded during Settings navigation.
 * @since 0.1.0
 */
export interface WebsitesDraft {
	sites: ProtectedSiteConfiguration[];
	address: string;
	newSite: WebsiteDetailsDraft;
	detailsByHost: Record<string, WebsiteDetailsDraft>;
}
