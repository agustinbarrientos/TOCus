import type { InterruptionNavigationReplacementResponse } from '../../../protection-runtime/types/runtime-message';

/**
 * Browser-provided sender identity needed to authenticate a background command.
 * @since 0.1.0 Initial implementation.
 */
export interface InterruptionNavigationReplacementSender {
	/** Extension identifier owning the sending context. */
	id?: string | undefined;
	/** Present for messages originating in a tab context. */
	tab?: unknown;
}

/**
 * Browser response channel for a navigation replacement acknowledgement.
 * @since 0.1.0 Initial implementation.
 */
export interface InterruptionNavigationReplacementResponseSender {
	/**
	 * Sends the acknowledgement before navigation destroys the document context.
	 * @param response - Exact successful replacement acknowledgement.
	 */
	( response: InterruptionNavigationReplacementResponse ): void;
}

/**
 * Synchronous runtime message listener owned by the interruption document.
 * @since 0.1.0 Initial implementation.
 */
export interface InterruptionNavigationReplacementListener {
	/**
	 * Handles one unknown extension message.
	 * @param input - Untrusted message payload.
	 * @param sender - Browser-provided sender identity.
	 * @param sendResponse - Browser response channel.
	 * @return Undefined because the acknowledgement is sent synchronously.
	 */
	(
		input: unknown,
		sender: InterruptionNavigationReplacementSender,
		sendResponse: InterruptionNavigationReplacementResponseSender,
	): undefined;
}

/**
 * Runtime message subscription used by the interruption document.
 * @since 0.1.0 Initial implementation.
 */
export interface InterruptionNavigationReplacementMessageEvent {
	/** Registers the replacement listener before page bootstrap begins. */
	addListener: ( listener: InterruptionNavigationReplacementListener ) => void;
}

/**
 * Runtime boundary needed by the interruption-document replacement listener.
 * @since 0.1.0 Initial implementation.
 */
export interface InterruptionNavigationReplacementRuntime {
	/** Current extension identifier. */
	id: string;
	/** Resolves one packaged extension path. */
	getURL: ( path: '/pause.html' ) => string;
	/** Runtime message subscription. */
	onMessage: InterruptionNavigationReplacementMessageEvent;
}

/**
 * Narrow location boundary used to preserve native browser history during release.
 * @since 0.1.0 Initial implementation.
 */
export interface InterruptionNavigationReplacementLocation {
	/** Exact current document URL. */
	readonly href: string;
	/** Replaces the current history entry. */
	replace: ( url: string ) => void;
}

/**
 * Dependencies for installing the interruption-document replacement listener.
 * @since 0.1.0 Initial implementation.
 */
export interface InterruptionNavigationReplacementOptions {
	/** Current interruption document location. */
	location: InterruptionNavigationReplacementLocation;
	/** Extension identity and runtime message subscription. */
	runtime: InterruptionNavigationReplacementRuntime;
}
