import type { Browser } from 'wxt/browser';
import type { ProtectedSiteRule } from '../../../../domains/protection/types/protected-site-rule';

const PROTECTION_NAVIGATION_RULE_CAPACITY = 100_000;
const REGEX_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/gu;

/**
 * First dynamic-rule identifier reserved for protected-site redirects.
 * @since 1.0.0 Initial implementation.
 */
export const ProtectionNavigationRuleIdStart = 1_000_000;

/**
 * Reports whether a dynamic-rule identifier belongs to protected-site navigation.
 * @param ruleId - Dynamic browser rule identifier.
 * @return Whether the identifier falls inside the reserved protection range.
 * @since 1.0.0 Initial implementation.
 */
export function isProtectionNavigationRuleId( ruleId: number ): boolean {
	return ruleId >= ProtectionNavigationRuleIdStart &&
		ruleId < ProtectionNavigationRuleIdStart + PROTECTION_NAVIGATION_RULE_CAPACITY;
}

/**
 * Escapes one canonical host for literal use in a declarative request regex.
 * @param host - Canonical host selected by the user.
 * @return Regex-safe literal host.
 * @since 1.0.0 Initial implementation.
 */
function escapeRegexHost( host: string ): string {
	return host.replace( REGEX_SPECIAL_CHARACTERS, '\\$&' );
}

/**
 * Creates the full-URL selector used for both browser preflight and interception.
 * @param rule - Canonical website target.
 * @return Case-sensitive regex preserving the entire destination for substitution.
 * @since 1.1.0
 */
export function createProtectionNavigationRegex( rule: ProtectedSiteRule ): string {
	const host = `${ rule.includeSubdomains ? '([^/?#@:.]+\\.)*' : '' }${ escapeRegexHost( rule.host ) }${ rule.host.startsWith( '[' ) ? '' : '\\.?' }`;
	const path = rule.pathPrefix === undefined ? '([/?#].*)?' : `${ escapeRegexHost( rule.pathPrefix ) }([/?#].*)?`;
	return `^https?://([^/?#@]*@)?${ host }(:[0-9]+)?${ path }$`;
}

/**
 * Creates deterministic selectors ranked in the same order as URL matching.
 * @param rules - Complete winning-policy ranges, including allowed ranges.
 * @param interruptionPageUrl - Trusted packaged interruption-page URL.
 * @return Full-URL main-frame redirect and allow rules.
 * @since 1.1.0 Website exceptions.
 */
export function createProtectionNavigationRules(
	rules: readonly ProtectedSiteRule[],
	interruptionPageUrl: string,
): Browser.declarativeNetRequest.Rule[] {
	if ( rules.every( ( rule ) => rule.behavior === 'allow' ) ) {
		return [];
	}
	const orderedRules = [ ...rules ].sort( ( left, right ) =>
		left.host.length - right.host.length ||
		Number( ! left.includeSubdomains ) - Number( ! right.includeSubdomains ) ||
		( left.pathPrefix?.length ?? 0 ) - ( right.pathPrefix?.length ?? 0 ) ||
		JSON.stringify( left ).localeCompare( JSON.stringify( right ), 'en' ),
	);
	return orderedRules.map( ( rule, index ) => {
		return {
			id: ProtectionNavigationRuleIdStart + index,
			priority: index + 1,
			action: rule.behavior === 'allow' ? { type: 'allow' } : {
				type: 'redirect', redirect: { regexSubstitution: `${ interruptionPageUrl }#destination=\\0` },
			},
			condition: {
				regexFilter: createProtectionNavigationRegex( rule ),
				isUrlFilterCaseSensitive: true,
				resourceTypes: [ 'main_frame' ],
			},
		};
	} );
}
