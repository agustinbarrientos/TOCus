import { type ProtectionConfigurationStorageService } from '../../../../domains/protection/services/protection-configuration-storage';
import { type ProtectionCoordinator } from '../../../../domains/protection/services/protection-coordinator';
import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { type StatisticsProjection } from '../../../../domains/statistics/types/statistics-projection';
import {
	type ProtectionRuntimeBrowser,
	type ProtectionRuntimeNavigation,
	type ProtectionRuntimeTab,
} from '../../../protection-runtime/types/browser-runtime';
import { type StatisticsFocusObservationMode } from '../../../../domains/statistics/utils/prepare-statistics-checkpoint';
import { type StatisticsRuntime } from '../statistics-runtime';

/**
 * Browser focus inputs captured when one protection event reaches the runtime.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserProtectionStatisticsFocusObservation {
	/** Wall-clock time captured only after browser focus inspection completed. */
	focusedAtEpochMilliseconds: number;
	/** Browser tab that had focus, or null while no browser window had focus. */
	focusedTabId: number | null;
	/** Open tabs captured before queued protection work can delay the event. */
	tabs: ReadonlyArray<ProtectionRuntimeTab>;
	/** Top-level navigation that produced this observation, when applicable. */
	navigation?: ProtectionRuntimeNavigation;
}

/**
 * Browser event identity used to reject an asynchronously stale focus snapshot.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserProtectionFocusEventIdentity {
	/** Activated browser tab when supplied by a tab-focus event. */
	tabId?: number;
	/** Browser window supplied by the focus event. */
	windowId: number;
}

/**
 * Event-time browser inputs awaiting authoritative post-operation protection state.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserProtectionStatisticsObservation {
	/** Wall-clock time captured at event ingress, or null when unsafe. */
	observedAtEpochMilliseconds: number | null;
	/** Complete browser focus inputs, or null when the browser snapshot failed. */
	focusObservation: BrowserProtectionStatisticsFocusObservation | null;
	/** Focus epoch persistence initiated before browser inspection began. */
	focusEpochTransition: Awaited<ReturnType<StatisticsRuntime[ 'beginFocusObservation' ]>>;
}

/**
 * Dependencies used by one browser statistics bridge.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserStatisticsBridgeOptions {
	browser: Pick<ProtectionRuntimeBrowser, 'getFocusedTabId' | 'listTabs'>;
	configurationStorage: Pick<ProtectionConfigurationStorageService, 'load'>;
	coordinator: Pick<
		ProtectionCoordinator,
		'getStates' |
		'getStatisticsDelivery' |
		'getStatisticsDeliveryBoundary' |
		'initialize'
	>;
	statisticsRuntime: Pick<
		StatisticsRuntime,
		'beginFocusObservation' |
		'checkpoint' |
		'discardFocusMeasurement' |
		'drainProtectionFacts' |
		'getSnapshot' |
		'reconcileConfiguration' |
		'reset'
	>;

	/**
	 * Returns the current wall-clock epoch time.
	 * @return Current epoch milliseconds.
	 * @since 0.1.0 Initial implementation.
	 */
	now(): number;
}

/**
 * Browser observation and persistence coordination for local statistics.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserStatisticsBridge {
	/**
	 * Captures browser focus and time before a protection queue can delay one event.
	 * @param mode - Relationship between this observation and browser focus state.
	 * @param navigation - Optional top-level navigation received with the event.
	 * @param focusEvent - Exact browser focus event identity, null when malformed, or undefined for another boundary.
	 * @return Privacy-safe event-ingress browser observation.
	 * @since 0.1.0 Initial implementation.
	 */
	captureObservation(
		mode: StatisticsFocusObservationMode,
		navigation?: ProtectionRuntimeNavigation,
		focusEvent?: BrowserProtectionFocusEventIdentity | null,
	): Promise<BrowserProtectionStatisticsObservation>;

	/**
	 * Queues removal of focus measurement that cannot remain valid without protection.
	 * @since 0.1.0 Initial implementation.
	 */
	discardFocusMeasurement(): void;

	/**
	 * Queues one completed protection operation for fact delivery and checkpointing.
	 * @param configuration - Trusted post-operation configuration, or null after failure.
	 * @param observation - Browser inputs captured when the event reached the runtime.
	 * @since 0.1.0 Initial implementation.
	 */
	observeProtectionOperation(
		configuration: ProtectionConfigurationDocument | null,
		observation: Promise<BrowserProtectionStatisticsObservation>,
	): void;

	/**
	 * Returns the latest trustworthy all-time statistics projection.
	 * @return Available local totals or an unavailable projection.
	 * @since 0.1.0 Initial implementation.
	 */
	readStatistics(): Promise<StatisticsProjection>;

	/**
	 * Queues raw protection configuration reconciliation.
	 * @param rawConfiguration - Unknown unfiltered configuration value.
	 * @since 0.1.0 Initial implementation.
	 */
	reconcileConfiguration( rawConfiguration: unknown ): void;

	/**
	 * Clears local statistics and returns the resulting trustworthy projection.
	 * @return Zero-valued local totals after success or an unavailable projection.
	 * @since 0.1.0 Initial implementation.
	 */
	resetStatistics(): Promise<StatisticsProjection>;

}
