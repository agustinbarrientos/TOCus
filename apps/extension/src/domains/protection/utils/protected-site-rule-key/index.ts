import { parse } from 'tldts';
import type { ProtectedSiteRule } from '../../types/protected-site-rule';

/**
 * Identifies a canonical target independently of editable behavior and scope.
 * @param rule - Canonical stored or staged rule.
 * @return Stable key containing host, descendant coverage and path.
 * @since 1.1.0
 */
export function getProtectedSiteRuleKey( rule: ProtectedSiteRule ): string {
	return JSON.stringify( [ rule.host, rule.includeSubdomains, rule.pathPrefix ?? '/' ] );
}

/**
 * Finds the website identity for presentation and main-website inheritance only.
 * This never creates or changes a matching rule, including for path-only groups.
 * @param host - Canonical target host.
 * @return Registrable host, or the unchanged local, IP or unclassified host.
 * @since 1.1.0
 */
export function getProtectedSiteGroupHost( host: string ): string {
	const details = parse( host, { allowPrivateDomains: true, extractHostname: false } );
	return ( details.isIcann || details.isPrivate ) && details.domain !== null ? details.domain : host;
}
