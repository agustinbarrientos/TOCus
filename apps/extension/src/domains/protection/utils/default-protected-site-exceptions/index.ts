import type { ProtectedSiteConfiguration } from '../../types/protected-site-configuration';
import { getProtectedSiteRuleKey } from '../protected-site-rule-key';

/** Default policies applied only when a new covering website root is enrolled. */
const DefaultProtectedSiteExceptionCatalog = [
	{ rootHost: 'youtube.com', exceptions: [
		{ host: 'studio.youtube.com', includeSubdomains: false, behavior: 'allow' },
	] },
] as const;

/**
 * Adds editable no-pause path parents and catalog exceptions while preserving explicit targets.
 * Reads, replacements and ordinary policy updates must retain their exact existing site set.
 * @param existingSites - Saved or staged targets that must not be enrolled again.
 * @param additions - Complete explicit additions, including all targets in a batch.
 * @return Explicit additions followed by missing path parents and default exceptions.
 * @since 1.1.0
 */
export function expandProtectedSiteAdditions(
	existingSites: readonly ProtectedSiteConfiguration[],
	additions: readonly ProtectedSiteConfiguration[],
): ProtectedSiteConfiguration[] {
	const expanded = [ ...additions ];
	const explicitSites = [ ...existingSites, ...additions ];
	const explicitRules = explicitSites.map( ( site ) => site.rule );
	const rootHosts = new Set( explicitSites.filter( ( site ) => site.rule.pathPrefix === undefined )
		.map( ( site ) => site.rule.host ) );
	for ( const site of additions ) {
		if ( site.rule.pathPrefix === undefined || rootHosts.has( site.rule.host ) ) {
			continue;
		}
		// A more-specific allowed host must not bypass any paused path on a covering ancestor.
		if ( explicitRules.some( ( rule ) => rule.behavior !== 'allow' && rule.includeSubdomains &&
			site.rule.host.endsWith( `.${ rule.host }` ) ) ) {
			continue;
		}
		expanded.push( { identityHost: site.rule.host, rule: {
			host: site.rule.host,
			includeSubdomains: explicitSites.some( ( candidate ) => candidate.rule.host === site.rule.host &&
				candidate.rule.pathPrefix !== undefined && candidate.rule.includeSubdomains ),
			scopeId: site.rule.scopeId,
			behavior: 'allow',
		} } );
		rootHosts.add( site.rule.host );
	}
	const existingKeys = new Set( existingSites.map( ( site ) => getProtectedSiteRuleKey( site.rule ) ) );
	for ( const site of expanded ) {
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
