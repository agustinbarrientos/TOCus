import type { ProtectionConfigurationDocument } from '../../types/protected-site-configuration';
import type { ProtectedSiteRule } from '../../types/protected-site-rule';
import { getProtectedSiteGroupHost, getProtectedSiteRuleKey } from '../protected-site-rule-key';
import type { ResolvedSitePolicy } from './types';

/**
 * Resolves entry overrides, then main website overrides, then global settings.
 * Intermediate paths never participate in inheritance and removed rules have no policy.
 * @param configuration - Current stored or staged shared configuration.
 * @param rule - Canonical target to resolve; behavior and scope do not identify a target.
 * @return Effective policy, or undefined for a removed target.
 * @since 1.0.1
 */
export function resolveSitePolicy(
	configuration: ProtectionConfigurationDocument,
	rule: ProtectedSiteRule,
): ResolvedSitePolicy | undefined {
	const key = getProtectedSiteRuleKey( rule );
	const site = configuration.sites.find( ( candidate ) => getProtectedSiteRuleKey( candidate.rule ) === key );
	if ( site === undefined ) {
		return undefined;
	}

	const groupHost = getProtectedSiteGroupHost( site.rule.host );
	const mainTargets = configuration.sites.filter( ( candidate ) => candidate.rule.host === groupHost &&
		candidate.rule.pathPrefix === undefined );
	const main = mainTargets.find( ( candidate ) => ! candidate.rule.includeSubdomains ) ?? mainTargets[ 0 ];

	return {
		site,
		schedule: site.schedule ?? main?.schedule ?? configuration.schedule,
		timingConfiguration: site.timingConfiguration ?? main?.timingConfiguration ?? configuration.timingConfiguration,
	};
}

export type { ResolvedSitePolicy } from './types';
