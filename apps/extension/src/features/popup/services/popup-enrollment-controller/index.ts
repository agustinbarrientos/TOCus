import { ProtectedSiteEnrollmentStatus } from '../../../protected-sites/services/protected-site-enrollment';
import { PopupSiteEnrollmentRequestSchema, type PopupSiteEnrollmentResult } from '../../types/site-enrollment';
import type {
	PopupEnrollmentController,
	PopupEnrollmentControllerOptions,
	PopupEnrollmentMessageListener,
	PopupEnrollmentSendResponse,
} from './types';

/**
 * Delivers an outcome without allowing a closed popup to interrupt the completed operation.
 * @param sendResponse - Browser-owned response channel.
 * @param result - Minimal enrollment outcome.
 * @since 0.1.0 Initial implementation.
 */
function respond( sendResponse: PopupEnrollmentSendResponse, result: PopupSiteEnrollmentResult ): void {
	try {
		sendResponse( result );
	} catch {
		// The popup may close when its native permission dialog opens.
	}
}

/**
 * Creates background-owned enrollment for browsers that transfer click activation through messaging.
 * @param options - Authenticated message boundary and existing enrollment service.
 * @return Synchronous background listener registration.
 * @since 0.1.0 Initial implementation.
 */
export function createPopupEnrollmentController(
	options: PopupEnrollmentControllerOptions,
): PopupEnrollmentController {
	/**
	 * Starts enrollment within the transferred click gesture, before any asynchronous work.
	 * @param input - Unknown request awaiting validation.
	 * @param sender - Browser-provided source identity.
	 * @param sendResponse - Response channel independent of persistence ownership.
	 * @return True when this controller owns the asynchronous operation.
	 * @since 0.1.0 Initial implementation.
	 */
	const handleMessage: PopupEnrollmentMessageListener = ( input, sender, sendResponse ) => {
		const request = PopupSiteEnrollmentRequestSchema.safeParse( input );
		if ( sender.url !== options.popupPageUrl || ! request.success ) {
			return undefined;
		}

		void options.enrollment.add( request.data.siteInput, request.data.independent )
			.then( ( result ) => {
				respond( sendResponse, result.status === ProtectedSiteEnrollmentStatus.REJECTED
					? result
					: { status: result.status } );
			} )
			.catch( () => {
				respond( sendResponse, { status: ProtectedSiteEnrollmentStatus.SAVE_ERROR } );
			} );
		return true;
	};

	return {
		/**
		 * Registers the gesture-sensitive listener before asynchronous application startup.
		 * @since 0.1.0 Initial implementation.
		 */
		start(): void {
			options.runtime.onMessage.addListener( handleMessage );
		},
	};
}

export * from './types';
