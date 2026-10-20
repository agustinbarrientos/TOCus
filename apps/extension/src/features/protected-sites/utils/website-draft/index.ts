import { expandProtectedSiteAdditions } from '../../../../domains/protection/utils/default-protected-site-exceptions';
import { getProtectedSiteRuleKey } from '../../../../domains/protection/utils/protected-site-rule-key';
import { ProtectedSiteConfigurationSetSchema, ProtectedSiteDisplayNameInputSchema,
	type ProtectedSiteConfiguration } from '../../../../domains/protection/types/protected-site-configuration';
import { fromSchedule, toSchedule } from '../../../settings/utils/schedule-draft';
import type { WebsiteDetailsDraft, WebsitesDraft } from './types';

/**
 * Creates editable details while leaving a blank display name automatic.
 * @param site - Persisted site being edited.
 * @return Raw name and controlled active-time override.
 * @since 1.0.0
 */
export function createWebsiteDetails( site: ProtectedSiteConfiguration ): WebsiteDetailsDraft {
	return { displayName: site.displayNameOverride ?? '',
		behavior: site.rule.behavior ?? 'pause', timingConfiguration: site.timingConfiguration ?? null,
		schedule: site.schedule ? fromSchedule( site.schedule ) : null };
}

/**
 * Adopts the authoritative site set into a complete navigation-guarded draft.
 * @param sites - Current protected sites.
 * @return Clean initial website draft.
 * @since 1.0.0
 */
export function createWebsiteDraft( sites: ProtectedSiteConfiguration[] ): WebsitesDraft {
	return { sites, address: '', newSite: { displayName: '', schedule: null, behavior: 'pause', timingConfiguration: null },
		detailsByRuleKey: Object.fromEntries( sites.map( ( site ) => [ getProtectedSiteRuleKey( site.rule ),
			createWebsiteDetails( site ) ] ) ) };
}

/**
 * Stages editable additions against pending pause behavior while retaining incomplete draft fields.
 * @param draft - Current website draft before the addition.
 * @param site - Canonical new target whose details are held in the address editor.
 * @return Independent draft containing the new target and any default exceptions.
 * @since 1.1.0
 */
export function stageWebsiteDraftSite( draft: WebsitesDraft, site: ProtectedSiteConfiguration ): WebsitesDraft {
	const pendingSites = draft.sites.map( ( existing ) => {
		const details = draft.detailsByRuleKey[ getProtectedSiteRuleKey( existing.rule ) ];
		return details === undefined ? existing : { ...existing,
			rule: { ...existing.rule, behavior: details.behavior } };
	} );
	const additions = expandProtectedSiteAdditions( pendingSites, [ site ] );
	return { ...draft, sites: [ ...draft.sites, ...additions ], address: '',
		detailsByRuleKey: { ...draft.detailsByRuleKey,
			...Object.fromEntries( additions.map( ( addition ) => [ getProtectedSiteRuleKey( addition.rule ),
				createWebsiteDetails( addition ) ] ) ),
			[ getProtectedSiteRuleKey( site.rule ) ]: draft.newSite },
		newSite: { displayName: '', schedule: null, behavior: 'pause', timingConfiguration: null } };
}

/**
 * Validates and normalizes every site together before one atomic write.
 * @param draft - Complete pending website edits.
 * @return Persistable site set, or a validation failure for incomplete fields.
 * @since 1.0.0
 */
export function serializeWebsiteDraft( draft: WebsitesDraft ): ProtectedSiteConfiguration[] {
	return ProtectedSiteConfigurationSetSchema.parse( draft.sites.map( ( site ) => {
		const details = draft.detailsByRuleKey[ getProtectedSiteRuleKey( site.rule ) ] ?? createWebsiteDetails( site );
		const displayName = ProtectedSiteDisplayNameInputSchema.parse( details.displayName );
		const rule = { ...site.rule };
		delete rule.behavior;
		return { identityHost: site.identityHost, rule: { ...rule,
			...( details.behavior === 'allow' ? { behavior: 'allow' as const } : {} ) },
		...( details.timingConfiguration === null ? {} : { timingConfiguration: details.timingConfiguration } ),
		...( displayName ? { displayNameOverride: displayName } : {} ),
		...( details.schedule === null ? {} : { schedule: toSchedule( details.schedule ) } ),
		};
	} ) );
}
