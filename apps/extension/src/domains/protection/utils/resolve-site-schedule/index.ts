import type { ProtectionConfigurationDocument } from '../../types/protected-site-configuration';
import type { ProtectedSiteRule } from '../../types/protected-site-rule';
import { resolveSitePolicy } from '../resolve-site-policy';
import type { NormalizedSchedule } from '../../types/protection-schedule';

/**
 * Resolves active hours for one configured matching rule without changing timer ownership.
 * @param configuration - Current shared protection configuration.
 * @param ruleHost - Canonical target, or a legacy whole-host lookup.
 * @return The site's override or global schedule, or undefined when the rule was removed.
 * @since 1.0.0
 */
export function resolveSiteSchedule(
	configuration: ProtectionConfigurationDocument,
	ruleHost: string | ProtectedSiteRule,
): NormalizedSchedule | undefined {
	const rule = typeof ruleHost === 'string'
		? configuration.sites.find( ( candidate ) =>
			candidate.rule.host === ruleHost && candidate.rule.pathPrefix === undefined )?.rule
		: ruleHost;
	return rule === undefined ? undefined : resolveSitePolicy( configuration, rule )?.schedule;
}
