import type { ProtectionConfigurationDocument } from '../../types/protected-site-configuration';
import type { ProtectedSiteRule } from '../../types/protected-site-rule';
import { resolveSitePolicy, type ResolvedSitePolicy } from '../resolve-site-policy';

/**
 * Resolves a rule selected from the same validated configuration snapshot.
 * @param configuration - Configuration used to select the rule.
 * @param rule - Existing rule returned by matching or enumerating that configuration.
 * @return The required effective policy.
 * @throws {Error} When the caller mixes a rule with a different configuration snapshot.
 * @since 1.1.0
 */
export function requireSitePolicy(
	configuration: ProtectionConfigurationDocument,
	rule: ProtectedSiteRule,
): ResolvedSitePolicy {
	const policy = resolveSitePolicy( configuration, rule );
	if ( policy === undefined ) {
		throw new Error( 'Matched website policy is missing.' );
	}
	return policy;
}
