import { type ProtectionConfigurationStorageService } from '../../../../domains/protection/services/protection-configuration-storage';
import { type ProtectionCoordinator } from '../../../../domains/protection/services/protection-coordinator';
import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { type InterruptionPageResponse } from '../../types/runtime-message';
import {
	type ProtectionRuntimeBrowser,
	type ProtectionRuntimeNavigation,
} from '../../types/browser-runtime';
import { type ToolbarBadgeCopy } from '../../utils/toolbar-badge-projection';
import { type StatisticsRuntime } from '../../../statistics/services/statistics-runtime';
import {
	type BrowserProtectionFocusEventIdentity,
	type BrowserProtectionStatisticsObservation,
} from '../../../statistics/services/browser-statistics-bridge';
import { type StatisticsFocusObservationMode } from '../../../../domains/statistics/utils/prepare-statistics-checkpoint';
import { type StatisticsProjection } from '../../../../domains/statistics/types/statistics-projection';

/**
 * Dependencies used by one browser protection runtime.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserProtectionRuntimeOptions {
	browser: ProtectionRuntimeBrowser;
	configurationStorage: ProtectionConfigurationStorageService;
	coordinator: ProtectionCoordinator;
	interruptionPageUrl: string;
	/** Statistics observer serialized by this browser runtime. */
	statisticsRuntime: StatisticsRuntime;
	/** Localized toolbar copy required for global toolbar projection. */
	toolbarBadgeCopy: ToolbarBadgeCopy;

	/**
	 * Filters persisted sites to those with complete current browser access.
	 * @param configuration - Validated persisted protection configuration.
	 * @return Valid configuration safe for runtime matching and projection.
	 * @since 0.1.0 Initial implementation.
	 */
	filterConfiguration: (
		configuration: ProtectionConfigurationDocument,
	) => Promise<ProtectionConfigurationDocument>;

	/**
	 * Creates one fresh ASCII identifier fragment.
	 * @return Collision-resistant identifier fragment.
	 * @since 0.1.0 Initial implementation.
	 */
	createStableId: () => string;

	/**
	 * Returns the current wall-clock epoch time.
	 * @return Current epoch milliseconds.
	 * @since 0.1.0 Initial implementation.
	 */
	now: () => number;

	/**
	 * Returns the current local IANA time zone.
	 * @return Current IANA time-zone identifier.
	 * @since 0.1.0 Initial implementation.
	 */
	getTimeZone: () => string;
}

/**
 * Browser-facing operations that connect navigation and interruption pages to protection state.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserProtectionRuntime {
	/**
	 * Captures browser focus and time before a controller queue can delay one event.
	 * @param mode - Relationship between this observation and browser focus state.
	 * @param navigation - Optional top-level navigation received with the event.
	 * @param focusEvent - Exact browser focus event identity, null when malformed, or undefined for another boundary.
	 * @return Privacy-safe event-ingress browser observation.
	 * @since 0.1.0 Initial implementation.
	 */
	captureStatisticsObservation(
		mode: StatisticsFocusObservationMode,
		navigation?: ProtectionRuntimeNavigation,
		focusEvent?: BrowserProtectionFocusEventIdentity | null,
	): Promise<BrowserProtectionStatisticsObservation>;

	/**
	 * Removes runtime-owned browser effects when startup cannot establish authoritative protection state.
	 * @param statisticsObservation - Browser inputs captured at controller event ingress.
	 * @return Promise resolved after fail-open cleanup completes.
	 * @since 0.1.0 Initial implementation.
	 */
	failOpen(
		statisticsObservation?: Promise<BrowserProtectionStatisticsObservation>,
	): Promise<void>;

	/**
	 * Returns the latest trustworthy all-time statistics projection.
	 * @return Available local totals or an unavailable projection.
	 * @since 0.1.0 Initial implementation.
	 */
	readStatistics(): Promise<StatisticsProjection>;

	/**
	 * Clears local statistics and returns the resulting trustworthy projection.
	 * @return Zero-valued local totals after success or an unavailable projection.
	 * @since 0.1.0 Initial implementation.
	 */
	resetStatistics(): Promise<StatisticsProjection>;

	/**
	 * Reprojects the current toolbar state after presentation-only copy changes.
	 * @return Promise resolved after the serialized toolbar update settles.
	 * @since 0.1.0 Initial implementation.
	 */
	refreshToolbarBadge(): Promise<void>;

	/**
	 * Restores navigation rules and toolbar state from local configuration and runtime state.
	 * @param statisticsObservation - Browser inputs captured at controller event ingress.
	 * @return Promise resolved after startup reconciliation.
	 * @since 0.1.0 Initial implementation.
	 */
	start(
		statisticsObservation?: Promise<BrowserProtectionStatisticsObservation>,
	): Promise<void>;

	/**
	 * Handles one observed top-level browser navigation.
	 * @param navigation - Browser navigation details.
	 * @param statisticsObservation - Browser inputs captured at controller event ingress.
	 * @return Promise resolved after any protected visit is persisted and projected.
	 * @since 0.1.0 Initial implementation.
	 */
	handleNavigation(
		navigation: ProtectionRuntimeNavigation,
		statisticsObservation?: Promise<BrowserProtectionStatisticsObservation>,
	): Promise<void>;

	/**
	 * Handles one unknown request from an extension-owned interruption page.
	 * @param input - Unknown runtime message payload.
	 * @param senderTabId - Browser-provided sender tab identifier.
	 * @param protectionEligible - Whether the sender is explicitly outside private browsing.
	 * @param statisticsObservation - Browser inputs captured at controller event ingress.
	 * @return Authoritative interruption-page presentation.
	 * @since 0.1.0 Initial implementation.
	 */
	handlePageRequest(
		input: unknown,
		senderTabId: number | null,
		protectionEligible?: boolean,
		statisticsObservation?: Promise<BrowserProtectionStatisticsObservation>,
	): Promise<InterruptionPageResponse>;

	/**
	 * Removes a waiting or Ready participant whose tab closed.
	 * @param tabId - Closed browser tab identifier.
	 * @param statisticsObservation - Browser inputs captured at controller event ingress.
	 * @return Promise resolved after state and badges are reconciled.
	 * @since 0.1.0 Initial implementation.
	 */
	handleTabRemoved(
		tabId: number,
		statisticsObservation?: Promise<BrowserProtectionStatisticsObservation>,
	): Promise<void>;

	/**
	 * Reconciles participant ownership after browser focus changes.
	 * @param statisticsObservation - Browser inputs captured at controller event ingress.
	 * @return Promise resolved after focus and badge state are updated.
	 * @since 0.1.0 Initial implementation.
	 */
	handleFocusChanged(
		statisticsObservation?: Promise<BrowserProtectionStatisticsObservation>,
	): Promise<void>;

	/**
	 * Processes elapsed allowances and refreshes wall-clock toolbar countdowns.
	 * @param statisticsObservation - Browser inputs captured at controller event ingress.
	 * @return Promise resolved after clock reconciliation.
	 * @since 0.1.0 Initial implementation.
	 */
	handleClockTick(
		statisticsObservation?: Promise<BrowserProtectionStatisticsObservation>,
	): Promise<void>;

	/**
	 * Reconciles navigation rules after protected-site configuration or permissions change.
	 * @param statisticsObservation - Browser inputs captured at controller event ingress.
	 * @return Promise resolved after browser capabilities reflect current local state.
	 * @since 0.1.0 Initial implementation.
	 */
	handleConfigurationChanged(
		statisticsObservation?: Promise<BrowserProtectionStatisticsObservation>,
	): Promise<void>;
}

export type {
	BrowserProtectionStatisticsFocusObservation,
	BrowserProtectionStatisticsObservation,
} from '../../../statistics/services/browser-statistics-bridge';
