import {
	PopupProjectionSchema,
	PopupProjectionStatus,
	type PopupProjection,
} from '../../types/popup-projection';
import { type PopupCurrentTabContext } from '../../types/current-tab-context';
import {
	PopupRuntimeRequestType,
	type PopupRuntimeRequest,
} from '../../types/runtime-message';
import {
	type PopupStatusClient,
	type PopupStatusClientOptions,
} from './types';

/**
 * Creates an unavailable projection without fabricating website or timing data.
 * @return Unavailable popup projection.
 * @since 0.1.0 Initial implementation.
 */
function createUnavailableProjection(): PopupProjection {
	return { status: PopupProjectionStatus.UNAVAILABLE };
}

/**
 * Sends and validates one local popup runtime request.
 * @param options - Local runtime transport.
 * @param request - Validated popup runtime request.
 * @return Validated projection or an unavailable marker.
 * @since 0.1.0 Initial implementation.
 */
async function sendRequest(
	options: PopupStatusClientOptions,
	request: PopupRuntimeRequest,
): Promise<PopupProjection> {
	try {
		return PopupProjectionSchema.parse( await options.runtime.sendMessage( request ) );
	} catch {
		return createUnavailableProjection();
	}
}

/**
 * Creates a fail-closed local client for semantic popup projections.
 * @param options - Local runtime transport.
 * @return Popup status client.
 * @since 0.1.0 Initial implementation.
 */
export function createPopupStatusClient( options: PopupStatusClientOptions ): PopupStatusClient {
	return {
		/**
		 * Reads the latest semantic popup projection.
		 * @param currentTab - Ephemeral current-tab context.
		 * @return Valid projection or an unavailable marker.
		 * @since 0.1.0 Initial implementation.
		 */
		readStatus( currentTab: PopupCurrentTabContext | null ): Promise<PopupProjection> {
			return sendRequest( options, {
				type: PopupRuntimeRequestType.READ_STATUS,
				currentTab,
			} );
		},

		/**
		 * Reconciles changed configuration before reading popup status.
		 * @param currentTab - Ephemeral current-tab context.
		 * @return Valid projection or an unavailable marker.
		 * @since 0.1.0 Initial implementation.
		 */
		refreshStatus( currentTab: PopupCurrentTabContext | null ): Promise<PopupProjection> {
			return sendRequest( options, {
				type: PopupRuntimeRequestType.REFRESH_STATUS,
				currentTab,
			} );
		},
	};
}

export * from './types';
