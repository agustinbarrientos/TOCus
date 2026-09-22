import type { Browser } from 'wxt/browser';
import type { ProtectedSiteRule } from '../../../../domains/protection/types/protected-site-rule';

const NAVIGATION_RULE_PRIORITY = 1;
const PROTECTION_NAVIGATION_RULE_CAPACITY = 100_000;
const PROTECTABLE_URL_REGEX_FILTER = '^https?://.*';
const REGEX_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/gu;

/**
 * First dynamic-rule identifier reserved for protected-site redirects.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionNavigationRuleIdStart = 1_000_000;

/**
 * Reports whether a dynamic-rule identifier belongs to protected-site navigation.
 * @param ruleId - Dynamic browser rule identifier.
 * @return Whether the identifier falls inside the reserved protection range.
 * @since 0.1.0 Initial implementation.
 */
export function isProtectionNavigationRuleId( ruleId: number ): boolean {
	return ruleId >= ProtectionNavigationRuleIdStart &&
		ruleId < ProtectionNavigationRuleIdStart + PROTECTION_NAVIGATION_RULE_CAPACITY;
}

/**
 * Escapes one canonical host for literal use in a declarative request regex.
 * @param host - Canonical host selected by the user.
 * @return Regex-safe literal host.
 * @since 0.1.0 Initial implementation.
 */
function escapeRegexHost( host: string ): string {
	return host.replace( REGEX_SPECIAL_CHARACTERS, '\\$&' );
}

/**
 * Creates one full-URL regex restricted to an exact canonical host.
 * @param host - Canonical host selected by the user.
 * @return Anchored HTTP(S) URL regex preserving credentials, ports, paths, queries, and fragments.
 * @since 0.1.0 Initial implementation.
 */
function createExactHostRegexFilter( host: string ): string {
	return `^https?://([^/?#@]*@)?${ escapeRegexHost( host ) }(:[0-9]+)?([/?#].*)?$`;
}

/**
 * Creates one deterministic browser navigation redirect.
 * @param id - Positive identifier unique within the projected rule set.
 * @param condition - Browser navigation condition for the protected match range.
 * @param interruptionPageUrl - Trusted packaged interruption-page URL.
 * @return Main-frame redirect to the interruption page.
 * @since 0.1.0 Initial implementation.
 */
function createNavigationRule(
	id: number,
	condition: Browser.declarativeNetRequest.RuleCondition,
	interruptionPageUrl: string,
): Browser.declarativeNetRequest.Rule {
	return {
		id,
		priority: NAVIGATION_RULE_PRIORITY,
		action: {
			type: 'redirect',
			redirect: {
				regexSubstitution: `${ interruptionPageUrl }#destination=\\0`,
			},
		},
		condition: {
			...condition,
			resourceTypes: [ 'main_frame' ],
		},
	};
}

/**
 * Creates browser navigation redirects for the protected sites selected by the user.
 * @param rules - Canonical protected-site rules selected by the user.
 * @param interruptionPageUrl - Trusted packaged interruption-page URL.
 * @return Deterministic main-frame redirect rules.
 * @since 0.1.0 Initial implementation.
 */
export function createProtectionNavigationRules(
	rules: readonly ProtectedSiteRule[],
	interruptionPageUrl: string,
): Browser.declarativeNetRequest.Rule[] {
	const orderedRules = [ ...rules ].sort( ( left, right ) => {
		const leftSortKey = `${ left.host }\0${ left.includeSubdomains ? '1' : '0' }\0${ left.scopeId }`;
		const rightSortKey = `${ right.host }\0${ right.includeSubdomains ? '1' : '0' }\0${ right.scopeId }`;

		return leftSortKey.localeCompare( rightSortKey, 'en' );
	} );
	const subdomainHosts = orderedRules
		.filter( ( rule ) => rule.includeSubdomains )
		.map( ( rule ) => rule.host );
	const exactHostRules = orderedRules.filter( ( rule ) => ! rule.includeSubdomains );
	const conditions: Browser.declarativeNetRequest.RuleCondition[] = [
		...( subdomainHosts.length === 0 ? [] : [ {
			regexFilter: PROTECTABLE_URL_REGEX_FILTER,
			requestDomains: subdomainHosts,
		} ] ),
		...exactHostRules.map( ( rule ) => ( {
			regexFilter: createExactHostRegexFilter( rule.host ),
		} ) ),
	];

	return conditions.map( ( condition, index ) => createNavigationRule(
		ProtectionNavigationRuleIdStart + index,
		condition,
		interruptionPageUrl,
	) );
}
