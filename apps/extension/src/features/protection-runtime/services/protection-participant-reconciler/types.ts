import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { type ProtectionCoordinator, type ProtectionCoordinatorDispatchResult } from '../../../../domains/protection/services/protection-coordinator';
import { type DepartureCause } from '../../../../domains/protection/types/protection-event';
import { type BrowserProtectionProjector } from '../browser-protection-projector/types';
import { type ProtectionRuntimeBrowser } from '../../types/browser-runtime';

/**
 * Dependencies used to reconcile browser-backed protection participants.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionParticipantReconcilerOptions {
	/** Browser observations used to validate live participant ownership. */
	browser: Pick<ProtectionRuntimeBrowser, 'listTabs'>;
	/** Serialized protection-state coordinator. */
	coordinator: Pick<ProtectionCoordinator, 'dispatch' | 'getStates'>;
	/** Extension-owned interruption page URL. */
	interruptionPageUrl: string;
	/**
	 * Applies one persisted domain result to browser projections.
	 * @param result - Persisted coordinator result.
	 * @param configuration - Current validated configuration or unavailable marker.
	 * @return Promise resolved after browser effects are current.
	 * @since 0.1.0 Initial implementation.
	 */
	applyDispatchResult(
		result: ProtectionCoordinatorDispatchResult,
		configuration: ProtectionConfigurationDocument | null,
	): Promise<void>;
	/**
	 * Removes an injected interruption only for one authoritative allowance-expiry participant.
	 * @param participant - Known allowance-expiry participant retaining the injected page identity.
	 * @return Promise resolved after removal or when the owned layer is no longer present.
	 * @since 0.1.0 Initial implementation.
	 */
	releaseInjectedInterruption: BrowserProtectionProjector[ 'releaseInjectedInterruption' ];
	/**
	 * Releases one tab only while it still displays the interruption page.
	 * @param tabId - Browser tab that may display the interruption page.
	 * @param retainedDestination - Validated destination to restore, or null for browser-native dismissal.
	 * @return Promise resolved after release or a verified stale-tab race.
	 * @since 0.1.0 Initial implementation.
	 */
	releaseNavigationIfInterrupted: BrowserProtectionProjector[ 'releaseNavigationIfInterrupted' ];
	/**
	 * Returns the current wall-clock epoch time.
	 * @return Current epoch milliseconds.
	 * @since 0.1.0 Initial implementation.
	 */
	now(): number;
}

/**
 * Reconciles persisted protection participants with current browser ownership.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionParticipantReconciler {
	/**
	 * Removes one participant associated with a browser tab.
	 * @param tabId - Browser tab identifier.
	 * @param cause - Observable departure cause.
	 * @param configuration - Current validated configuration or unavailable marker.
	 * @return Promise resolved after matching participant state is removed.
	 * @since 0.1.0 Initial implementation.
	 */
	departTab: (
		tabId: number,
		cause: DepartureCause,
		configuration: ProtectionConfigurationDocument | null,
	) => Promise<void>;
	/**
	 * Removes every retained participant after runtime protection becomes unavailable.
	 * @param cause - Observable departure cause shared by the invalidated participants.
	 * @param configuration - Current validated configuration or unavailable marker.
	 * @return Promise resolved after every retained participant is removed.
	 * @since 0.1.0 Initial implementation.
	 */
	departAll(
		cause: DepartureCause,
		configuration: ProtectionConfigurationDocument | null,
	): Promise<void>;
	/**
	 * Removes participants whose tab or configured protection ownership is no longer current.
	 * @param configuration - Current validated local configuration.
	 * @return Promise resolved after stale participants and interruption pages are released.
	 * @since 0.1.0 Initial implementation.
	 */
	reconcile: ( configuration: ProtectionConfigurationDocument ) => Promise<void>;
}
