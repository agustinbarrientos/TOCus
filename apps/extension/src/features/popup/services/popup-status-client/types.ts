import { type PopupProjection } from '../../types/popup-projection';
import { type PopupCurrentTabContext } from '../../types/current-tab-context';
import { type PopupRuntimeRequest } from '../../types/runtime-message';

/**
 * Local runtime message transport used by the popup status client.
 * @since 0.1.0 Initial implementation.
 */
export interface PopupStatusClientRuntime {
	/**
	 * Sends one validated request to the extension background process.
	 * @param request - Current popup status request.
	 * @return Unknown response awaiting boundary validation.
	 * @since 0.1.0 Initial implementation.
	 */
	sendMessage( request: PopupRuntimeRequest ): Promise<unknown>;
}

/**
 * Dependencies used by the popup status client.
 * @since 0.1.0 Initial implementation.
 */
export interface PopupStatusClientOptions {
	/** Local extension message transport. */
	runtime: PopupStatusClientRuntime;
}

/**
 * Authoritative popup status operations.
 * @since 0.1.0 Initial implementation.
 */
export interface PopupStatusClient {
	/**
	 * Reads the latest semantic popup projection.
	 * @param currentTab - Ephemeral current-tab context.
	 * @return Valid projection or an unavailable marker.
	 * @since 0.1.0 Initial implementation.
	 */
	readStatus( currentTab: PopupCurrentTabContext | null ): Promise<PopupProjection>;

	/**
	 * Reconciles changed configuration before reading popup status.
	 * @param currentTab - Ephemeral current-tab context.
	 * @return Valid projection or an unavailable marker.
	 * @since 0.1.0 Initial implementation.
	 */
	refreshStatus( currentTab: PopupCurrentTabContext | null ): Promise<PopupProjection>;
}
