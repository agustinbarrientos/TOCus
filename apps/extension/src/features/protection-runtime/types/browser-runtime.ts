import { type Browser } from 'wxt/browser';
import {
	type ProtectedPageMessage,
	type ProtectedPagePresentationStatus,
} from './protected-page-message';
import { type ToolbarBadgeProjection } from '../utils/toolbar-badge-projection';

/**
 * One top-level browser navigation observed before commit.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionRuntimeNavigation {
	/** Browser tab receiving the navigation. */
	tabId: number;
	/** Browser frame receiving the navigation. */
	frameId: number;
	/** Absolute navigation URL. */
	url: string;
}

/**
 * Browser tab details needed for protection matching and badge projection.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionRuntimeTab {
	/** Browser-assigned live tab identifier. */
	id: number;
	/** Accessible committed URL when granted host access permits it. */
	url?: string;
	/** Accessible pending URL when granted host access permits it. */
	pendingUrl?: string;
}

/**
 * Distinct future wall-clock deadlines that keep allowance effects accurate.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionClockDeadlines = ReadonlyArray<number>;

/**
 * Browser effects shared by protection-runtime services.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionRuntimeBrowser {
	/**
	 * Dismisses an interruption page that has no retained destination.
	 * @param tabId - Browser tab displaying the interruption.
	 * @return Promise resolved after browser-native dismissal is accepted or unavailable.
	 * @since 0.1.0 Initial implementation.
	 */
	dismissInterruption: ( tabId: number ) => Promise<void>;

	/**
	 * Reads the local presentation state from an already injected protected page.
	 * @param tabId - Browser tab containing the protected page.
	 * @return Validated presentation status, or null when no listener is present.
	 * @since 0.1.0 Initial implementation.
	 */
	getProtectedPagePresentation: ( tabId: number ) => Promise<ProtectedPagePresentationStatus | null>;

	/**
	 * Synchronizes one-shot alarms for every active allowance deadline.
	 * @param deadlines - Distinct future expiry, warning, and badge deadlines.
	 * @return Promise resolved after the owned alarms match the requested deadlines.
	 * @since 0.1.0 Initial implementation.
	 */
	synchronizeProtectionClock: ( deadlines: ProtectionClockDeadlines ) => Promise<void>;

	/**
	 * Replaces the complete extension-owned dynamic navigation-rule set.
	 * @param rules - Deterministic rules that should remain active.
	 * @return Promise resolved after atomic replacement.
	 * @since 0.1.0 Initial implementation.
	 */
	replaceNavigationRules: ( rules: Browser.declarativeNetRequest.Rule[] ) => Promise<void>;

	/**
	 * Returns the active tab in the focused browser window.
	 * @return Focused tab identifier or null when no browser window is focused.
	 * @since 0.1.0 Initial implementation.
	 */
	getFocusedTabId: () => Promise<number | null>;

	/**
	 * Lists open tabs whose accessible URLs may be matched locally.
	 * @return Current open tabs.
	 * @since 0.1.0 Initial implementation.
	 */
	listTabs: () => Promise<ReadonlyArray<ProtectionRuntimeTab>>;

	/**
	 * Navigates one tab after its scope redirect has been removed.
	 * @param tabId - Destination tab identifier.
	 * @param url - Validated retained HTTP(S) destination.
	 * @return Promise resolved after the browser accepts the update.
	 * @since 0.1.0 Initial implementation.
	 */
	navigateTab: ( tabId: number, url: string ) => Promise<void>;

	/**
	 * Applies one warning or interruption-layer command to a protected page.
	 * @param tabId - Browser tab containing the protected page.
	 * @param message - Validated protected-page command.
	 * @return Promise resolved after the page accepts the command or an absent removal is ignored.
	 * @since 0.1.0 Initial implementation.
	 */
	updateProtectedPagePresentation: ( tabId: number, message: ProtectedPageMessage ) => Promise<void>;

	/**
	 * Applies one browser-neutral projection to the global toolbar badge.
	 * @param projection - Compact text, accessible title, and semantic phase.
	 * @return Promise resolved after the toolbar update.
	 * @since 0.1.0 Initial implementation.
	 */
	updateToolbarBadge: ( projection: ToolbarBadgeProjection ) => Promise<void>;
}
