import { type Browser } from 'wxt/browser';
import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { type ProtectionCoordinatorStateSnapshot } from '../../../../domains/protection/services/protection-coordinator';

/**
 * Dependencies used to reconcile extension-owned navigation redirects.
 * @since 0.1.0 Initial implementation.
 */
export interface NavigationRuleReconcilerOptions {
	/** Replaces every extension-owned dynamic navigation rule. */
	replaceNavigationRules: ( rules: Browser.declarativeNetRequest.Rule[] ) => Promise<void>;
	/** Returns the current local IANA time zone. */
	getTimeZone: () => string;
	/** Returns the current wall-clock epoch time. */
	now: () => number;
}

/**
 * Reconciles dynamic navigation redirects with configuration, schedules, and allowances.
 * @since 0.1.0 Initial implementation.
 */
export interface NavigationRuleReconciler {
	/**
	 * Replaces redirect rules with the complete currently active set.
	 * @param configuration - Current validated local configuration or unavailable marker.
	 * @param statesByScope - Current authoritative states or unavailable marker.
	 * @return Promise resolved after atomic browser reconciliation.
	 * @since 0.1.0 Initial implementation.
	 */
	reconcile(
		configuration: ProtectionConfigurationDocument | null,
		statesByScope: ProtectionCoordinatorStateSnapshot | null,
	): Promise<void>;
}
