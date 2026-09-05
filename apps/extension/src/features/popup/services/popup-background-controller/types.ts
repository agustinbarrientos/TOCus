import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { type Browser } from 'wxt/browser';
import { type BrowserProtectionRuntimeSnapshot } from '../../../protection-runtime/services/browser-protection-runtime';
import { type PopupProjection } from '../../types/popup-projection';

/**
 * Browser event source used to register one popup message listener.
 * @since 0.1.0 Initial implementation.
 */
export interface PopupBackgroundEvent<TListener> {
	/**
	 * Registers one listener.
	 * @param listener - Listener receiving future events.
	 * @since 0.1.0 Initial implementation.
	 */
	addListener( listener: TListener ): void;
}

/**
 * Browser-provided identity for one local popup message sender.
 * @since 0.1.0 Initial implementation.
 */
export interface PopupBackgroundMessageSender {
	/** URL of the extension document that sent the message. */
	url?: string | undefined;
}

/**
 * Delivers one asynchronous popup projection to the local message channel.
 * @since 0.1.0 Initial implementation.
 */
export type PopupBackgroundSendResponse = ( response: PopupProjection ) => void;

/**
 * Listener receiving one unknown popup runtime message.
 * @since 0.1.0 Initial implementation.
 */
export type PopupBackgroundMessageListener = (
	input: unknown,
	sender: PopupBackgroundMessageSender,
	sendResponse: PopupBackgroundSendResponse,
) => true | undefined;

/**
 * Local runtime messaging used by the popup background controller.
 * @since 0.1.0 Initial implementation.
 */
export interface PopupBackgroundRuntimeApi {
	/** Browser runtime message event. */
	onMessage: PopupBackgroundEvent<PopupBackgroundMessageListener>;
}

/**
 * Named browser permissions inspected before creating a no-capability popup snapshot.
 * @since 0.1.0 Initial implementation.
 */
export interface PopupBackgroundPermissionQuery {
	/** Named permissions whose current grant state should be inspected. */
	permissions: Browser.runtime.ManifestPermission[];
}

/**
 * Browser permission inspection needed by popup fallback projection.
 * @since 0.1.0 Initial implementation.
 */
export interface PopupBackgroundPermissionsApi {
	/**
	 * Reports whether every requested named permission is currently granted.
	 * @param query - Named permission request.
	 * @return Whether every requested permission is granted.
	 * @since 0.1.0 Initial implementation.
	 */
	contains( query: PopupBackgroundPermissionQuery ): Promise<boolean>;
}

/**
 * Browser surface used by the popup background controller.
 * @since 0.1.0 Initial implementation.
 */
export interface PopupBackgroundBrowser {
	/** Optional browser-permission inspection. */
	permissions: PopupBackgroundPermissionsApi;
	/** Local extension runtime messaging. */
	runtime: PopupBackgroundRuntimeApi;
}

/**
 * Read-only local configuration persistence used before navigation access exists.
 * @since 0.1.0 Initial implementation.
 */
export interface PopupBackgroundConfigurationStorage {
	/**
	 * Loads the validated current local configuration.
	 * @return Persisted configuration, defaults, or null when malformed.
	 * @since 0.1.0 Initial implementation.
	 */
	load(): Promise<ProtectionConfigurationDocument | null>;
}

/**
 * Serialized protection runtime operations used by popup projection.
 * @since 0.1.0 Initial implementation.
 */
export interface PopupBackgroundProtectionRuntime {
	/**
	 * Reads detached background-only protection state.
	 * @return Current state or null while protection is unavailable.
	 * @since 0.1.0 Initial implementation.
	 */
	readSnapshot(): Promise<BrowserProtectionRuntimeSnapshot | null>;
}

/**
 * Dependencies used by one popup background controller.
 * @since 0.1.0 Initial implementation.
 */
export interface PopupBackgroundControllerOptions {
	/** Browser message event surface. */
	browser: PopupBackgroundBrowser;
	/** Validated local configuration reader used before optional navigation access exists. */
	configurationStorage: PopupBackgroundConfigurationStorage;
	/** Returns the browser's current local IANA time zone. */
	getTimeZone: () => string;
	/** Exact extension-owned interruption page URL used for destination recovery. */
	interruptionPageUrl: string;
	/** Returns the current wall-clock epoch time. */
	now: () => number;
	/** Exact extension-owned popup page URL allowed to request projections. */
	popupPageUrl: string;
	/** Capability-aware protection reconciliation owned by the primary background controller. */
	refreshProtection: () => Promise<void>;
	/** Serialized authoritative protection runtime. */
	runtime: PopupBackgroundProtectionRuntime;
	/** Waits for cold-start navigation-capability detection to settle. */
	waitForProtectionReady: () => Promise<void>;
}

/**
 * Synchronous popup background-listener registration.
 * @since 0.1.0 Initial implementation.
 */
export interface PopupBackgroundController {
	/**
	 * Registers the authenticated popup message listener.
	 * @since 0.1.0 Initial implementation.
	 */
	start(): void;
}
