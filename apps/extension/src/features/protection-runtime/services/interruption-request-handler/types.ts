import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { type ProtectionCoordinator, type ProtectionCoordinatorDispatchResult, type ProtectionCoordinatorStateSnapshot } from '../../../../domains/protection/services/protection-coordinator';
import { type DepartureCause } from '../../../../domains/protection/types/protection-event';
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
	 * @since 0.1.0 Initial implementation.
	 */
	applyDispatchResult(
		result: ProtectionCoordinatorDispatchResult,
		configuration: ProtectionConfigurationDocument,
	): Promise<void>;
	/**
	 * Creates one fresh runtime identifier fragment.
	 * @return Collision-resistant identifier fragment.
	 * @since 0.1.0 Initial implementation.
	 */
	createStableId(): string;
	/**
	 * Removes a participant associated with one browser tab.
	 * @param tabId - Browser tab identifier.
	 * @param cause - Observable departure cause.
	 * @param configuration - Current validated configuration or unavailable marker.
	 * @return Promise resolved after matching participant state is removed.
	 * @since 0.1.0 Initial implementation.
	 */
	departTab(
		tabId: number,
		cause: DepartureCause,
		configuration: ProtectionConfigurationDocument | null,
	): Promise<void>;
	/**
	 * Returns the current local IANA time zone.
	 * @return Current IANA time-zone identifier.
	 * @since 0.1.0 Initial implementation.
	 */
	getTimeZone(): string;
	/**
	 * Loads the current validated configuration.
	 * @return Current configuration or null when unavailable.
	 * @since 0.1.0 Initial implementation.
	 */
	loadConfiguration(): Promise<ProtectionConfigurationDocument | null>;
	/**
	 * Returns the current wall-clock epoch time.
	 * @return Current epoch milliseconds.
	 * @since 0.1.0 Initial implementation.
	 */
	now(): number;
	/**
	 * Reconciles every allowance whose wall-clock interval has ended.
	 * @param configuration - Current validated configuration.
	 * @return Promise resolved after elapsed allowances are reconciled.
	 * @since 0.1.0 Initial implementation.
	 */
	reconcileExpiredAllowances( configuration: ProtectionConfigurationDocument ): Promise<void>;
	/**
	 * Releases one interruption presentation that no longer has authoritative runtime state.
	 * @param tabId - Browser tab containing the orphaned presentation.
	 * @return Promise resolved after local release or a verified stale-tab race.
	 * @since 0.1.0 Initial implementation.
	 */
	releaseInterruptionPresentation( tabId: number ): Promise<void>;
	/**
	 * Refreshes the global toolbar badge from authoritative state.
	 * @param configuration - Current validated configuration.
	 * @param statesByScope - Current authoritative state snapshot.
	 * @return Promise resolved after toolbar presentation is current.
	 * @since 0.1.0 Initial implementation.
	 */
	refreshToolbarBadge(
		configuration: ProtectionConfigurationDocument,
		statesByScope: ProtectionCoordinatorStateSnapshot | null,
	): Promise<void>;
	/**
	 * Removes browser projections when configuration is unavailable.
	 * @return Promise resolved after fail-open browser projection.
	 * @since 0.1.0 Initial implementation.
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
	 * @param protectionEligible - Whether the sender is explicitly outside private browsing.
	 * @return Current authoritative page projection.
	 * @since 0.1.0 Initial implementation.
	 */
	handle(
		input: unknown,
		senderTabId: number | null,
		protectionEligible?: boolean,
	): Promise<InterruptionPageResponse>;
	/**
	 * Synchronizes one Waiting participant with current page and browser focus.
	 * @param context - Current participant and state.
	 * @param documentVisible - Whether the interruption document is visible.
	 * @param configuration - Current validated configuration.
	 * @return Promise resolved after any focus ownership change.
	 * @since 0.1.0 Initial implementation.
	 */
	synchronizeParticipantFocus: (
		context: ProtectionRuntimeParticipantContext,
		documentVisible: boolean,
		configuration: ProtectionConfigurationDocument,
	) => Promise<void>;
}
