import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { type ProtectionCoordinator, type ProtectionCoordinatorDispatchResult, type ProtectionCoordinatorStateSnapshot } from '../../../../domains/protection/services/protection-coordinator';
import { type InterruptionPageResponse } from '../../types/runtime-message';
import { type ProtectionRuntimeParticipantContext } from '../../utils/runtime-page-context';
import { type ProtectionRuntimeBrowser } from '../../types/browser-runtime';

/**
 * Dependencies used to handle interruption-page requests.
 * @since 0.1.0 Initial implementation.
 */
export interface InterruptionRequestHandlerOptions {
	/** Browser focus observation required for waiting ownership. */
	browser: Pick<ProtectionRuntimeBrowser, 'getFocusedTabId'>;
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
	 * Loads the current validated configuration.
	 * @return Current configuration or null when unavailable.
	 */
	loadConfiguration(): Promise<ProtectionConfigurationDocument | null>;
	/**
	 * Returns the current wall-clock epoch time.
	 * @return Current epoch milliseconds.
	 */
	now(): number;
	/**
	 * Reconciles every allowance whose wall-clock interval has ended.
	 * @param configuration - Current validated configuration.
	 * @return Promise resolved after elapsed allowances are reconciled.
	 */
	reconcileExpiredAllowances( configuration: ProtectionConfigurationDocument ): Promise<void>;
	/**
	 * Refreshes the global toolbar badge from authoritative state.
	 * @param configuration - Current validated configuration.
	 * @param statesByScope - Current authoritative state snapshot.
	 * @return Promise resolved after toolbar presentation is current.
	 */
	refreshToolbarBadge(
		configuration: ProtectionConfigurationDocument,
		statesByScope: ProtectionCoordinatorStateSnapshot | null,
	): Promise<void>;
	/**
	 * Removes browser projections when configuration is unavailable.
	 * @return Promise resolved after fail-open browser projection.
	 */
	reconcileUnavailableConfiguration(): Promise<void>;
}

/**
 * Authoritative interruption-page request and focus handling.
 * @since 0.1.0 Initial implementation.
 */
export interface InterruptionRequestHandler {
	/**
	 * Handles one unknown interruption-page request.
	 * @param input - Unknown extension message payload.
	 * @param senderTabId - Browser-provided sender tab identifier.
	 * @return Current authoritative page projection.
	 */
	handle( input: unknown, senderTabId: number | null ): Promise<InterruptionPageResponse>;
	/**
	 * Synchronizes one Waiting participant with current page and browser focus.
	 * @param context - Current participant and state.
	 * @param documentVisible - Whether the interruption document is visible.
	 * @param configuration - Current validated configuration.
	 * @return Promise resolved after any focus ownership change.
	 */
	synchronizeParticipantFocus: (
		context: ProtectionRuntimeParticipantContext,
		documentVisible: boolean,
		configuration: ProtectionConfigurationDocument,
	) => Promise<void>;
}
