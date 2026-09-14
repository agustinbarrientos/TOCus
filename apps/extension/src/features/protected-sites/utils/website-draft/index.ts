import { ProtectedSiteConfigurationSetSchema, ProtectedSiteDisplayNameInputSchema,
	type ProtectedSiteConfiguration } from '../../../../domains/protection/types/protected-site-configuration';
import { fromSchedule, toSchedule } from '../../../settings/utils/schedule-draft';
import type { WebsiteDetailsDraft, WebsitesDraft } from './types';

/**
 * Creates editable details while leaving a blank display name automatic.
 * @param site - Persisted site being edited.
 * @return Raw name and controlled active-time override.
 * @since 0.1.0
 */
export function createWebsiteDetails( site: ProtectedSiteConfiguration ): WebsiteDetailsDraft {
	return { displayName: site.displayNameOverride ?? '',
		schedule: site.schedule ? fromSchedule( site.schedule ) : null };
}

/**
 * Adopts the authoritative site set into a complete navigation-guarded draft.
 * @param sites - Current protected sites.
 * @return Clean initial website draft.
 * @since 0.1.0
 */
export function createWebsiteDraft( sites: ProtectedSiteConfiguration[] ): WebsitesDraft {
	return { sites, address: '', newSite: { displayName: '', schedule: null },
		detailsByHost: Object.fromEntries( sites.map( ( site ) => [ site.identityHost,
			createWebsiteDetails( site ) ] ) ) };
}

/**
 * Validates and normalizes every site together before one atomic write.
 * @param draft - Complete pending website edits.
 * @return Persistable site set, or a validation failure for incomplete fields.
 * @since 0.1.0
 */
export function serializeWebsiteDraft( draft: WebsitesDraft ): ProtectedSiteConfiguration[] {
	return ProtectedSiteConfigurationSetSchema.parse( draft.sites.map( ( site ) => {
		const details = draft.detailsByHost[ site.identityHost ] ?? createWebsiteDetails( site );
		const displayName = ProtectedSiteDisplayNameInputSchema.parse( details.displayName );
		return { identityHost: site.identityHost, rule: site.rule,
			...( displayName ? { displayNameOverride: displayName } : {} ),
			...( details.schedule === null ? {} : { schedule: toSchedule( details.schedule ) } ),
		};
	} ) );
}
