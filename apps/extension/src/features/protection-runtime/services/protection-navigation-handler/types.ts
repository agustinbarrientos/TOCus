import { type ProtectionCoordinator, type ProtectionCoordinatorDispatchResult } from '../../../../domains/protection/services/protection-coordinator';
import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { type DepartureCause } from '../../../../domains/protection/types/protection-event';
import { type ScheduleEvaluationResult } from '../../../../domains/protection/types/schedule-evaluation';
import { type ProtectionRuntimeBrowser, type ProtectionRuntimeNavigation } from '../../types/browser-runtime';

/**
 * Dependencies used to reconcile observed browser navigation.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionNavigationHandlerOptions {
	/** Browser focus observation used to initialize participant ownership. */
	browser: Pick<ProtectionRuntimeBrowser, 'getFocusedTabId'>;
	/** Serialized protection-state coordinator. */
	coordinator: Pick<ProtectionCoordinator, 'dispatch' | 'getStates'>;
	/** Extension-owned interruption page URL. */
	interruptionPageUrl: string;

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
	 * @param configuration - Current validated configuration.
	 * @return Promise resolved after matching participant state is removed.
	 * @since 0.1.0 Initial implementation.
	 */
	departTab(
		tabId: number,
		cause: DepartureCause,
		configuration: ProtectionConfigurationDocument,
	): Promise<void>;

	/**
	 * Evaluates the current schedule for one protection scope.
	 * @param configuration - Current validated configuration.
	 * @param scopeId - Protection scope being evaluated.
	 * @param nowEpochMilliseconds - Current wall-clock time.
	 * @param timeZone - Current IANA time-zone identifier.
	 * @return Current schedule evaluation.
	 * @since 0.1.0 Initial implementation.
	 */
	evaluateScopeSchedule(
		configuration: ProtectionConfigurationDocument,
		scopeId: string,
		nowEpochMilliseconds: number,
		timeZone: string,
	): ScheduleEvaluationResult;

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
	 * Reconciles browser effects from current configuration and state.
	 * @param configuration - Current validated configuration.
	 * @return Promise resolved after browser projection is current.
	 * @since 0.1.0 Initial implementation.
	 */
	reconcileBrowserState( configuration: ProtectionConfigurationDocument ): Promise<void>;

	/**
	 * Reconciles every allowance whose wall-clock interval has ended.
	 * @param configuration - Current validated configuration.
	 * @return Promise resolved after elapsed allowances are reconciled.
	 * @since 0.1.0 Initial implementation.
	 */
	reconcileExpiredAllowances( configuration: ProtectionConfigurationDocument ): Promise<void>;

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
	 * Releases one tab only while it still displays the interruption page.
	 * @param tabId - Browser tab that may display the interruption page.
	 * @param retainedDestination - Validated destination to restore.
	 * @return Promise resolved after release or a verified stale-tab race.
	 * @since 0.1.0 Initial implementation.
	 */
	releaseNavigationIfInterrupted( tabId: number, retainedDestination: string ): Promise<void>;
}

/**
 * Reconciles observed browser navigation with authoritative protection state.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionNavigationHandler {
	/**
	 * Handles one observed top-level browser navigation.
	 * @param navigation - Browser navigation details.
	 * @return Promise resolved after navigation reconciliation.
	 * @since 0.1.0 Initial implementation.
	 */
	handle( navigation: ProtectionRuntimeNavigation ): Promise<void>;
}
