import { ProtectedSiteEnrollmentStatus } from '../../../protected-sites/services/protected-site-enrollment';
import {
	PopupSiteEnrollmentRequestSchema,
	PopupSiteEnrollmentRequestType,
	PopupSiteEnrollmentResultSchema,
	type PopupSiteEnrollmentResult,
} from '../../types/site-enrollment';
import type {
	PopupEnrollmentClient,
	PopupEnrollmentClientOptions,
} from './types';

/**
 * Creates the popup transport for background-owned website enrollment.
 * @param options - Local runtime transport.
 * @return Gesture-preserving enrollment client.
 * @since 0.1.0 Initial implementation.
 */
export function createPopupEnrollmentClient( options: PopupEnrollmentClientOptions ): PopupEnrollmentClient {
	return {
		/**
		 * Starts enrollment before yielding the popup user gesture.
		 * @param input - Current website URL supplied by the popup.
		 * @param independent - Whether the website receives independent timing.
		 * @return Validated enrollment outcome or a save error.
		 * @since 0.1.0 Initial implementation.
		 */
		async add( input: unknown, independent: boolean ): Promise<PopupSiteEnrollmentResult> {
			try {
				const request = PopupSiteEnrollmentRequestSchema.parse( {
					type: PopupSiteEnrollmentRequestType,
					siteInput: input,
					independent,
				} );

				return PopupSiteEnrollmentResultSchema.parse( await options.runtime.sendMessage( request ) );
			} catch {
				return { status: ProtectedSiteEnrollmentStatus.SAVE_ERROR };
			}
		},
	};
}

export * from './types';
