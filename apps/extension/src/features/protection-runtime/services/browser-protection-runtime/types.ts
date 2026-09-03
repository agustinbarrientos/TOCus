import { type ProtectionConfigurationStorageService } from '../../../../domains/protection/services/protection-configuration-storage';
import { type ProtectionCoordinator } from '../../../../domains/protection/services/protection-coordinator';
import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { type InterruptionPageResponse } from '../../types/runtime-message';
import { type ProtectionRuntimeBrowser, type ProtectionRuntimeNavigation } from '../../types/browser-runtime';
import { type ToolbarBadgeCopy } from '../../utils/toolbar-badge-projection';

/**
 * Dependencies used by one browser protection runtime.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserProtectionRuntimeOptions {
	browser: ProtectionRuntimeBrowser;
	configurationStorage: ProtectionConfigurationStorageService;
	coordinator: ProtectionCoordinator;
	interruptionPageUrl: string;
	/** Localized toolbar copy, or undefined to use the default English copy. */
	toolbarBadgeCopy?: ToolbarBadgeCopy;

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
	 * Removes runtime-owned browser effects when startup cannot establish authoritative protection state.
	 * @return Promise resolved after fail-open cleanup completes.
	 * @since 0.1.0 Initial implementation.
	 */
	failOpen(): Promise<void>;

	/**
	 * Restores navigation rules and toolbar state from local configuration and runtime state.
	 * @return Promise resolved after startup reconciliation.
	 * @since 0.1.0 Initial implementation.
	 */
	start(): Promise<void>;

	/**
	 * Handles one observed top-level browser navigation.
	 * @param navigation - Browser navigation details.
	 * @return Promise resolved after any protected visit is persisted and projected.
	 * @since 0.1.0 Initial implementation.
	 */
	handleNavigation( navigation: ProtectionRuntimeNavigation ): Promise<void>;

	/**
	 * Handles one unknown request from an extension-owned interruption page.
	 * @param input - Unknown runtime message payload.
	 * @param senderTabId - Browser-provided sender tab identifier.
	 * @return Authoritative interruption-page presentation.
	 * @since 0.1.0 Initial implementation.
	 */
	handlePageRequest( input: unknown, senderTabId: number | null ): Promise<InterruptionPageResponse>;

	/**
	 * Removes a waiting or Ready participant whose tab closed.
	 * @param tabId - Closed browser tab identifier.
	 * @return Promise resolved after state and badges are reconciled.
	 * @since 0.1.0 Initial implementation.
	 */
	handleTabRemoved( tabId: number ): Promise<void>;

	/**
	 * Reconciles participant ownership after browser focus changes.
	 * @return Promise resolved after focus and badge state are updated.
	 * @since 0.1.0 Initial implementation.
	 */
	handleFocusChanged(): Promise<void>;

	/**
	 * Processes elapsed allowances and refreshes wall-clock toolbar countdowns.
	 * @return Promise resolved after clock reconciliation.
	 * @since 0.1.0 Initial implementation.
	 */
	handleClockTick(): Promise<void>;

	/**
	 * Reconciles navigation rules after protected-site configuration or permissions change.
	 * @return Promise resolved after browser capabilities reflect current local state.
	 * @since 0.1.0 Initial implementation.
	 */
	handleConfigurationChanged(): Promise<void>;
}
