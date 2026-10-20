import { getProtectedSiteGroupHost } from '../../../../domains/protection/utils/protected-site-rule-key';
import { resolveSitePolicy } from '../../../../domains/protection/utils/resolve-site-policy';
import { ProtectionStateType } from '../../../../domains/protection/types/protection-state';
import { ScheduleEvaluationStatus } from '../../../../domains/protection/types/schedule-evaluation';
import { evaluateSchedule } from '../../../../domains/protection/utils/schedule-evaluator';
import { createProtectionNavigationRules, createProtectionNavigationRegex } from '../../utils/protection-navigation-rules';
import type {
	NavigationRuleReconciler,
	NavigationRuleReconcilerOptions,
} from './types';

/**
 * Creates dynamic-rule reconciliation for protected top-level navigation.
 * @param options - Browser, clock, and time-zone dependencies.
 * @return Navigation-rule reconciliation operation.
 * @since 1.0.0 Initial implementation.
 */
export function createNavigationRuleReconciler(
	options: NavigationRuleReconcilerOptions,
): NavigationRuleReconciler {
	const regexSupport = new Map<string, boolean>();
	/**
	 * Replaces redirect rules with the complete currently active set.
	 * @param configuration - Current validated local configuration or unavailable marker.
	 * @param statesByScope - Current authoritative states or unavailable marker.
	 * @return Promise resolved after atomic browser reconciliation.
	 * @since 1.0.0 Initial implementation.
	 */
	async function reconcile(
		configuration: Parameters<NavigationRuleReconciler[ 'reconcile' ]>[ 0 ],
		statesByScope: Parameters<NavigationRuleReconciler[ 'reconcile' ]>[ 1 ],
	): Promise<void> {
		if ( configuration === null || statesByScope === null ) {
			await options.replaceNavigationRules( [] );
			return;
		}

		const nowEpochMilliseconds = options.now();
		const activeRules = configuration.sites.map( ( site ) => {
			const state = statesByScope[ site.rule.scopeId ];
			const hasActiveAllowance = state?.type === ProtectionStateType.ALLOWANCE &&
				nowEpochMilliseconds < state.expiresAtEpochMilliseconds;
			const schedule = resolveSitePolicy( configuration, site.rule )?.schedule;

			const active = ! hasActiveAllowance && evaluateSchedule(
				schedule,
				nowEpochMilliseconds,
				options.getTimeZone(),
			).status === ScheduleEvaluationStatus.ACTIVE;
			return active ? site.rule : { ...site.rule, behavior: 'allow' as const };
		} );

		let supportedRules = activeRules;
		if ( options.isNavigationRegexSupported !== undefined ) {
			const selectors = activeRules.map( ( rule ) => ( {
				rule, regex: createProtectionNavigationRegex( rule ), group: getProtectedSiteGroupHost( rule.host ),
			} ) );
			const currentRegexes = new Set( selectors.map( ( selector ) => selector.regex ) );
			for ( const regex of regexSupport.keys() ) {
				if ( ! currentRegexes.has( regex ) ) {
					regexSupport.delete( regex );
				}
			}
			const unsupportedGroups = new Set<string>();
			for ( const selector of selectors ) {
				if ( ! regexSupport.has( selector.regex ) ) {
					regexSupport.set( selector.regex, await options.isNavigationRegexSupported( selector.regex ) );
				}
				if ( regexSupport.get( selector.regex ) === false ) {
					unsupportedGroups.add( selector.group );
				}
			}
			// A broad public suffix can overlap several private-domain groups. Remove the full
			// connected host range so an unsupported child never leaves a parent redirect behind.
			let changed = true;
			while ( changed ) {
				changed = false;
				for ( const selector of selectors ) {
					if ( unsupportedGroups.has( selector.group ) ) {
						continue;
					}
					const overlaps = selectors.some( ( other ) => unsupportedGroups.has( other.group ) && (
						( other.rule.includeSubdomains && selector.rule.host.endsWith( `.${ other.rule.host }` ) ) ||
						( selector.rule.includeSubdomains && other.rule.host.endsWith( `.${ selector.rule.host }` ) )
					) );
					if ( overlaps ) {
						unsupportedGroups.add( selector.group );
						changed = true;
					}
				}
			}
			supportedRules = activeRules.filter(
				( rule ) => ! unsupportedGroups.has( getProtectedSiteGroupHost( rule.host ) ),
			);
		}

		await options.replaceNavigationRules( createProtectionNavigationRules(
			supportedRules,
			options.interruptionPageUrl,
		) );
	}

	return { reconcile };
}

export * from './types';
