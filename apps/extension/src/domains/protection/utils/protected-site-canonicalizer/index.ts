import { parse } from 'tldts';
import {
	CanonicalHostSchema,
	ProtectedSiteRuleSetSchema,
	type CanonicalHost,
	type ProtectedSiteRule,
	type ProtectedSiteRuleSet,
} from '../../types/protected-site-rule';
import { ProtectionScopeIdSchema } from '../../types/protection-value';
import {
	ProtectableUrlNormalizationStatus,
	ProtectedSiteInputSchema,
	normalizeProtectableUrl,
} from '../protectable-url-normalizer';
import {
	ProtectedSiteCanonicalizationRejectionReason,
	ProtectedSiteCanonicalizationStatus,
	ProtectedSiteRuleInputSetSchema,
	type ProtectedSiteCanonicalizationResult,
} from './types';

/**
 * Checks for URL navigation syntax or disallowed ASCII characters that cannot be stored as host data.
 * @param input - Unnormalized stored host.
 * @return Whether the host contains a forbidden character.
 * @since 0.1.0 Initial implementation.
 */
function containsForbiddenStoredHostCharacter( input: string ): boolean {
	for ( const character of input ) {
		const characterCode = character.charCodeAt( 0 );

		if (
			characterCode <= 0x20 ||
			characterCode === 0x7f ||
			'/\\?#@'.includes( character )
		) {
			return true;
		}
	}

	return false;
}

/**
 * Canonicalizes a stored rule host without applying public-suffix reduction.
 * @param input - An unnormalized stored host.
 * @return The canonical stored host, or null when navigation details or invalid syntax are present.
 * @since 0.1.0 Initial implementation.
 */
function canonicalizeStoredHost( input: string ): CanonicalHost | null {
	const isBracketedIpv6 = /^\[[^\]]+\]$/.test( input );
	const hasIpv6NavigationSyntax = input.includes( ':' ) || input.includes( '[' ) || input.includes( ']' );

	if (
		containsForbiddenStoredHostCharacter( input ) ||
		( hasIpv6NavigationSyntax && ! isBracketedIpv6 )
	) {
		return null;
	}

	const result = normalizeProtectableUrl( `https://${ input }` );
	return result.status === ProtectableUrlNormalizationStatus.NORMALIZED ? result.host : null;
}

/**
 * Canonicalizes an unknown stored rule set without mutating it.
 * @param input - Unknown stored rule-set input.
 * @return Canonical rules, or null when any rule or match range is invalid.
 * @since 0.1.0 Initial implementation.
 */
export function canonicalizeProtectedSiteRules( input: unknown ): ProtectedSiteRuleSet | null {
	const inputResult = ProtectedSiteRuleInputSetSchema.safeParse( input );

	if ( ! inputResult.success ) {
		return null;
	}

	const canonicalRules: ProtectedSiteRule[] = [];

	for ( const rule of inputResult.data ) {
		const host = canonicalizeStoredHost( rule.host );

		if ( host === null ) {
			return null;
		}

		canonicalRules.push( {
			host,
			includeSubdomains: rule.includeSubdomains,
			scopeId: rule.scopeId,
		} );
	}

	const ruleSetResult = ProtectedSiteRuleSetSchema.safeParse( canonicalRules );
	return ruleSetResult.success ? ruleSetResult.data : null;
}

/**
 * Converts a hostname or URL into one canonical protected-site rule.
 * @param input - Unknown protected-site input.
 * @param scopeId - Unknown protection scope identifier.
 * @return An accepted canonical rule or a stable rejection.
 * @since 0.1.0 Initial implementation.
 */
export function canonicalizeProtectedSite( input: unknown, scopeId: unknown ): ProtectedSiteCanonicalizationResult {
	const inputResult = ProtectedSiteInputSchema.safeParse( input );

	if ( ! inputResult.success ) {
		return {
			status: ProtectedSiteCanonicalizationStatus.REJECTED,
			reason: ProtectedSiteCanonicalizationRejectionReason.INVALID_INPUT,
		};
	}

	const scopeIdResult = ProtectionScopeIdSchema.safeParse( scopeId );

	if ( ! scopeIdResult.success ) {
		return {
			status: ProtectedSiteCanonicalizationStatus.REJECTED,
			reason: ProtectedSiteCanonicalizationRejectionReason.INVALID_SCOPE_ID,
		};
	}

	const urlResult = normalizeProtectableUrl( inputResult.data );

	if ( urlResult.status === ProtectableUrlNormalizationStatus.REJECTED ) {
		return {
			status: ProtectedSiteCanonicalizationStatus.REJECTED,
			reason: urlResult.reason,
		};
	}

	const hostnameDetails = parse( urlResult.host, {
		allowPrivateDomains: true,
		extractHostname: false,
	} );

	if (
		hostnameDetails.isIp ||
		urlResult.host === 'localhost' ||
		urlResult.host.endsWith( '.localhost' )
	) {
		return {
			status: ProtectedSiteCanonicalizationStatus.ACCEPTED,
			rule: {
				host: urlResult.host,
				includeSubdomains: false,
				scopeId: scopeIdResult.data,
			},
		};
	}

	if ( ( hostnameDetails.isIcann || hostnameDetails.isPrivate ) && hostnameDetails.domain !== null ) {
		return {
			status: ProtectedSiteCanonicalizationStatus.ACCEPTED,
			rule: {
				host: CanonicalHostSchema.parse( hostnameDetails.domain ),
				includeSubdomains: true,
				scopeId: scopeIdResult.data,
			},
		};
	}

	if ( hostnameDetails.isIcann || hostnameDetails.isPrivate ) {
		return {
			status: ProtectedSiteCanonicalizationStatus.REJECTED,
			reason: ProtectedSiteCanonicalizationRejectionReason.PUBLIC_SUFFIX,
		};
	}

	return {
		status: ProtectedSiteCanonicalizationStatus.ACCEPTED,
		rule: {
			host: urlResult.host,
			includeSubdomains: false,
			scopeId: scopeIdResult.data,
		},
	};
}

export {
	ProtectedSiteCanonicalizationRejectionReason,
	ProtectedSiteCanonicalizationRejectionReasonSchema,
	ProtectedSiteCanonicalizationResultSchema,
	ProtectedSiteCanonicalizationStatus,
	type ProtectedSiteCanonicalizationResult,
} from './types';
