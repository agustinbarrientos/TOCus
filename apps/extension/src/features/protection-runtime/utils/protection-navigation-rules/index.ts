import { type Browser } from 'wxt/browser';
import { type ProtectedSiteRule } from '../../../../domains/protection/types/protected-site-rule';

const INTERRUPTION_EXTENSION_PATH = '/interruption.html';
const NAVIGATION_RULE_PRIORITY = 1;
const PROTECTION_NAVIGATION_RULE_CAPACITY = 100_000;

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
 * Creates URL filters for one canonical protected-site match range.
 * @param rule - Canonical protected-site rule selected by the user.
 * @return One subdomain-aware filter or separate exact HTTP and HTTPS filters.
 * @since 0.1.0 Initial implementation.
 */
function createUrlFilters( rule: ProtectedSiteRule ): string[] {
	if ( rule.includeSubdomains ) {
		return [ `||${ rule.host }^` ];
	}

	return [
		`|http://${ rule.host }^`,
		`|https://${ rule.host }^`,
	];
}

/**
 * Creates one deterministic browser navigation redirect.
 * @param id - Positive identifier unique within the projected rule set.
 * @param urlFilter - Browser navigation filter for the protected match range.
 * @return Main-frame redirect to the interruption page.
 * @since 0.1.0 Initial implementation.
 */
function createNavigationRule(
	id: number,
	urlFilter: string,
): Browser.declarativeNetRequest.Rule {
	return {
		id,
		priority: NAVIGATION_RULE_PRIORITY,
		action: {
			type: 'redirect',
			redirect: {
				extensionPath: INTERRUPTION_EXTENSION_PATH,
			},
		},
		condition: {
			urlFilter,
			resourceTypes: [ 'main_frame' ],
		},
	};
}

/**
 * Creates browser navigation redirects for the protected sites selected by the user.
 * @param rules - Canonical protected-site rules selected by the user.
 * @return Deterministic main-frame redirect rules.
 * @since 0.1.0 Initial implementation.
 */
export function createProtectionNavigationRules(
	rules: readonly ProtectedSiteRule[],
): Browser.declarativeNetRequest.Rule[] {
	const orderedRules = [ ...rules ].sort( ( left, right ) => {
		const leftSortKey = `${ left.host }\0${ left.includeSubdomains ? '1' : '0' }\0${ left.scopeId }`;
		const rightSortKey = `${ right.host }\0${ right.includeSubdomains ? '1' : '0' }\0${ right.scopeId }`;

		return leftSortKey.localeCompare( rightSortKey, 'en' );
	} );
	const urlFilters = orderedRules.flatMap( createUrlFilters );

	return urlFilters.map( ( urlFilter, index ) => createNavigationRule(
		ProtectionNavigationRuleIdStart + index,
		urlFilter,
	) );
}
