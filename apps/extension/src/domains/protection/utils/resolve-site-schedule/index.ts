import type { ProtectionConfigurationDocument } from '../../types/protected-site-configuration';
import type { NormalizedSchedule } from '../../types/protection-schedule';

/**
 * Resolves active hours for one configured matching rule without changing timer ownership.
 * @param configuration - Current shared protection configuration.
 * @param ruleHost - Canonical matching-rule host.
 * @return The site's override or global schedule, or undefined when the rule was removed.
 * @since 0.1.0
 */
export function resolveSiteSchedule(
	configuration: ProtectionConfigurationDocument,
	ruleHost: string,
): NormalizedSchedule | undefined {
	const site = configuration.sites.find( ( candidate ) => candidate.rule.host === ruleHost );
	return site === undefined ? undefined : site.schedule ?? configuration.schedule;
}
