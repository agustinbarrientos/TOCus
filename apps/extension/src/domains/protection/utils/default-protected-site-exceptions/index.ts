import type { ProtectedSiteConfiguration } from '../../types/protected-site-configuration';
import { getProtectedSiteRuleKey } from '../protected-site-rule-key';

/** Default policies applied only when a new covering website root is enrolled. */
const DefaultProtectedSiteExceptionCatalog = [
	{ rootHost: 'youtube.com', exceptions: [
		{ host: 'studio.youtube.com', includeSubdomains: false, behavior: 'allow' },
	] },
] as const;

/**
 * Adds catalog exceptions for newly enrolled broad roots while preserving explicit user targets.
 * Reads, replacements and ordinary policy updates must retain their exact existing site set.
 * @param existingSites - Saved or staged targets that must not be enrolled again.
 * @param additions - Complete explicit additions, including all targets in a batch.
 * @return Explicit additions followed by any missing default exceptions.
 * @since 1.1.0
 */
export function expandProtectedSiteAdditions(
	existingSites: readonly ProtectedSiteConfiguration[],
	additions: readonly ProtectedSiteConfiguration[],
): ProtectedSiteConfiguration[] {
	const expanded = [ ...additions ];
	const existingKeys = new Set( existingSites.map( ( site ) => getProtectedSiteRuleKey( site.rule ) ) );
	for ( const site of additions ) {
		if ( existingKeys.has( getProtectedSiteRuleKey( site.rule ) ) ||
			! site.rule.includeSubdomains || site.rule.pathPrefix !== undefined ) {
			continue;
		}
		const defaults = DefaultProtectedSiteExceptionCatalog.find( ( entry ) => entry.rootHost === site.rule.host );
		for ( const exception of defaults?.exceptions ?? [] ) {
			// Exact defaults must not outrank an explicit broad path or replace a whole-host policy.
			if ( [ ...existingSites, ...expanded ].some( ( candidate ) =>
				candidate.rule.host === exception.host &&
				( candidate.rule.pathPrefix === undefined || candidate.rule.includeSubdomains ),
			) ) {
				continue;
			}
			expanded.push( { identityHost: exception.host,
				rule: { ...exception, scopeId: site.rule.scopeId } } );
		}
	}
	return expanded;
}
