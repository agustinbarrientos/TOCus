import {
	ProtectedUrlMatchStatus,
	ProtectedUrlUnsupportedReason,
	type ProtectedUrlMatchResult,
} from '../../types/protected-url-match';
import type { ProtectedSiteRule } from '../../types/protected-site-rule';
import { canonicalizeProtectedSiteRules } from '../protected-site-canonicalizer';
import {
	normalizeProtectableUrl,
	ProtectableUrlNormalizationStatus,
} from '../protectable-url-normalizer';

/**
 * Compares target specificity in host, coverage, then path order.
 * @param candidate - Matching candidate rule.
 * @param current - Current most specific match.
 * @return Whether the candidate must replace the current match.
 * @since 1.0.1
 */
function isMoreSpecific( candidate: ProtectedSiteRule, current: ProtectedSiteRule ): boolean {
	if ( candidate.host.length !== current.host.length ) {
		return candidate.host.length > current.host.length;
	}
	if ( candidate.includeSubdomains !== current.includeSubdomains ) {
		return ! candidate.includeSubdomains;
	}
	return ( candidate.pathPrefix?.length ?? 0 ) > ( current.pathPrefix?.length ?? 0 );
}

/**
 * Matches a navigation against canonical protected-site hosts by exact label boundary.
 * @param input - Unknown navigation input.
 * @param rules - Unknown stored protected-site rules.
 * @return A protected, unprotected, or unsupported navigation result.
 * @since 1.0.0 Initial implementation.
 */
export function matchProtectedUrl( input: unknown, rules: unknown ): ProtectedUrlMatchResult {
	const canonicalRules = canonicalizeProtectedSiteRules( rules );

	if ( canonicalRules === null ) {
		return {
			status: ProtectedUrlMatchStatus.UNSUPPORTED,
			reason: ProtectedUrlUnsupportedReason.INVALID_RULE_SET,
		};
	}

	const urlResult = normalizeProtectableUrl( input );

	if ( urlResult.status === ProtectableUrlNormalizationStatus.REJECTED ) {
		return {
			status: ProtectedUrlMatchStatus.UNSUPPORTED,
			reason: urlResult.reason,
		};
	}

	let winner: ProtectedSiteRule | undefined;
	for ( const rule of canonicalRules ) {
		const hostMatches = urlResult.host === rule.host ||
			( rule.includeSubdomains && urlResult.host.endsWith( `.${ rule.host }` ) );
		const pathMatches = rule.pathPrefix === undefined || urlResult.url.pathname === rule.pathPrefix ||
			urlResult.url.pathname.startsWith( `${ rule.pathPrefix }/` );
		if ( ! hostMatches || ! pathMatches ) {
			continue;
		}

		if ( winner === undefined || isMoreSpecific( rule, winner ) ) {
			winner = rule;
		}
	}

	if ( winner !== undefined ) {
		return {
			status: winner.behavior === 'allow' ? ProtectedUrlMatchStatus.UNPROTECTED : ProtectedUrlMatchStatus.PROTECTED,
			rule: winner,
		};
	}

	return { status: ProtectedUrlMatchStatus.UNPROTECTED };
}
