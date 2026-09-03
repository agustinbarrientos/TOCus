import { type ProtectionCoordinator, type ProtectionCoordinatorStateSnapshot } from '../../../../domains/protection/services/protection-coordinator';
import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { type ProtectionRuntimeBrowser } from '../../types/browser-runtime';
import { type ProtectionRuntimeParticipantContext } from '../../utils/runtime-page-context';

/**
 * Dependencies used to reconcile browser focus with Waiting participants.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionFocusReconcilerOptions {
	/** Browser tab observations used to validate participant presentation. */
	browser: Pick<ProtectionRuntimeBrowser, 'listTabs'>;
	/** Authoritative protection-state reader. */
	coordinator: Pick<ProtectionCoordinator, 'getStates'>;
	/** Extension-owned interruption page URL. */
	interruptionPageUrl: string;

	/**
	 * Loads the current validated configuration.
	 * @return Current configuration or null when unavailable.
	 * @since 0.1.0 Initial implementation.
	 */
	loadConfiguration(): Promise<ProtectionConfigurationDocument | null>;

	/**
	 * Reconciles every allowance whose wall-clock interval has ended.
	 * @param configuration - Current validated configuration.
	 * @return Promise resolved after elapsed allowances are reconciled.
	 * @since 0.1.0 Initial implementation.
	 */
	reconcileExpiredAllowances( configuration: ProtectionConfigurationDocument ): Promise<void>;

	/**
	 * Reconciles persisted participants with current browser ownership.
	 * @param configuration - Current validated configuration.
	 * @return Promise resolved after stale participants are removed.
	 * @since 0.1.0 Initial implementation.
	 */
	reconcileParticipants( configuration: ProtectionConfigurationDocument ): Promise<void>;

	/**
	 * Reconciles active transactions against current schedules.
	 * @param configuration - Current validated configuration.
	 * @return Promise resolved after inactive schedules fail open.
	 * @since 0.1.0 Initial implementation.
	 */
	reconcileSchedules( configuration: ProtectionConfigurationDocument ): Promise<void>;

	/**
	 * Removes browser projections when configuration is unavailable.
	 * @return Promise resolved after fail-open browser projection.
	 * @since 0.1.0 Initial implementation.
	 */
	reconcileUnavailableConfiguration(): Promise<void>;

	/**
	 * Refreshes focus-dependent page warnings and the global toolbar badge from authoritative state.
	 * @param configuration - Current validated configuration.
	 * @param statesByScope - Current authoritative state snapshot.
	 * @return Promise resolved after focus-dependent presentation is current.
	 * @since 0.1.0 Initial implementation.
	 */
	refreshFocusEffects(
		configuration: ProtectionConfigurationDocument,
		statesByScope: ProtectionCoordinatorStateSnapshot | null,
	): Promise<void>;

	/**
	 * Synchronizes one Waiting participant with current page and browser focus.
	 * @param context - Current participant and state.
	 * @param documentVisible - Whether the participant presentation is available.
	 * @param configuration - Current validated configuration.
	 * @return Promise resolved after any focus ownership change.
	 * @since 0.1.0 Initial implementation.
	 */
	synchronizeParticipantFocus(
		context: ProtectionRuntimeParticipantContext,
		documentVisible: boolean,
		configuration: ProtectionConfigurationDocument,
	): Promise<void>;
}

/**
 * Reconciles Waiting participant ownership after browser focus changes.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionFocusReconciler {
	/**
	 * Reconciles current participant presentation, focus, and toolbar state.
	 * @return Promise resolved after focus reconciliation.
	 * @since 0.1.0 Initial implementation.
	 */
	reconcile(): Promise<void>;
}
