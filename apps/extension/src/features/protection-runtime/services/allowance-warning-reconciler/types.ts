import { type ProtectionCoordinatorStateSnapshot } from '../../../../domains/protection/services/protection-coordinator';
import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { type ProtectionRuntimeBrowser } from '../../types/browser-runtime';

/**
 * Browser and clock dependencies used to reconcile allowance expiry guards and quiet warnings.
 * @since 0.1.0 Initial implementation.
 */
export interface AllowanceWarningReconcilerOptions {
	/** Browser observations and protected-page presentation effects. */
	browser: Pick<
		ProtectionRuntimeBrowser,
		'getFocusedTabId' | 'getProtectedPagePresentation' | 'listTabs' | 'updateProtectedPagePresentation'
	>;

	/**
	 * Returns the current local IANA time zone.
	 * @return Current IANA time-zone identifier.
	 * @since 0.1.0 Initial implementation.
	 */
	getTimeZone(): string;

	/**
	 * Returns the current wall-clock epoch time.
	 * @return Current epoch milliseconds.
	 * @since 0.1.0 Initial implementation.
	 */
	now(): number;
}

/**
 * Reconciles page-local expiry guards and quiet warnings against authoritative allowance state.
 * @since 0.1.0 Initial implementation.
 */
export interface AllowanceWarningReconciler {
	/**
	 * Arms every eligible page guard, presents only the focused warning, and removes stale effects.
	 * @param configuration - Current validated configuration or unavailable marker.
	 * @param statesByScope - Current authoritative states or unavailable marker.
	 * @return Promise resolved after all best-effort page effects settle.
	 * @since 0.1.0 Initial implementation.
	 */
	reconcile(
		configuration: ProtectionConfigurationDocument | null,
		statesByScope: ProtectionCoordinatorStateSnapshot | null,
	): Promise<void>;
}
