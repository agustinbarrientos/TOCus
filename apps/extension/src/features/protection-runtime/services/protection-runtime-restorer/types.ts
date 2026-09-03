import {
	type ProtectionCoordinator,
	type ProtectionCoordinatorDispatchResult,
} from '../../../../domains/protection/services/protection-coordinator';
import { type ProtectionDecision } from '../../../../domains/protection/types/protection-decision';
import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { type ProtectionRuntimeTab } from '../../types/browser-runtime';

/**
 * Dependencies used to restore protection runtime state after background startup.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionRuntimeRestorerOptions {
	coordinator: ProtectionCoordinator;
	interruptionPageUrl: string;

	/**
	 * Applies decisions emitted while persisted state is restored.
	 * @param decisions - Persisted restoration decisions.
	 * @param configuration - Current validated configuration or unavailable marker.
	 * @return Promise resolved after browser effects are projected.
	 * @since 0.1.0 Initial implementation.
	 */
	applyDecisions(
		decisions: ReadonlyArray<ProtectionDecision>,
		configuration: ProtectionConfigurationDocument | null,
	): Promise<void>;

	/**
	 * Applies one persisted reconciliation dispatch result.
	 * @param result - Coordinator dispatch result.
	 * @param configuration - Current validated configuration or unavailable marker.
	 * @return Promise resolved after browser effects are projected.
	 * @since 0.1.0 Initial implementation.
	 */
	applyDispatchResult(
		result: ProtectionCoordinatorDispatchResult,
		configuration: ProtectionConfigurationDocument | null,
	): Promise<void>;

	/**
	 * Returns the current local IANA time zone.
	 * @return Current IANA time-zone identifier.
	 * @since 0.1.0 Initial implementation.
	 */
	getTimeZone(): string;

	/**
	 * Lists open browser tabs visible to the extension.
	 * @return Current browser tab observations.
	 * @since 0.1.0 Initial implementation.
	 */
	listTabs(): Promise<ReadonlyArray<ProtectionRuntimeTab>>;

	/**
	 * Loads the current validated local configuration.
	 * @return Validated configuration or null when it cannot be trusted.
	 * @since 0.1.0 Initial implementation.
	 */
	loadConfiguration(): Promise<ProtectionConfigurationDocument | null>;

	/**
	 * Returns the current wall-clock epoch time.
	 * @return Current epoch milliseconds.
	 * @since 0.1.0 Initial implementation.
	 */
	now(): number;
}

/**
 * Restores persisted protection state and resolves incomplete Ready participants.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionRuntimeRestorer {
	/**
	 * Restores authoritative state before queued browser events are processed.
	 * @return True after successful restoration, or false after failed initialization.
	 * @since 0.1.0 Initial implementation.
	 */
	restore(): Promise<boolean>;
}
