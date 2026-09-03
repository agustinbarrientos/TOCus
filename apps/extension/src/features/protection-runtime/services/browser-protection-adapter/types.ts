import { type Browser, type WxtBrowser } from 'wxt/browser';

/**
 * Exact one-shot alarm deadline accepted by the browser.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserProtectionAlarmCreationDetails {
	/** Absolute epoch-millisecond deadline for the one-shot alarm. */
	when: number;
}

/**
 * Existing browser alarm details needed to preserve an accurate deadline.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserProtectionAlarm {
	/** Stable browser alarm name. */
	name: string;
	/** Absolute epoch-millisecond deadline currently registered by the browser. */
	scheduledTime: number;
}

/**
 * Alarm operations required for exact protection-clock reconciliation.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserProtectionAlarmsApi {
	/**
	 * Clears one named alarm when present.
	 * @param name - Stable extension-owned alarm name.
	 * @return Whether an existing alarm was cleared.
	 */
	clear: ( name: string ) => Promise<boolean>;

	/**
	 * Creates one named one-shot alarm.
	 * @param name - Stable extension-owned alarm name.
	 * @param details - Exact absolute deadline without a periodic interval.
	 * @return Browser completion promise when supported.
	 */
	create: ( name: string, details: BrowserProtectionAlarmCreationDetails ) => Promise<void> | void;

	/**
	 * Lists every alarm currently registered by the extension.
	 * @return Current extension alarms.
	 */
	getAll: () => Promise<ReadonlyArray<BrowserProtectionAlarm>>;
}

/**
 * Complete dynamic-rule replacement accepted by the browser.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserProtectionDynamicRuleUpdate {
	/** Rules that replace the extension's current dynamic redirects. */
	addRules: Browser.declarativeNetRequest.Rule[];
	/** Identifiers of every current dynamic rule that must be removed. */
	removeRuleIds: number[];
}

/**
 * Dynamic declarative-navigation operations required by the adapter.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserProtectionDynamicRulesApi {
	/**
	 * Lists every dynamic rule currently owned by the extension.
	 * @return Current extension-owned dynamic rules.
	 */
	getDynamicRules: () => Promise<Browser.declarativeNetRequest.Rule[]>;

	/**
	 * Atomically removes current rules and installs their replacements.
	 * @param update - Complete dynamic-rule replacement.
	 * @return Promise resolved after the browser applies the replacement.
	 */
	updateDynamicRules: ( update: BrowserProtectionDynamicRuleUpdate ) => Promise<void>;
}

/**
 * Browser tab data visible through granted host access.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserProtectionAdapterTab {
	/** Browser-assigned tab identifier when the tab is live. */
	id?: number | undefined;
	/** Accessible current URL when the extension has host access. */
	url?: string | undefined;
	/** Accessible pending navigation URL when the extension has host access. */
	pendingUrl?: string | undefined;
}

/**
 * Tab filters used by protection runtime queries.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserProtectionTabQuery {
	/** Whether only the active tab in a window should be returned. */
	active?: boolean | undefined;
	/** Browser window whose tabs should be returned. */
	windowId?: number | undefined;
}

/**
 * Browser tab navigation update owned by the adapter.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserProtectionTabUpdate {
	/** Retained HTTP or HTTPS destination. */
	url: string;
}

/**
 * Tab operations required by the protection runtime.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserProtectionTabsApi {
	/**
	 * Returns one tab to its previous history entry when the current browser supports the operation.
	 * @param tabId - Browser-assigned tab identifier.
	 * @return Browser completion promise when supported.
	 */
	goBack?: ( tabId: number ) => Promise<unknown>;

	/**
	 * Lists tabs matching one local browser query.
	 * @param query - Active-tab and window filters.
	 * @return Matching open tabs.
	 */
	query: ( query: BrowserProtectionTabQuery ) => Promise<ReadonlyArray<BrowserProtectionAdapterTab>>;

	/**
	 * Exchanges one message with an injected protected-page listener.
	 * @param tabId - Browser-assigned target tab identifier.
	 * @param message - Structured-clone message payload.
	 * @return Unknown listener response awaiting boundary validation.
	 * @since 0.1.0 Initial implementation.
	 */
	sendMessage: ( tabId: number, message: unknown ) => Promise<unknown>;

	/**
	 * Navigates one existing browser tab.
	 * @param tabId - Browser-assigned tab identifier.
	 * @param update - Retained navigation destination.
	 * @return Promise resolved after the browser accepts the update.
	 */
	update: ( tabId: number, update: BrowserProtectionTabUpdate ) => Promise<unknown>;
}

/**
 * Last-focused browser window details needed to detect application focus.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserProtectionAdapterWindow {
	/** Whether the browser window currently owns operating-system focus. */
	focused: boolean;
	/** Browser-assigned window identifier when the window remains live. */
	id?: number | undefined;
}

/**
 * Browser-window operations required by the protection runtime.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserProtectionWindowsApi {
	/**
	 * Returns the browser window that most recently held focus.
	 * @return Last-focused browser window details.
	 */
	getLastFocused: () => Promise<BrowserProtectionAdapterWindow>;
}

/**
 * Global badge text update.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserProtectionBadgeTextDetails {
	/** Compact badge text, or an empty string to clear it. */
	text: string;
}

/**
 * Global badge background update.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserProtectionBadgeColorDetails {
	/** Accessible solid badge background color. */
	color: string;
}

/**
 * Global toolbar title update.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserProtectionToolbarTitleDetails {
	/** Accessible toolbar title describing the current protection phase. */
	title: string;
}

/**
 * Toolbar operations shared by Manifest V3 action and Manifest V2 browserAction.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserProtectionToolbarAction {
	/**
	 * Applies one global badge background.
	 * @param details - Accessible solid color.
	 * @return Browser completion promise when supported.
	 */
	setBadgeBackgroundColor: ( details: BrowserProtectionBadgeColorDetails ) => Promise<void> | void;

	/**
	 * Applies or clears one global badge label.
	 * @param details - Compact label.
	 * @return Browser completion promise when supported.
	 */
	setBadgeText: ( details: BrowserProtectionBadgeTextDetails ) => Promise<void> | void;

	/**
	 * Applies one accessible global toolbar title.
	 * @param details - Complete title.
	 * @return Browser completion promise when supported.
	 */
	setTitle: ( details: BrowserProtectionToolbarTitleDetails ) => Promise<void> | void;
}

/**
 * Narrow browser surface required by the protection adapter.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserProtectionAdapterApi {
	/** Exact one-shot protection-clock alarms. */
	alarms: BrowserProtectionAlarmsApi;
	/** Dynamic declarative-navigation operations. */
	declarativeNetRequest: BrowserProtectionDynamicRulesApi;
	/** On-demand isolated-world script and local font injection. */
	scripting: Pick<WxtBrowser[ 'scripting' ], 'executeScript' | 'insertCSS'>;
	/** Open-tab queries and retained navigation. */
	tabs: BrowserProtectionTabsApi;
	/** Browser-window focus lookup. */
	windows: BrowserProtectionWindowsApi;
	/** Manifest V3 toolbar API when available. */
	action?: BrowserProtectionToolbarAction | undefined;
	/** Manifest V2 toolbar API when available. */
	browserAction?: BrowserProtectionToolbarAction | undefined;
}
