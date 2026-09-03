import { ProtectionStateType } from '../../../../domains/protection/types/protection-state';
import { ScheduleEvaluationStatus } from '../../../../domains/protection/types/schedule-evaluation';
import { evaluateSchedule } from '../../../../domains/protection/utils/schedule-evaluator';
import { createProtectionNavigationRules } from '../../utils/protection-navigation-rules';
import {
	type NavigationRuleReconciler,
	type NavigationRuleReconcilerOptions,
} from './types';

/**
 * Creates dynamic-rule reconciliation for protected top-level navigation.
 * @param options - Browser, clock, and time-zone dependencies.
 * @return Navigation-rule reconciliation operation.
 * @since 0.1.0 Initial implementation.
 */
export function createNavigationRuleReconciler(
	options: NavigationRuleReconcilerOptions,
): NavigationRuleReconciler {
	/**
	 * Replaces redirect rules with the complete currently active set.
	 * @param configuration - Current validated local configuration or unavailable marker.
	 * @param statesByScope - Current authoritative states or unavailable marker.
	 * @return Promise resolved after atomic browser reconciliation.
	 * @since 0.1.0 Initial implementation.
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
		const activeRules = configuration.sites.filter( ( site ) => {
			const state = statesByScope[ site.rule.scopeId ];
			const hasActiveAllowance = state?.type === ProtectionStateType.ALLOWANCE &&
				nowEpochMilliseconds < state.expiresAtEpochMilliseconds;
			const schedule = configuration.schedulesByScope[ site.rule.scopeId ];

			return ! hasActiveAllowance && schedule !== undefined && evaluateSchedule(
				schedule,
				nowEpochMilliseconds,
				options.getTimeZone(),
			).status === ScheduleEvaluationStatus.ACTIVE;
		} ).map( ( site ) => site.rule );

		await options.replaceNavigationRules( createProtectionNavigationRules( activeRules ) );
	}

	return { reconcile };
}

export * from './types';
