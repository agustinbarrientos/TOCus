import { vi } from 'vitest';
import {
	type BrowserProtectionRuntime,
	type BrowserProtectionStatisticsObservation,
} from '../../browser-protection-runtime';
import { createProtectionBackgroundController } from '../index';
import {
	type ProtectionBackgroundBrowser,
	type ProtectionBackgroundNavigationDetails,
	type ProtectionBackgroundSendResponse,
} from '../types';
import { StatisticsProjectionStatus } from '../../../../../domains/statistics/types/statistics-projection';

/**
 * Packaged interruption page accepted by authenticated message tests.
 * @since 0.1.0 Initial implementation.
 */
export const INTERRUPTION_PAGE_URL = 'chrome-extension://extension-id/interruption.html';

/**
 * Extension options page accepted by privileged message tests.
 * @since 0.1.0 Initial implementation.
 */
export const OPTIONS_PAGE_URL = 'chrome-extension://extension-id/options.html';

/**
 * Synchronous browser-event fixture that captures one registered listener.
 * @since 0.1.0 Initial implementation.
 */
class TestEvent<TArguments extends unknown[], TResult> {
	/**
	 * Registered browser-event listener.
	 * @since 0.1.0 Initial implementation.
	 */
	private listener: ( ( ...arguments_: TArguments ) => TResult ) | null = null;

	/**
	 * Registers one event listener.
	 * @param listener - Listener under test.
	 * @since 0.1.0 Initial implementation.
	 */
	addListener( listener: ( ...arguments_: TArguments ) => TResult ): void {
		this.listener = listener;
	}

	/**
	 * Removes the matching registered listener.
	 * @param listener - Listener that should no longer receive events.
	 * @since 0.1.0 Initial implementation.
	 */
	removeListener( listener: ( ...arguments_: TArguments ) => TResult ): void {
		if ( this.listener === listener ) {
			this.listener = null;
		}
	}

	/**
	 * Reports whether one listener was registered.
	 * @return Whether the event has a listener.
	 * @since 0.1.0 Initial implementation.
	 */
	hasListener(): boolean {
		return this.listener !== null;
	}

	/**
	 * Emits one event through the registered listener.
	 * @param arguments_ - Browser-event arguments.
	 * @return Listener result.
	 * @since 0.1.0 Initial implementation.
	 */
	emit( ...arguments_: TArguments ): TResult {
		if ( this.listener === null ) {
			throw new Error( 'Expected one registered browser-event listener.' );
		}

		return this.listener( ...arguments_ );
	}
}

/**
 * Controllable optional-permission result used to verify startup ordering.
 * @since 0.1.0 Initial implementation.
 */
export class DeferredPermissionResult {
	/**
	 * Permission lookup that remains pending until explicitly resolved.
	 * @since 0.1.0 Initial implementation.
	 */
	readonly promise: Promise<boolean>;

	/**
	 * Captured promise settlement operation.
	 * @since 0.1.0 Initial implementation.
	 */
	private resolvePromise: ( ( granted: boolean ) => void ) | null = null;

	/**
	 * Creates one pending permission lookup.
	 * @since 0.1.0 Initial implementation.
	 */
	constructor() {
		this.promise = new Promise<boolean>(
			/**
			 * Captures the lookup settlement operation.
			 * @param resolve - Promise settlement operation.
			 * @since 0.1.0 Initial implementation.
			 */
			( resolve ) => {
				this.resolvePromise = resolve;
			},
		);
	}

	/**
	 * Resolves the pending permission lookup.
	 * @param granted - Whether navigation observation is granted.
	 * @since 0.1.0 Initial implementation.
	 */
	resolve( granted: boolean ): void {
		if ( this.resolvePromise === null ) {
			throw new Error( 'Expected a pending permission result.' );
		}

		this.resolvePromise( granted );
	}
}

/**
 * Browser message sender fixture.
 * @since 0.1.0 Initial implementation.
 */
interface TestMessageSender {
	/** Sending frame identifier when the message came from a tab. */
	frameId?: number | undefined;
	/** Sending tab fixture. */
	tab?: {
		/** Whether the sender tab belongs to a private browsing context. */
		incognito?: boolean | undefined;
		/** Browser tab identifier. */
		id?: number | undefined;
	} | undefined;
	/** URL of the page or frame hosting the sending script. */
	url?: string | undefined;
}

/**
 * Browser permission-change fixture.
 * @since 0.1.0 Initial implementation.
 */
interface TestPermissionChange {
	/** Changed named permissions. */
	permissions?: ReadonlyArray<string> | undefined;
	/** Changed origin permissions. */
	origins?: ReadonlyArray<string> | undefined;
}

/**
 * Fully spied runtime returned to controller tests.
 * @since 0.1.0 Initial implementation.
 */
interface RuntimeHarness {
	/** Runtime contract supplied to the controller. */
	runtime: BrowserProtectionRuntime;
	/** Event-ingress statistics observation spy. */
	captureStatisticsObservation: ReturnType<typeof vi.fn>;
	/** Observation promises created synchronously at browser-event ingress. */
	capturedStatisticsObservations: Array<Promise<BrowserProtectionStatisticsObservation>>;
	/** Runtime startup spy. */
	start: ReturnType<typeof vi.fn>;
	/** Navigation spy. */
	handleNavigation: ReturnType<typeof vi.fn>;
	/** Page-request spy. */
	handlePageRequest: ReturnType<typeof vi.fn>;
	/** Tab-removal spy. */
	handleTabRemoved: ReturnType<typeof vi.fn>;
	/** Focus-change spy. */
	handleFocusChanged: ReturnType<typeof vi.fn>;
	/** Clock-tick spy. */
	handleClockTick: ReturnType<typeof vi.fn>;
	/** Configuration-change spy. */
	handleConfigurationChanged: ReturnType<typeof vi.fn>;
	/** Fail-open cleanup spy. */
	failOpen: ReturnType<typeof vi.fn>;
	/**
	 * Statistics read spy.
	 * @since 0.1.0 Initial implementation.
	 */
	readStatistics: ReturnType<typeof vi.fn>;
	/**
	 * Statistics reset spy.
	 * @since 0.1.0 Initial implementation.
	 */
	resetStatistics: ReturnType<typeof vi.fn>;
}

/**
 * Creates a fully spied protection runtime.
 * @return Browser protection runtime test double and operation spies.
 * @since 0.1.0 Initial implementation.
 */
function createRuntime(): RuntimeHarness {
	const capturedStatisticsObservations: Array<Promise<BrowserProtectionStatisticsObservation>> = [];
	const captureStatisticsObservation = vi.fn( () => {
		const observation = Promise.resolve( {
			observedAtEpochMilliseconds: capturedStatisticsObservations.length,
			focusObservation: null,
			focusEpochTransition: null,
		} );

		capturedStatisticsObservations.push( observation );
		return observation;
	} );
	const start = vi.fn().mockResolvedValue( undefined );
	const handleNavigation = vi.fn().mockResolvedValue( undefined );
	const handlePageRequest = vi.fn().mockResolvedValue( { state: 'unavailable' } );
	const handleTabRemoved = vi.fn().mockResolvedValue( undefined );
	const handleFocusChanged = vi.fn().mockResolvedValue( undefined );
	const handleClockTick = vi.fn().mockResolvedValue( undefined );
	const handleConfigurationChanged = vi.fn().mockResolvedValue( undefined );
	const failOpen = vi.fn().mockResolvedValue( undefined );
	const readStatistics = vi.fn().mockResolvedValue( {
		status: StatisticsProjectionStatus.UNAVAILABLE,
	} );
	const resetStatistics = vi.fn().mockResolvedValue( {
		status: StatisticsProjectionStatus.UNAVAILABLE,
	} );
	const runtime: BrowserProtectionRuntime = {
		captureStatisticsObservation,
		start,
		handleNavigation,
		handlePageRequest,
		handleTabRemoved,
		handleFocusChanged,
		handleClockTick,
		handleConfigurationChanged,
		failOpen,
		readStatistics,
		resetStatistics,
	};

	return {
		runtime,
		captureStatisticsObservation,
		capturedStatisticsObservations,
		start,
		handleNavigation,
		handlePageRequest,
		handleTabRemoved,
		handleFocusChanged,
		handleClockTick,
		handleConfigurationChanged,
		failOpen,
		readStatistics,
		resetStatistics,
	};
}

/**
 * Creates one controller with independently observable browser-event surfaces.
 * @param includeWebNavigation - Whether optional navigation observation is initially available.
 * @param hasNavigationPermission - Whether startup permission inspection succeeds.
 * @return Controller, runtime, events, and alarm creation spy.
 * @since 0.1.0 Initial implementation.
 */
export function createHarness( includeWebNavigation = true, hasNavigationPermission = includeWebNavigation ) {
	const runtimeHarness = createRuntime();
	const alarm = new TestEvent<[ { name: string } ], void>();
	const message = new TestEvent<
		[ unknown, TestMessageSender, ProtectionBackgroundSendResponse ],
		true | undefined
	>();
	const navigation = new TestEvent<[ ProtectionBackgroundNavigationDetails ], unknown>();
	const committedNavigation = new TestEvent<[ ProtectionBackgroundNavigationDetails ], unknown>();
	const errorNavigation = new TestEvent<[ ProtectionBackgroundNavigationDetails ], unknown>();
	const historyNavigation = new TestEvent<[ ProtectionBackgroundNavigationDetails ], unknown>();
	const referenceNavigation = new TestEvent<[ ProtectionBackgroundNavigationDetails ], unknown>();
	const permissionAddition = new TestEvent<[ TestPermissionChange ], void>();
	const permissionRemoval = new TestEvent<[ TestPermissionChange ], void>();
	const storageChange = new TestEvent<[ Readonly<Record<string, unknown>>, string ], void>();
	const tabActivation = new TestEvent<[ unknown ], unknown>();
	const tabRemoval = new TestEvent<[ number, unknown ], unknown>();
	const windowFocus = new TestEvent<[ number ], unknown>();
	const createAlarm = vi.fn().mockResolvedValue( undefined );
	const containsPermission = vi.fn().mockResolvedValue( hasNavigationPermission );
	const browser: ProtectionBackgroundBrowser = {
		alarms: { create: createAlarm, onAlarm: alarm },
		permissions: {
			contains: containsPermission,
			onAdded: permissionAddition,
			onRemoved: permissionRemoval,
		},
		runtime: { onMessage: message },
		storage: { onChanged: storageChange },
		tabs: { onActivated: tabActivation, onRemoved: tabRemoval },
		windows: { onFocusChanged: windowFocus },
		...( includeWebNavigation
			? {
				webNavigation: {
					onBeforeNavigate: navigation,
					onCommitted: committedNavigation,
					onErrorOccurred: errorNavigation,
					onHistoryStateUpdated: historyNavigation,
					onReferenceFragmentUpdated: referenceNavigation,
				},
			}
			: {} ),
	};
	const controller = createProtectionBackgroundController( {
		browser,
		interruptionPageUrl: INTERRUPTION_PAGE_URL,
		optionsPageUrl: OPTIONS_PAGE_URL,
		runtime: runtimeHarness.runtime,
	} );

	return {
		alarm,
		browser,
		controller,
		containsPermission,
		committedNavigation,
		createAlarm,
		errorNavigation,
		message,
		navigation,
		historyNavigation,
		referenceNavigation,
		permissionAddition,
		permissionRemoval,
		...runtimeHarness,
		storageChange,
		tabActivation,
		tabRemoval,
		windowFocus,
	};
}
