import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { type ProtectionCoordinator, type ProtectionCoordinatorDispatchResult } from '../../../../domains/protection/services/protection-coordinator';
import { type ProtectionRuntimeBrowser } from '../../types/browser-runtime';

/**
 * Dependencies used to reconcile elapsed visit allowances.
 * @since 0.1.0 Initial implementation.
 */
export interface AllowanceExpiryReconcilerOptions {
	/** Browser observations required to discover protected live pages. */
	browser: Pick<ProtectionRuntimeBrowser, 'getFocusedTabId' | 'listTabs'>;
	/** Serialized protection-state coordinator. */
	coordinator: Pick<ProtectionCoordinator, 'dispatch' | 'getStates'>;
	/**
	 * Applies one persisted domain result to browser projections.
	 * @param result - Persisted coordinator result.
	 * @param configuration - Current validated configuration.
	 * @return Promise resolved after browser effects are current.
	 */
	applyDispatchResult(
		result: ProtectionCoordinatorDispatchResult,
		configuration: ProtectionConfigurationDocument,
	): Promise<void>;
	/**
	 * Creates one fresh runtime identifier fragment.
	 * @return Collision-resistant identifier fragment.
	 */
	createStableId(): string;
	/**
	 * Returns the current local IANA time zone.
	 * @return Current IANA time-zone identifier.
	 */
	getTimeZone(): string;
	/**
	 * Returns the current wall-clock epoch time.
	 * @return Current epoch milliseconds.
	 */
	now(): number;
}

/**
 * Reconciles every allowance whose wall-clock interval has ended.
 * @since 0.1.0 Initial implementation.
 */
export interface AllowanceExpiryReconciler {
	/**
	 * Applies elapsed allowance transitions using fresh Ready and live-page observations.
	 * @param configuration - Current validated local configuration.
	 * @return Promise resolved after every elapsed allowance is reconciled.
	 */
	reconcile: ( configuration: ProtectionConfigurationDocument ) => Promise<void>;
}
