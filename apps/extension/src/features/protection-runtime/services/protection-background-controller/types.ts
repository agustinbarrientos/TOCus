import { type Browser } from 'wxt/browser';
import { type InterruptionPageResponse } from '../../types/runtime-message';
import { type BrowserProtectionRuntime } from '../browser-protection-runtime';
import { type StatisticsProjection } from '../../../../domains/statistics/types/statistics-projection';

/**
 * Stable background alarms owned by protection runtime coordination.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionBackgroundAlarmName = {
	RECONCILIATION: 'tocus.protection.reconciliation',
} as const;

/**
 * Browser event surface needed to register one listener.
 * @since 0.1.0 Initial implementation.
 */
interface ProtectionBackgroundEvent<TListener> {
	/**
	 * Registers one browser event listener.
	 * @param listener - Listener receiving future browser events.
	 * @since 0.1.0 Initial implementation.
	 */
	addListener( listener: TListener ): void;
}

/**
 * Browser alarm details observed by the protection background.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionBackgroundAlarm {
	/** Browser-assigned alarm name. */
	name: string;
}

/**
 * Periodic browser alarm schedule used for wall-clock reconciliation.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionBackgroundAlarmSchedule {
	/** Period between reconciliation alarms. */
	periodInMinutes: number;
}

/**
 * Listener receiving one browser alarm.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionBackgroundAlarmListener = ( alarm: ProtectionBackgroundAlarm ) => void;

/**
 * Browser alarm operations needed by protection coordination.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionBackgroundAlarmsApi {
	/**
	 * Creates or replaces one named periodic alarm.
	 * @param name - Stable extension alarm name.
	 * @param schedule - Periodic alarm schedule.
	 * @return Browser completion promise when supported.
	 * @since 0.1.0 Initial implementation.
	 */
	create( name: string, schedule: ProtectionBackgroundAlarmSchedule ): Promise<void> | void;
	/** Extension alarm event. */
	onAlarm: ProtectionBackgroundEvent<ProtectionBackgroundAlarmListener>;
}

/**
 * Optional permission values added or removed by the user or browser.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionBackgroundPermissionChange {
	/** Changed named permissions. */
	permissions?: ReadonlyArray<string> | undefined;
	/** Changed origin permissions. */
	origins?: ReadonlyArray<string> | undefined;
}

/**
 * Listener receiving removed optional permissions.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionBackgroundPermissionRemovalListener = (
	removal: ProtectionBackgroundPermissionChange,
) => void;

/**
 * Listener receiving newly granted optional permissions.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionBackgroundPermissionAdditionListener = (
	addition: ProtectionBackgroundPermissionChange,
) => void;

/**
 * Named optional permissions inspected during background startup.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionBackgroundPermissionQuery {
	/** Named permissions whose current grant state should be inspected. */
	permissions: Browser.runtime.ManifestPermission[];
}

/**
 * Browser optional-permission events needed by protection coordination.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionBackgroundPermissionsApi {
	/**
	 * Reports whether every requested optional permission is currently granted.
	 * @param query - Named permissions to inspect.
	 * @return Whether every requested permission is granted.
	 * @since 0.1.0 Initial implementation.
	 */
	contains( query: ProtectionBackgroundPermissionQuery ): Promise<boolean>;

	/** Newly granted optional-permission event. */
	onAdded: ProtectionBackgroundEvent<ProtectionBackgroundPermissionAdditionListener>;
	/** Browser permission removal event. */
	onRemoved: ProtectionBackgroundEvent<ProtectionBackgroundPermissionRemovalListener>;
}

/**
 * Browser tab identity supplied with a runtime message.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionBackgroundMessageSenderTab {
	/** Browser-assigned tab identifier when the sender is a live tab. */
	id?: number | undefined;
	/** Whether the sender belongs to a private browser context when reported. */
	incognito?: boolean | undefined;
}

/**
 * Browser-provided sender details for one runtime message.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionBackgroundMessageSender {
	/** Sending frame identifier, where zero identifies the tab's top-level frame. */
	frameId?: number | undefined;
	/** Sending browser tab when the request came from a tab page. */
	tab?: ProtectionBackgroundMessageSenderTab | undefined;
	/** URL of the page or frame hosting the sending script. */
	url?: string | undefined;
}

/**
 * Response returned by one claimed protection or statistics runtime request.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionBackgroundMessageResponse = boolean | InterruptionPageResponse | StatisticsProjection;

/**
 * Sends one asynchronous response through a browser runtime message channel.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionBackgroundSendResponse = (
	response?: ProtectionBackgroundMessageResponse,
) => void;

/**
 * Listener receiving one unknown runtime message.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionBackgroundMessageListener = (
	input: unknown,
	sender: ProtectionBackgroundMessageSender,
	sendResponse: ProtectionBackgroundSendResponse,
) => true | undefined;

/**
 * Browser runtime messaging needed by protection coordination.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionBackgroundRuntimeApi {
	/** Browser runtime message event. */
	onMessage: ProtectionBackgroundEvent<ProtectionBackgroundMessageListener>;
}

/**
 * Changed browser storage values indexed by storage key.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionBackgroundStorageChanges = Readonly<Record<string, unknown>>;

/**
 * Listener receiving one browser storage change collection.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionBackgroundStorageChangeListener = (
	changes: ProtectionBackgroundStorageChanges,
	areaName: string,
) => void;

/**
 * Browser storage events needed by protection coordination.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionBackgroundStorageApi {
	/** Browser storage change event. */
	onChanged: ProtectionBackgroundEvent<ProtectionBackgroundStorageChangeListener>;
}

/**
 * Listener receiving one active-tab change.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionBackgroundTabActivationListener = ( activation: unknown ) => void;

/**
 * Listener receiving one browser tab removal.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionBackgroundTabRemovalListener = ( tabId: number, removeInfo: unknown ) => void;

/**
 * Browser tab lifecycle events needed by protection coordination.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionBackgroundTabsApi {
	/** Active-tab change event. */
	onActivated: ProtectionBackgroundEvent<ProtectionBackgroundTabActivationListener>;
	/** Tab removal event. */
	onRemoved: ProtectionBackgroundEvent<ProtectionBackgroundTabRemovalListener>;
}

/**
 * Browser navigation details available across supported event phases.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionBackgroundNavigationDetails {
	/** Browser frame receiving the navigation. */
	frameId: number;
	/** Browser tab receiving the navigation. */
	tabId: number;
	/** Browser-reported transition qualifiers when available after commit. */
	transitionQualifiers?: ReadonlyArray<string> | undefined;
	/** Browser-reported transition type when available after commit. */
	transitionType?: string | undefined;
	/** Absolute navigation URL. */
	url: string;
}

/**
 * Listener receiving one browser navigation event.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionBackgroundNavigationListener = (
	navigation: ProtectionBackgroundNavigationDetails,
) => void;

/**
 * Optional navigation event that supports listener removal after permission revocation.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionBackgroundNavigationEvent extends ProtectionBackgroundEvent<
	ProtectionBackgroundNavigationListener
> {
	/**
	 * Removes one previously registered navigation listener.
	 * @param listener - Previously registered navigation listener.
	 * @since 0.1.0 Initial implementation.
	 */
	removeListener( listener: ProtectionBackgroundNavigationListener ): void;
}

/**
 * Browser navigation events needed by protection coordination.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionBackgroundWebNavigationApi {
	/** Navigation event observed before commit. */
	onBeforeNavigate: ProtectionBackgroundNavigationEvent;
	/** Navigation event observed after the destination document commits. */
	onCommitted: ProtectionBackgroundNavigationEvent;
	/** Navigation error event when exposed by the current browser. */
	onErrorOccurred?: ProtectionBackgroundNavigationEvent | undefined;
	/** Same-document History API navigation event when supported. */
	onHistoryStateUpdated?: ProtectionBackgroundNavigationEvent | undefined;
	/** Same-document fragment navigation event when supported. */
	onReferenceFragmentUpdated?: ProtectionBackgroundNavigationEvent | undefined;
}

/**
 * Listener receiving one browser-window focus change.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionBackgroundWindowFocusListener = ( windowId: number ) => void;

/**
 * Browser-window focus events needed by protection coordination.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionBackgroundWindowsApi {
	/** Window focus change event. */
	onFocusChanged: ProtectionBackgroundEvent<ProtectionBackgroundWindowFocusListener>;
}

/**
 * Browser APIs needed by protection background coordination.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionBackgroundBrowser {
	/** Browser alarm creation and delivery. */
	alarms: ProtectionBackgroundAlarmsApi;
	/** Optional-permission grant inspection and change events. */
	permissions: ProtectionBackgroundPermissionsApi;
	/** Extension runtime messages. */
	runtime: ProtectionBackgroundRuntimeApi;
	/** Local storage changes. */
	storage: ProtectionBackgroundStorageApi;
	/** Browser tab lifecycle and focus events. */
	tabs: ProtectionBackgroundTabsApi;
	/** Top-level browser navigation events when optional access is available. */
	webNavigation?: ProtectionBackgroundWebNavigationApi | undefined;
	/** Browser-window focus events. */
	windows: ProtectionBackgroundWindowsApi;
}

/**
 * Dependencies used by protection background coordination.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionBackgroundControllerOptions {
	/** Browser event and alarm surfaces. */
	browser: ProtectionBackgroundBrowser;
	/** Exact extension-owned interruption page URL. */
	interruptionPageUrl: string;
	/**
	 * Exact extension-owned settings page URL.
	 * @since 0.1.0 Initial implementation.
	 */
	optionsPageUrl: string;
	/** Authoritative browser protection runtime. */
	runtime: BrowserProtectionRuntime;
}

/**
 * Synchronous browser-event registration for protection runtime coordination.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionBackgroundController {
	/**
	 * Reconciles configuration through the serialized navigation-capability gate.
	 * @return Promise resolved after protection is current, or rejected after fail-open cleanup.
	 * @since 0.1.0 Initial implementation.
	 */
	refresh(): Promise<void>;

	/**
	 * Waits for pending navigation-capability startup or transitions to settle.
	 * @return Promise resolved after the capability barrier settles.
	 * @since 0.1.0 Initial implementation.
	 */
	waitUntilReady(): Promise<void>;

	/**
	 * Registers browser events before starting asynchronous restoration.
	 * @since 0.1.0 Initial implementation.
	 */
	start(): void;
}
