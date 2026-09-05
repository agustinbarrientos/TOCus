import {
	type PopupSiteEnrollmentRequest,
	type PopupSiteEnrollmentResult,
} from '../../types/site-enrollment';

/**
 * Runtime transport preserving the Chrome popup enrollment gesture.
 * @since 0.1.0 Initial implementation.
 */
export interface PopupEnrollmentClientRuntime {
	/**
	 * Sends one validated website addition to the background.
	 * @param request - Website addition started by the popup gesture.
	 * @return Unknown enrollment outcome awaiting validation.
	 * @since 0.1.0 Initial implementation.
	 */
	sendMessage( request: PopupSiteEnrollmentRequest ): Promise<unknown>;
}

/**
 * Dependencies used by the popup enrollment client.
 * @since 0.1.0 Initial implementation.
 */
export interface PopupEnrollmentClientOptions {
	/** Local extension message transport. */
	runtime: PopupEnrollmentClientRuntime;
}

/**
 * Background-owned website enrollment started by the popup.
 * @since 0.1.0 Initial implementation.
 */
export interface PopupEnrollmentClient {
	/**
	 * Immediately sends a website addition from the current user gesture.
	 * @param input - Current website URL supplied by the popup.
	 * @param independent - Whether the website receives independent timing.
	 * @return Validated enrollment outcome or a save error.
	 * @since 0.1.0 Initial implementation.
	 */
	add( input: unknown, independent: boolean ): Promise<PopupSiteEnrollmentResult>;
}
