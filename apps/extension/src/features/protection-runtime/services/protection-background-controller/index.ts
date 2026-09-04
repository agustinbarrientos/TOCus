import { ProtectionConfigurationStorageKey } from '../../../../domains/protection/services/protection-configuration-storage';
import {
	InterruptionPageRequestSchema,
	InterruptionPageRequestType,
	InterruptionPageResponseSchema,
	InterruptionPageResponseState,
	ProtectionClockRequestSchema,
} from '../../types/runtime-message';
import { ProtectionRuntimeNavigationPhase } from '../../types/browser-runtime';
import { isProtectionClockAlarmName } from '../browser-protection-adapter';
import {
	StatisticsProjectionSchema,
	StatisticsProjectionStatus,
	type StatisticsProjection,
} from '../../../../domains/statistics/types/statistics-projection';
import {
	StatisticsRuntimeRequestSchema,
	StatisticsRuntimeRequestType,
} from '../../../statistics/types/runtime-message';
import { type BrowserProtectionFocusEventIdentity } from '../../../statistics/services/browser-statistics-bridge';
import { StatisticsFocusObservationMode } from '../../../../domains/statistics/utils/prepare-statistics-checkpoint';
import {
	ProtectionBackgroundAlarmName,
	type ProtectionBackgroundAlarm,
	type ProtectionBackgroundController,
	type ProtectionBackgroundControllerOptions,
	type ProtectionBackgroundMessageSender,
	type ProtectionBackgroundNavigationDetails,
	type ProtectionBackgroundNavigationEvent,
	type ProtectionBackgroundNavigationListener,
	type ProtectionBackgroundPermissionChange,
	type ProtectionBackgroundSendResponse,
	type ProtectionBackgroundStorageChanges,
} from './types';

/**
 * Period between wall-clock reconciliation alarms.
 * @since 0.1.0 Initial implementation.
 */
const RECONCILIATION_PERIOD_MINUTES = 1;

/**
 * Cross-browser window identifier emitted when the browser loses operating-system focus.
 * @since 0.1.0 Initial implementation.
 */
const UNFOCUSED_BROWSER_WINDOW_ID = -1;

/**
 * Parses one browser tab-activation identity conservatively.
 * @param activation - Unknown browser activation payload.
 * @return Exact tab and window identity, or null when malformed.
 * @since 0.1.0 Initial implementation.
 */
function parseTabActivation(
	activation: unknown,
): BrowserProtectionFocusEventIdentity | null {
	if ( typeof activation !== 'object' || activation === null ) {
		return null;
	}

	const tabId = 'tabId' in activation ? activation.tabId : undefined;
	const windowId = 'windowId' in activation ? activation.windowId : undefined;

	return Number.isSafeInteger( tabId ) && Number( tabId ) >= 0 &&
		Number.isSafeInteger( windowId ) && Number( windowId ) >= 0
		? { tabId: Number( tabId ), windowId: Number( windowId ) }
		: null;
}

/**
 * Parses one browser window-focus identity conservatively.
 * @param windowId - Browser-provided focused window identifier.
 * @return Exact window identity, or null when malformed.
 * @since 0.1.0 Initial implementation.
 */
function parseWindowFocus(
	windowId: number,
): BrowserProtectionFocusEventIdentity | null {
	return Number.isSafeInteger( windowId ) && windowId >= UNFOCUSED_BROWSER_WINDOW_ID
		? { windowId }
		: null;
}

/**
 * Creates an unavailable statistics response without fabricating local values.
 * @return Unavailable statistics projection.
 * @since 0.1.0 Initial implementation.
 */
function createUnavailableStatisticsResponse(): StatisticsProjection {
	return StatisticsProjectionSchema.parse( {
		status: StatisticsProjectionStatus.UNAVAILABLE,
	} );
}

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
 * Reports whether a runtime request came from the exact top-level settings page.
 * @param sender - Browser-provided message sender.
 * @param optionsPageUrl - Exact extension-owned settings page URL.
 * @return Whether the sender is the top-level settings document, allowing only its hash route.
 * @since 0.1.0 Initial implementation.
 */
function isAuthenticatedOptionsPageSender(
	sender: ProtectionBackgroundMessageSender,
	optionsPageUrl: string,
): boolean {
	if ( sender.frameId !== 0 || sender.url === undefined ) {
		return false;
	}

	try {
		const senderUrl = new URL( sender.url );
		const expectedUrl = new URL( optionsPageUrl );

		senderUrl.hash = '';
		expectedUrl.hash = '';

		return senderUrl.href === expectedUrl.href;
	} catch {
		return false;
	}
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
	let registeredNavigationEvents: Array<readonly [
		ProtectionBackgroundNavigationEvent,
		ProtectionBackgroundNavigationListener,
	]> = [];

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
	 * @param statisticsObservation - Browser inputs captured before permission lookup.
	 * @return Promise resolved after restoration or fail-open cleanup.
	 * @since 0.1.0 Initial implementation.
	 */
	async function initializeRuntime(
		statisticsObservation: ReturnType<
			ProtectionBackgroundControllerOptions[ 'runtime' ][ 'captureStatisticsObservation' ]
		>,
	): Promise<void> {
		const hasNavigationPermission = await options.browser.permissions.contains( {
			permissions: [ 'webNavigation' ],
		} );

		if ( ! hasNavigationPermission ) {
			await options.runtime.failOpen( statisticsObservation );
			return;
		}

		await options.runtime.start( statisticsObservation );
	}

	/**
	 * Reconciles configuration only while navigation observation remains granted.
	 * @param statisticsObservation - Browser inputs captured before capability serialization.
	 * @return Promise resolved after reconciliation or fail-open cleanup.
	 * @since 0.1.0 Initial implementation.
	 */
	async function reconcileConfiguration(
		statisticsObservation: ReturnType<
			ProtectionBackgroundControllerOptions[ 'runtime' ][ 'captureStatisticsObservation' ]
		>,
	): Promise<void> {
		const hasNavigationPermission = await options.browser.permissions.contains( {
			permissions: [ 'webNavigation' ],
		} );

		if ( ! hasNavigationPermission ) {
			unregisterNavigationListener();
			await options.runtime.failOpen( statisticsObservation );
			return;
		}

		await options.runtime.handleConfigurationChanged( statisticsObservation );
	}

	/**
	 * Creates one browser-neutral navigation observation without inventing unavailable metadata.
	 * @param navigation - Browser navigation details.
	 * @param phase - Event phase known from the browser event surface.
	 * @return Navigation observation consumed by protection runtime.
	 * @since 0.1.0 Initial implementation.
	 */
	function createRuntimeNavigation(
		navigation: ProtectionBackgroundNavigationDetails,
		phase: ProtectionRuntimeNavigationPhase,
	): Parameters<ProtectionBackgroundControllerOptions[ 'runtime' ][ 'handleNavigation' ]>[ 0 ] {
		return {
			frameId: navigation.frameId,
			phase,
			tabId: navigation.tabId,
			...( navigation.transitionQualifiers === undefined
				? {}
				: { transitionQualifiers: [ ...navigation.transitionQualifiers ] } ),
			...( navigation.transitionType === undefined
				? {}
				: { transitionType: navigation.transitionType } ),
			url: navigation.url,
		};
	}

	/**
	 * Routes one top-level navigation without returning a Promise to the browser event.
	 * @param navigation - Browser navigation details.
	 * @param phase - Event phase known from the browser event surface.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleNavigation(
		navigation: ProtectionBackgroundNavigationDetails,
		phase: ProtectionRuntimeNavigationPhase,
	): void {
		if ( navigation.frameId !== 0 ) {
			return;
		}

		const runtimeNavigation = createRuntimeNavigation( navigation, phase );
		const statisticsObservation = options.runtime.captureStatisticsObservation(
			StatisticsFocusObservationMode.BOUNDARY,
			runtimeNavigation,
		);

		observeRuntimeOperation( runAfterCapability(
			() => options.runtime.handleNavigation( runtimeNavigation, statisticsObservation ),
		) );
	}

	/**
	 * Registers one browser navigation event with its known lifecycle phase.
	 * @param navigationEvent - Browser event source.
	 * @param phase - Runtime phase attached to every event observation.
	 * @since 0.1.0 Initial implementation.
	 */
	function registerNavigationEvent(
		navigationEvent: ProtectionBackgroundNavigationEvent,
		phase: ProtectionRuntimeNavigationPhase,
	): void {
		/**
		 * Routes one navigation observation through the phase-specific listener.
		 * @param navigation - Browser navigation details.
		 * @since 0.1.0 Initial implementation.
		 */
		const listener: ProtectionBackgroundNavigationListener = ( navigation ) => {
			handleNavigation( navigation, phase );
		};

		navigationEvent.addListener( listener );
		registeredNavigationEvents.push( [ navigationEvent, listener ] );
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

		registerNavigationEvent(
			webNavigation.onBeforeNavigate,
			ProtectionRuntimeNavigationPhase.BEFORE_NAVIGATE,
		);
		registerNavigationEvent(
			webNavigation.onCommitted,
			ProtectionRuntimeNavigationPhase.COMMITTED,
		);

		if ( webNavigation.onErrorOccurred !== undefined ) {
			registerNavigationEvent(
				webNavigation.onErrorOccurred,
				ProtectionRuntimeNavigationPhase.ERROR_OCCURRED,
			);
		}

		if ( webNavigation.onHistoryStateUpdated !== undefined ) {
			registerNavigationEvent(
				webNavigation.onHistoryStateUpdated,
				ProtectionRuntimeNavigationPhase.HISTORY_STATE_UPDATED,
			);
		}

		if ( webNavigation.onReferenceFragmentUpdated !== undefined ) {
			registerNavigationEvent(
				webNavigation.onReferenceFragmentUpdated,
				ProtectionRuntimeNavigationPhase.REFERENCE_FRAGMENT_UPDATED,
			);
		}
	}

	/**
	 * Stops navigation observation after its optional browser permission is revoked.
	 * @since 0.1.0 Initial implementation.
	 */
	function unregisterNavigationListener(): void {
		registeredNavigationEvents.forEach( ( [ navigationEvent, listener ] ) => {
			navigationEvent.removeListener( listener );
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
		const statisticsRequest = StatisticsRuntimeRequestSchema.safeParse( input );

		if ( statisticsRequest.success ) {
			const isOptionsPage = isAuthenticatedOptionsPageSender(
				sender,
				options.optionsPageUrl,
			);
			const isReadRequest = statisticsRequest.data.type ===
				StatisticsRuntimeRequestType.READ_STATISTICS;
			const isAuthorized = isOptionsPage || (
				isReadRequest && isAuthenticatedPageRequestSender(
					sender,
					options.interruptionPageUrl,
				)
			);

			if ( ! isAuthorized ) {
				return undefined;
			}

			void runAfterCapability<StatisticsProjection>( () => {
				switch ( statisticsRequest.data.type ) {
					case StatisticsRuntimeRequestType.READ_STATISTICS:
						return options.runtime.readStatistics();
					case StatisticsRuntimeRequestType.RESET_STATISTICS:
						return options.runtime.resetStatistics();
				}
			} )
				.then( sendResponse )
				.catch( () => {
					sendResponse( createUnavailableStatisticsResponse() );
				} );

			return true;
		}

		const clockRequest = ProtectionClockRequestSchema.safeParse( input );

		if ( clockRequest.success ) {
			if ( ! isAuthenticatedProtectedPageSender( sender ) ) {
				return undefined;
			}

			const statisticsObservation = options.runtime.captureStatisticsObservation(
				StatisticsFocusObservationMode.BOUNDARY,
			);

			sendResponse();
			observeRuntimeOperation( runAfterCapability(
				() => options.runtime.handleClockTick( statisticsObservation ),
			) );
			return undefined;
		}

		const pageRequest = InterruptionPageRequestSchema.safeParse( input );

		if (
			! pageRequest.success ||
			! isAuthenticatedPageRequestSender( sender, options.interruptionPageUrl )
		) {
			return undefined;
		}

		const statisticsObservation = options.runtime.captureStatisticsObservation(
			StatisticsFocusObservationMode.BOUNDARY,
		);

		if ( pageRequest.data.type === InterruptionPageRequestType.RECOVER ) {
			enqueueCapabilityOperation( () => initializeRuntime( statisticsObservation ) );
		}

		void runAfterCapability(
			() => options.runtime.handlePageRequest(
				pageRequest.data,
				sender.tab?.id ?? null,
				sender.tab?.incognito === false,
				statisticsObservation,
			),
		)
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
		const statisticsObservation = options.runtime.captureStatisticsObservation(
			StatisticsFocusObservationMode.BOUNDARY,
		);

		observeRuntimeOperation( runAfterCapability(
			() => options.runtime.handleTabRemoved( tabId, statisticsObservation ),
		) );
	}

	/**
	 * Reconciles protection focus after a tab or browser-window focus change.
	 * @param activation - Browser-provided active tab and window identity.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleTabActivated( activation: unknown ): void {
		const statisticsObservation = options.runtime.captureStatisticsObservation(
			StatisticsFocusObservationMode.BOUNDARY,
			undefined,
			parseTabActivation( activation ),
		);

		observeRuntimeOperation( runAfterCapability(
			() => options.runtime.handleFocusChanged( statisticsObservation ),
		) );
	}

	/**
	 * Reconciles protection focus after the browser window gains or loses focus.
	 * @param windowId - Browser-provided focused window identifier.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleWindowFocusChanged( windowId: number ): void {
		const statisticsObservation = options.runtime.captureStatisticsObservation(
			StatisticsFocusObservationMode.BOUNDARY,
			undefined,
			parseWindowFocus( windowId ),
		);

		observeRuntimeOperation( runAfterCapability(
			() => options.runtime.handleFocusChanged( statisticsObservation ),
		) );
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

		const statisticsObservation = options.runtime.captureStatisticsObservation(
			StatisticsFocusObservationMode.BOUNDARY,
		);

		observeRuntimeOperation( runAfterCapability(
			() => reconcileConfiguration( statisticsObservation ),
		) );
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
			const statisticsObservation = options.runtime.captureStatisticsObservation(
				StatisticsFocusObservationMode.BOUNDARY,
			);

			enqueueCapabilityOperation( () => options.runtime.failOpen( statisticsObservation ) );
			return;
		}

		if ( ( removal.origins?.length ?? 0 ) === 0 ) {
			return;
		}

		const statisticsObservation = options.runtime.captureStatisticsObservation(
			StatisticsFocusObservationMode.BOUNDARY,
		);

		observeRuntimeOperation( runAfterCapability(
			() => reconcileConfiguration( statisticsObservation ),
		) );
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
			const statisticsObservation = options.runtime.captureStatisticsObservation(
				StatisticsFocusObservationMode.BOUNDARY,
			);

			enqueueCapabilityOperation( () => options.runtime.start( statisticsObservation ) );
			return;
		}

		if ( ( addition.origins?.length ?? 0 ) > 0 ) {
			const statisticsObservation = options.runtime.captureStatisticsObservation(
				StatisticsFocusObservationMode.BOUNDARY,
			);

			observeRuntimeOperation( runAfterCapability(
				() => reconcileConfiguration( statisticsObservation ),
			) );
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

		const statisticsObservation = options.runtime.captureStatisticsObservation(
			StatisticsFocusObservationMode.BOUNDARY,
		);

		observeRuntimeOperation( runAfterCapability(
			() => options.runtime.handleClockTick( statisticsObservation ),
		) );
	}

	/**
	 * Registers listeners synchronously before asynchronous restoration begins.
	 * @since 0.1.0 Initial implementation.
	 */
	function start(): void {
		registerNavigationListener();
		options.browser.runtime.onMessage.addListener( handleMessage );
		options.browser.tabs.onRemoved.addListener( handleTabRemoved );
		options.browser.tabs.onActivated.addListener( handleTabActivated );
		options.browser.windows.onFocusChanged.addListener( handleWindowFocusChanged );
		options.browser.storage.onChanged.addListener( handleStorageChanged );
		options.browser.permissions.onAdded.addListener( handlePermissionAdded );
		options.browser.permissions.onRemoved.addListener( handlePermissionRemoved );
		options.browser.alarms.onAlarm.addListener( handleAlarm );

		const statisticsObservation = options.runtime.captureStatisticsObservation(
			StatisticsFocusObservationMode.STARTUP,
		);

		enqueueCapabilityOperation( () => initializeRuntime( statisticsObservation ) );
		void Promise.resolve( options.browser.alarms.create(
			ProtectionBackgroundAlarmName.RECONCILIATION,
			{ periodInMinutes: RECONCILIATION_PERIOD_MINUTES },
		) ).catch( handleTerminalCleanupFailure );
	}

	return { start };
}

export * from './types';
