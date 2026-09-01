import {
	ProtectedUrlMatchStatus,
	ProtectedUrlUnsupportedReason,
	type ProtectedUrlMatchResult,
} from '../../types/protected-url-match';
import { canonicalizeProtectedSiteRules } from '../protected-site-canonicalizer';
import {
	normalizeProtectableUrl,
	ProtectableUrlNormalizationStatus,
} from '../protectable-url-normalizer';

/**
 * Matches a navigation against canonical protected-site hosts by exact label boundary.
 * @param input - Unknown navigation input.
 * @param rules - Unknown stored protected-site rules.
 * @return A protected, unprotected, or unsupported navigation result.
 * @since 0.1.0 Initial implementation.
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

	for ( const rule of canonicalRules ) {
		if (
			urlResult.host === rule.host ||
			( rule.includeSubdomains && urlResult.host.endsWith( `.${ rule.host }` ) )
		) {
			return {
				status: ProtectedUrlMatchStatus.PROTECTED,
				rule,
			};
		}
	}

	return { status: ProtectedUrlMatchStatus.UNPROTECTED };
}
