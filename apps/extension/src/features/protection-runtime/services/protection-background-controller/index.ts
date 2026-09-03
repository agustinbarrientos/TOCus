import { ProtectionConfigurationStorageKey } from '../../../../domains/protection/services/protection-configuration-storage';
import {
	InterruptionPageRequestSchema,
	InterruptionPageResponseSchema,
	InterruptionPageResponseState,
	ProtectionClockRequestSchema,
} from '../../types/runtime-message';
import { isProtectionClockAlarmName } from '../browser-protection-adapter';
import {
	ProtectionBackgroundAlarmName,
	type ProtectionBackgroundAlarm,
	type ProtectionBackgroundController,
	type ProtectionBackgroundControllerOptions,
	type ProtectionBackgroundMessageSender,
	type ProtectionBackgroundNavigationEvent,
	type ProtectionBackgroundPermissionChange,
	type ProtectionBackgroundSendResponse,
	type ProtectionBackgroundStorageChanges,
} from './types';

const RECONCILIATION_PERIOD_MINUTES = 1;

/**
 * Reports whether a runtime request came from an HTTP(S) top-level tab document.
 * @param sender - Browser-provided message sender.
 * @return Whether the sender is an authenticated protected-page controller.
 * @since 0.1.0 Initial implementation.
 */
function isAuthenticatedProtectedPageSender(
	sender: ProtectionBackgroundMessageSender,
): boolean {
	if ( sender.frameId !== 0 || sender.tab === undefined || sender.url === undefined ) {
		return false;
	}

	try {
		const senderUrl = new URL( sender.url );

		return senderUrl.protocol === 'http:' || senderUrl.protocol === 'https:';
	} catch {
		return false;
	}
}

/**
 * Reports whether a runtime request came from an approved top-level page context.
 * @param sender - Browser-provided message sender.
 * @param interruptionPageUrl - Exact extension-owned interruption page URL.
 * @return Whether the sender is the interruption page or the packaged controller on an HTTP(S) tab.
 * @since 0.1.0 Initial implementation.
 */
function isAuthenticatedPageRequestSender(
	sender: ProtectionBackgroundMessageSender,
	interruptionPageUrl: string,
): boolean {
	if ( sender.frameId !== 0 || sender.url === undefined ) {
		return false;
	}

	if ( sender.url === interruptionPageUrl ) {
		return true;
	}

	return isAuthenticatedProtectedPageSender( sender );
}

/**
 * Creates synchronous browser event coordination for the protection runtime.
 * @param options - Browser events and authoritative protection runtime.
 * @return Background registration operation.
 * @since 0.1.0 Initial implementation.
 */
export function createProtectionBackgroundController(
	options: ProtectionBackgroundControllerOptions,
): ProtectionBackgroundController {
	let capabilityOperation: Promise<void> = Promise.resolve();
	let registeredNavigationEvents: ProtectionBackgroundNavigationEvent[] = [];

	/**
	 * Absorbs a terminal cleanup rejection after the runtime has already attempted to fail open.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleTerminalCleanupFailure(): void {
		return;
	}

	/**
	 * Attempts fail-open cleanup after an asynchronous runtime operation rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleRuntimeFailure(): void {
		void options.runtime.failOpen().catch( handleTerminalCleanupFailure );
	}

	/**
	 * Observes one event-only runtime operation through the fail-open error boundary.
	 * @param operation - Runtime operation already started by a browser event.
	 * @since 0.1.0 Initial implementation.
	 */
	function observeRuntimeOperation( operation: Promise<void> ): void {
		void operation.catch( handleRuntimeFailure );
	}

	/**
	 * Serializes one navigation-capability transition and contains terminal cleanup failures.
	 * @param operation - Deferred startup, grant, or revocation operation.
	 * @since 0.1.0 Initial implementation.
	 */
	function enqueueCapabilityOperation( operation: () => Promise<void> ): void {
		const result = capabilityOperation.then( operation );

		capabilityOperation = result.catch( async () => {
			try {
				await options.runtime.failOpen();
			} catch {
				handleTerminalCleanupFailure();
			}
		} );
	}

	/**
	 * Runs one browser event only after pending navigation-capability transitions settle.
	 * @param operation - Deferred runtime operation.
	 * @return Runtime operation result.
	 * @since 0.1.0 Initial implementation.
	 */
	function runAfterCapability<T>( operation: () => Promise<T> ): Promise<T> {
		return capabilityOperation.then( operation );
	}

	/**
	 * Starts restoration only when the optional navigation capability is currently granted.
	 * @return Promise resolved after restoration or fail-open cleanup.
	 * @since 0.1.0 Initial implementation.
	 */
	async function initializeRuntime(): Promise<void> {
		const hasNavigationPermission = await options.browser.permissions.contains( {
			permissions: [ 'webNavigation' ],
		} );

		if ( ! hasNavigationPermission ) {
			await options.runtime.failOpen();
			return;
		}

		await options.runtime.start();
	}

	/**
	 * Reconciles configuration only while navigation observation remains granted.
	 * @return Promise resolved after reconciliation or fail-open cleanup.
	 * @since 0.1.0 Initial implementation.
	 */
	async function reconcileConfiguration(): Promise<void> {
		const hasNavigationPermission = await options.browser.permissions.contains( {
			permissions: [ 'webNavigation' ],
		} );

		if ( ! hasNavigationPermission ) {
			unregisterNavigationListener();
			await options.runtime.failOpen();
			return;
		}

		await options.runtime.handleConfigurationChanged();
	}

	/**
	 * Routes one top-level navigation without returning a Promise to the browser event.
	 * @param navigation - Browser navigation observed before or after commit.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleNavigation(
		navigation: Parameters<ProtectionBackgroundControllerOptions[ 'runtime' ][ 'handleNavigation' ]>[ 0 ],
	): void {
		if ( navigation.frameId !== 0 ) {
			return;
		}

		observeRuntimeOperation( runAfterCapability( () => options.runtime.handleNavigation( navigation ) ) );
	}

	/**
	 * Registers navigation observation when the optional browser API is currently available.
	 * @since 0.1.0 Initial implementation.
	 */
	function registerNavigationListener(): void {
		const webNavigation = options.browser.webNavigation;

		if ( registeredNavigationEvents.length > 0 || webNavigation === undefined ) {
			return;
		}

		registeredNavigationEvents = [
			webNavigation.onBeforeNavigate,
			webNavigation.onCommitted,
			...( webNavigation.onHistoryStateUpdated === undefined
				? []
				: [ webNavigation.onHistoryStateUpdated ] ),
			...( webNavigation.onReferenceFragmentUpdated === undefined
				? []
				: [ webNavigation.onReferenceFragmentUpdated ] ),
		];
		registeredNavigationEvents.forEach( ( navigationEvent ) => {
			navigationEvent.addListener( handleNavigation );
		} );
	}

	/**
	 * Stops navigation observation after its optional browser permission is revoked.
	 * @since 0.1.0 Initial implementation.
	 */
	function unregisterNavigationListener(): void {
		registeredNavigationEvents.forEach( ( navigationEvent ) => {
			navigationEvent.removeListener( handleNavigation );
		} );
		registeredNavigationEvents = [];
	}

	/**
	 * Routes validated protected-page clock requests and claims authenticated interruption requests.
	 * @param input - Unknown extension runtime message.
	 * @param sender - Browser-provided message sender.
	 * @param sender.frameId - Sending frame identifier when supplied for a tab sender.
	 * @param sender.tab - Sending tab when the message came from a tab page.
	 * @param sender.tab.id - Browser-assigned sender tab identifier when available.
	 * @param sender.url - URL of the page or frame hosting the sending script.
	 * @param sendResponse - Browser callback for the asynchronous response.
	 * @return True for one claimed interruption request, otherwise undefined.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleMessage(
		input: unknown,
		sender: ProtectionBackgroundMessageSender,
		sendResponse: ProtectionBackgroundSendResponse,
	): true | undefined {
		const clockRequest = ProtectionClockRequestSchema.safeParse( input );

		if ( clockRequest.success ) {
			if ( ! isAuthenticatedProtectedPageSender( sender ) ) {
				return undefined;
			}

			sendResponse();
			observeRuntimeOperation( runAfterCapability( () => options.runtime.handleClockTick() ) );
			return undefined;
		}

		if (
			! InterruptionPageRequestSchema.safeParse( input ).success ||
			! isAuthenticatedPageRequestSender( sender, options.interruptionPageUrl )
		) {
			return undefined;
		}

		void runAfterCapability( () => options.runtime.handlePageRequest( input, sender.tab?.id ?? null ) )
			.then( sendResponse )
			.catch( () => {
				sendResponse( InterruptionPageResponseSchema.parse( {
					state: InterruptionPageResponseState.UNAVAILABLE,
				} ) );
				handleRuntimeFailure();
			} );

		return true;
	}

	/**
	 * Routes one tab removal through the runtime error boundary.
	 * @param tabId - Removed browser tab identifier.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleTabRemoved( tabId: number ): void {
		observeRuntimeOperation( runAfterCapability( () => options.runtime.handleTabRemoved( tabId ) ) );
	}

	/**
	 * Reconciles protection focus after a tab or browser-window focus change.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleFocusChanged(): void {
		observeRuntimeOperation( runAfterCapability( () => options.runtime.handleFocusChanged() ) );
	}

	/**
	 * Reconciles a changed local protection configuration.
	 * @param changes - Changed browser storage entries.
	 * @param areaName - Browser storage area containing the changes.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleStorageChanged( changes: ProtectionBackgroundStorageChanges, areaName: string ): void {
		if (
			areaName !== 'local' ||
			! Object.hasOwn( changes, ProtectionConfigurationStorageKey.CONFIGURATION )
		) {
			return;
		}

		observeRuntimeOperation( runAfterCapability( reconcileConfiguration ) );
	}

	/**
	 * Reconciles only removed capabilities used by protected-site navigation.
	 * @param removal - Removed named and origin permissions.
	 * @param removal.permissions - Removed named permissions.
	 * @param removal.origins - Removed host origins.
	 * @since 0.1.0 Initial implementation.
	 */
	function handlePermissionRemoved( removal: ProtectionBackgroundPermissionChange ): void {
		if ( removal.permissions?.includes( 'webNavigation' ) ) {
			unregisterNavigationListener();
			enqueueCapabilityOperation( () => options.runtime.failOpen() );
			return;
		}

		if ( ( removal.origins?.length ?? 0 ) === 0 ) {
			return;
		}

		observeRuntimeOperation( runAfterCapability( reconcileConfiguration ) );
	}

	/**
	 * Restores runtime protection after required navigation access is granted again.
	 * @param addition - Newly granted named and origin permissions.
	 * @param addition.permissions - Newly granted named permissions.
	 * @param addition.origins - Newly granted host origins.
	 * @since 0.1.0 Initial implementation.
	 */
	function handlePermissionAdded( addition: ProtectionBackgroundPermissionChange ): void {
		if ( addition.permissions?.includes( 'webNavigation' ) ) {
			registerNavigationListener();
			enqueueCapabilityOperation( () => options.runtime.start() );
			return;
		}

		if ( ( addition.origins?.length ?? 0 ) > 0 ) {
			observeRuntimeOperation( runAfterCapability( reconcileConfiguration ) );
		}
	}

	/**
	 * Routes only protection-owned alarms to wall-clock reconciliation.
	 * @param alarm - Browser alarm details.
	 * @param alarm.name - Browser-assigned alarm name.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleAlarm( alarm: ProtectionBackgroundAlarm ): void {
		if (
			alarm.name !== ProtectionBackgroundAlarmName.RECONCILIATION &&
			! isProtectionClockAlarmName( alarm.name )
		) {
			return;
		}

		observeRuntimeOperation( runAfterCapability( () => options.runtime.handleClockTick() ) );
	}

	/**
	 * Registers listeners synchronously before asynchronous restoration begins.
	 * @since 0.1.0 Initial implementation.
	 */
	function start(): void {
		registerNavigationListener();
		options.browser.runtime.onMessage.addListener( handleMessage );
		options.browser.tabs.onRemoved.addListener( handleTabRemoved );
		options.browser.tabs.onActivated.addListener( handleFocusChanged );
		options.browser.windows.onFocusChanged.addListener( handleFocusChanged );
		options.browser.storage.onChanged.addListener( handleStorageChanged );
		options.browser.permissions.onAdded.addListener( handlePermissionAdded );
		options.browser.permissions.onRemoved.addListener( handlePermissionRemoved );
		options.browser.alarms.onAlarm.addListener( handleAlarm );

		enqueueCapabilityOperation( initializeRuntime );
		void Promise.resolve( options.browser.alarms.create(
			ProtectionBackgroundAlarmName.RECONCILIATION,
			{ periodInMinutes: RECONCILIATION_PERIOD_MINUTES },
		) ).catch( handleTerminalCleanupFailure );
	}

	return { start };
}

export * from './types';
