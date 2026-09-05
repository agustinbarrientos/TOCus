import {
	PopupProjectionSchema,
	PopupProjectionStatus,
	type PopupProjection,
} from '../../types/popup-projection';
import {
	PopupRuntimeRequestSchema,
	PopupRuntimeRequestType,
	type PopupRuntimeRequest,
} from '../../types/runtime-message';
import { type BrowserProtectionRuntimeSnapshot } from '../../../protection-runtime/services/browser-protection-runtime';
import { createPopupProjection } from '../../utils/create-popup-projection';
import {
	type PopupBackgroundController,
	type PopupBackgroundControllerOptions,
	type PopupBackgroundMessageSender,
	type PopupBackgroundSendResponse,
} from './types';

const NAVIGATION_PERMISSION = 'webNavigation';

/**
 * Creates a validated unavailable popup response.
 * @return Unavailable semantic popup projection.
 * @since 0.1.0 Initial implementation.
 */
function createUnavailableProjection(): PopupProjection {
	return PopupProjectionSchema.parse( { status: PopupProjectionStatus.UNAVAILABLE } );
}

/**
 * Reports whether a message came from the exact extension popup page.
 * @param sender - Browser-provided message sender.
 * @param popupPageUrl - Exact extension-owned popup URL.
 * @return Whether the sender is authorized to read popup state.
 * @since 0.1.0 Initial implementation.
 */
function isAuthenticatedPopupSender(
	sender: PopupBackgroundMessageSender,
	popupPageUrl: string,
): boolean {
	return sender.url === popupPageUrl;
}

/**
 * Loads popup-readable configuration only when optional navigation access is absent.
 * @param options - Popup background dependencies.
 * @return Read-only snapshot with no active enforcement, or null for a runtime failure.
 * @since 0.1.0 Initial implementation.
 */
async function readNoCapabilitySnapshot(
	options: PopupBackgroundControllerOptions,
): Promise<BrowserProtectionRuntimeSnapshot | null> {
	const hasNavigationPermission = await options.browser.permissions.contains( {
		permissions: [ NAVIGATION_PERMISSION ],
	} );

	if ( hasNavigationPermission ) {
		return null;
	}
	const configuration = await options.configurationStorage.load();

	return configuration === null
		? null
		: {
			configuration,
			activeConfiguration: null,
			statesByScope: {},
			capturedAtEpochMilliseconds: options.now(),
			timeZone: options.getTimeZone(),
		};
}

/**
 * Reads one semantic projection without exposing configuration or retained destinations.
 * @param options - Popup background dependencies.
 * @param request - Validated popup runtime request.
 * @return Current validated semantic projection.
 * @since 0.1.0 Initial implementation.
 */
async function readProjection(
	options: PopupBackgroundControllerOptions,
	request: PopupRuntimeRequest,
): Promise<PopupProjection> {
	if ( request.type === PopupRuntimeRequestType.REFRESH_STATUS ) {
		await options.refreshProtection();
	} else {
		await options.waitForProtectionReady();
	}
	let snapshot = await options.runtime.readSnapshot();

	if ( snapshot === null ) {
		snapshot = await readNoCapabilitySnapshot( options );
	}

	return createPopupProjection( {
		currentTab: request.currentTab,
		interruptionPageUrl: options.interruptionPageUrl,
		snapshot,
	} );
}

/**
 * Creates authenticated local messaging for popup status projection.
 * @param options - Browser messaging and authoritative protection runtime.
 * @return Synchronous background-listener registration.
 * @since 0.1.0 Initial implementation.
 */
export function createPopupBackgroundController(
	options: PopupBackgroundControllerOptions,
): PopupBackgroundController {
	/**
	 * Routes one validated request from the exact popup page.
	 * @param input - Unknown local runtime message.
	 * @param sender - Browser-provided sender identity.
	 * @param sendResponse - Asynchronous response callback.
	 * @return True when this controller claims the asynchronous request.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleMessage(
		input: unknown,
		sender: PopupBackgroundMessageSender,
		sendResponse: PopupBackgroundSendResponse,
	): true | undefined {
		const request = PopupRuntimeRequestSchema.safeParse( input );

		if ( ! request.success || ! isAuthenticatedPopupSender( sender, options.popupPageUrl ) ) {
			return undefined;
		}

		void readProjection( options, request.data )
			.then( sendResponse )
			.catch( () => {
				sendResponse( createUnavailableProjection() );
			} );

		return true;
	}

	/**
	 * Registers the popup message listener synchronously.
	 * @since 0.1.0 Initial implementation.
	 */
	function start(): void {
		options.browser.runtime.onMessage.addListener( handleMessage );
	}

	return { start };
}

export * from './types';
