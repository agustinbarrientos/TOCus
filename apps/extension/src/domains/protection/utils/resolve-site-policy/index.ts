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
 * Resolves entry overrides, then a paused main website, then global settings.
 * Paths prefer a covering root on their own host; no-pause parents do not supply overrides.
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
	const sameHostParent = site.rule.pathPrefix !== undefined && configuration.sites.some( ( candidate ) =>
		candidate.rule.host === site.rule.host && candidate.rule.pathPrefix === undefined &&
		coversHostRange( candidate.rule, site.rule ) );
	const parentHost = sameHostParent ? site.rule.host : groupHost;
	const mainTargets = isMainWebsite ? [] : configuration.sites.filter( ( candidate ) =>
		candidate.rule.host === parentHost && candidate.rule.pathPrefix === undefined &&
		coversHostRange( candidate.rule, site.rule ) );
	const selectedMain = mainTargets.find( ( candidate ) => ! candidate.rule.includeSubdomains ) ?? mainTargets[ 0 ];
	const main = selectedMain?.rule.behavior === 'allow' ? undefined : selectedMain;

	return {
		site,
		schedule: site.schedule ?? main?.schedule ?? configuration.schedule,
		timingConfiguration: site.timingConfiguration ?? main?.timingConfiguration ?? configuration.timingConfiguration,
	};
}

export type { ResolvedSitePolicy } from './types';
