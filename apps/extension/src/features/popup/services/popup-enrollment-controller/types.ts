import { type ProtectedSiteEnrollmentService } from '../../../protected-sites/services/protected-site-enrollment';
import { type PopupSiteEnrollmentResult } from '../../types/site-enrollment';
import { type PopupBackgroundEvent, type PopupBackgroundMessageSender } from '../popup-background-controller';

/**
 * Delivers a minimal enrollment result to a popup that may already be closed.
 * @since 0.1.0 Initial implementation.
 */
export type PopupEnrollmentSendResponse = ( result: PopupSiteEnrollmentResult ) => void;

/**
 * Browser message listener claiming authenticated popup additions.
 * @since 0.1.0 Initial implementation.
 */
export type PopupEnrollmentMessageListener = (
	input: unknown,
	sender: PopupBackgroundMessageSender,
	sendResponse: PopupEnrollmentSendResponse,
) => true | undefined;

/**
 * Runtime message event used by background-owned enrollment.
 * @since 0.1.0 Initial implementation.
 */
export interface PopupEnrollmentRuntimeApi {
	/** Receives local messages with browser-authenticated sender identities. */
	onMessage: PopupBackgroundEvent<PopupEnrollmentMessageListener>;
}

/**
 * Background-owned website enrollment and its authenticated message boundary.
 * @since 0.1.0 Initial implementation.
 */
export interface PopupEnrollmentControllerOptions {
	/** Existing consent-aware enrollment with coordinated persistence. */
	enrollment: Pick<ProtectedSiteEnrollmentService, 'add'>;
	/** Exact extension popup URL allowed to initiate additions. */
	popupPageUrl: string;
	/** Browser message event, registered before asynchronous startup. */
	runtime: PopupEnrollmentRuntimeApi;
}

/**
 * Registers background ownership of website additions independently of popup lifetime.
 * @since 0.1.0 Initial implementation.
 */
export interface PopupEnrollmentController {
	/**
	 * Registers the user-gesture message listener synchronously.
	 * @since 0.1.0 Initial implementation.
	 */
	start(): void;
}
