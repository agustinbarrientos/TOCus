import type { ProtectionConfigurationDocument } from '../../types/protected-site-configuration';
import type { ProtectedSiteRule } from '../../types/protected-site-rule';
import { getProtectedSiteGroupHost, getProtectedSiteRuleKey } from '../protected-site-rule-key';
import type { ResolvedSitePolicy } from './types';

/**
 * Checks whether a root rule contains the complete host range of an exception.
 * @param parent - Candidate no-path main website rule.
 * @param child - Exception rule whose exact or descendant host range must fit.
 * @return Whether every host covered by the child is also covered by the root.
 * @since 1.1.0
 */
function coversHostRange( parent: ProtectedSiteRule, child: ProtectedSiteRule ): boolean {
	if ( parent.host === child.host ) {
		return parent.includeSubdomains || ! child.includeSubdomains;
	}
	return parent.includeSubdomains && child.host.endsWith( `.${ parent.host }` );
}

/**
 * Resolves entry overrides, then main website overrides, then global settings.
 * Intermediate paths never participate in inheritance and removed rules have no policy.
 * @param configuration - Current stored or staged shared configuration.
 * @param rule - Canonical target to resolve; behavior and scope do not identify a target.
 * @return Effective policy, or undefined for a removed target.
 * @since 1.1.0
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
	const isMainWebsite = site.rule.host === groupHost && site.rule.pathPrefix === undefined;
	const mainTargets = isMainWebsite ? [] : configuration.sites.filter( ( candidate ) =>
		candidate.rule.host === groupHost && candidate.rule.pathPrefix === undefined &&
		coversHostRange( candidate.rule, site.rule ) );
	const main = mainTargets.find( ( candidate ) => ! candidate.rule.includeSubdomains ) ?? mainTargets[ 0 ];

	return {
		site,
		schedule: site.schedule ?? main?.schedule ?? configuration.schedule,
		timingConfiguration: site.timingConfiguration ?? main?.timingConfiguration ?? configuration.timingConfiguration,
	};
}

export type { ResolvedSitePolicy } from './types';
