import { describe, expect, it, vi } from 'vitest';
import { type BrowserProtectionRuntime } from '../browser-protection-runtime';
import {
	InterruptionPageRequestType,
	ProtectionClockRequestType,
	type InterruptionPageResponse,
} from '../../types/runtime-message';
import {
	createProtectionBackgroundController,
	ProtectionBackgroundAlarmName,
} from './index';
import {
	type ProtectionBackgroundBrowser,
	type ProtectionBackgroundSendResponse,
} from './types';
import { type ProtectionRuntimeNavigation } from '../../types/browser-runtime';

const INTERRUPTION_PAGE_URL = 'chrome-extension://extension-id/interruption.html';

/**
 * Synchronous browser-event fixture that captures one registered listener.
 */
class TestEvent<TArguments extends unknown[], TResult> {
	/** Registered browser-event listener. */
	private listener: ( ( ...arguments_: TArguments ) => TResult ) | null = null;

	/**
	 * Registers one event listener.
	 * @param listener - Listener under test.
	 */
	addListener( listener: ( ...arguments_: TArguments ) => TResult ): void {
		this.listener = listener;
	}

	/**
	 * Removes the matching registered listener.
	 * @param listener - Listener that should no longer receive events.
	 */
	removeListener( listener: ( ...arguments_: TArguments ) => TResult ): void {
		if ( this.listener === listener ) {
			this.listener = null;
		}
	}

	/**
	 * Reports whether one listener was registered.
	 * @return Whether the event has a listener.
	 */
	hasListener(): boolean {
		return this.listener !== null;
	}

	/**
	 * Emits one event through the registered listener.
	 * @param arguments_ - Browser-event arguments.
	 * @return Listener result.
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
 */
class DeferredPermissionResult {
	/** Permission lookup that remains pending until explicitly resolved. */
	readonly promise: Promise<boolean>;

	/** Captured Promise settlement operation. */
	private resolvePromise: ( ( granted: boolean ) => void ) | null = null;

	/**
	 * Creates one pending permission lookup.
	 */
	constructor() {
		this.promise = new Promise<boolean>(
			/**
			 * Captures the lookup settlement operation.
			 * @param resolve - Promise settlement operation.
			 */
			( resolve ) => {
				this.resolvePromise = resolve;
			},
		);
	}

	/**
	 * Resolves the pending permission lookup.
	 * @param granted - Whether navigation observation is granted.
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
 */
interface TestMessageSender {
	/** Sending frame identifier when the message came from a tab. */
	frameId?: number | undefined;
	/** Sending tab fixture. */
	tab?: { id?: number | undefined } | undefined;
	/** URL of the page or frame hosting the sending script. */
	url?: string | undefined;
}

/**
 * Browser permission-change fixture.
 */
interface TestPermissionChange {
	/** Changed named permissions. */
	permissions?: ReadonlyArray<string> | undefined;
	/** Changed origin permissions. */
	origins?: ReadonlyArray<string> | undefined;
}

/**
 * Fully spied runtime returned to controller tests.
 */
interface RuntimeHarness {
	/** Runtime contract supplied to the controller. */
	runtime: BrowserProtectionRuntime;
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
}

/**
 * Creates a fully spied protection runtime.
 * @return Browser protection runtime test double and operation spies.
 */
function createRuntime(): RuntimeHarness {
	const start = vi.fn().mockResolvedValue( undefined );
	const handleNavigation = vi.fn().mockResolvedValue( undefined );
	const handlePageRequest = vi.fn().mockResolvedValue( { state: 'unavailable' } );
	const handleTabRemoved = vi.fn().mockResolvedValue( undefined );
	const handleFocusChanged = vi.fn().mockResolvedValue( undefined );
	const handleClockTick = vi.fn().mockResolvedValue( undefined );
	const handleConfigurationChanged = vi.fn().mockResolvedValue( undefined );
	const failOpen = vi.fn().mockResolvedValue( undefined );
	const runtime: BrowserProtectionRuntime = {
		start,
		handleNavigation,
		handlePageRequest,
		handleTabRemoved,
		handleFocusChanged,
		handleClockTick,
		handleConfigurationChanged,
		failOpen,
	};

	return {
		runtime,
		start,
		handleNavigation,
		handlePageRequest,
		handleTabRemoved,
		handleFocusChanged,
		handleClockTick,
		handleConfigurationChanged,
		failOpen,
	};
}

/**
 * Creates one controller with independently observable browser-event surfaces.
 * @param includeWebNavigation - Whether optional navigation observation is initially available.
 * @param hasNavigationPermission - Whether startup permission inspection succeeds.
 * @return Controller, runtime, events, and alarm creation spy.
 */
function createHarness( includeWebNavigation = true, hasNavigationPermission = includeWebNavigation ) {
	const runtimeHarness = createRuntime();
	const alarm = new TestEvent<[ { name: string } ], void>();
	const message = new TestEvent<
		[ unknown, TestMessageSender, ProtectionBackgroundSendResponse ],
		true | undefined
	>();
	const navigation = new TestEvent<[ ProtectionRuntimeNavigation ], unknown>();
	const committedNavigation = new TestEvent<[ ProtectionRuntimeNavigation ], unknown>();
	const historyNavigation = new TestEvent<[ ProtectionRuntimeNavigation ], unknown>();
	const referenceNavigation = new TestEvent<[ ProtectionRuntimeNavigation ], unknown>();
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
					onHistoryStateUpdated: historyNavigation,
					onReferenceFragmentUpdated: referenceNavigation,
				},
			}
			: {} ),
	};
	const controller = createProtectionBackgroundController( {
		browser,
		interruptionPageUrl: INTERRUPTION_PAGE_URL,
		runtime: runtimeHarness.runtime,
	} );

	return {
		alarm,
		browser,
		controller,
		containsPermission,
		committedNavigation,
		createAlarm,
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

describe( 'createProtectionBackgroundController', () => {
	it( 'registers listeners synchronously before starting restoration', async () => {
		const harness = createHarness();

		harness.controller.start();

		expect( harness.alarm.hasListener() ).toBe( true );
		expect( harness.message.hasListener() ).toBe( true );
		expect( harness.navigation.hasListener() ).toBe( true );
		expect( harness.committedNavigation.hasListener() ).toBe( true );
		expect( harness.historyNavigation.hasListener() ).toBe( true );
		expect( harness.referenceNavigation.hasListener() ).toBe( true );
		expect( harness.permissionAddition.hasListener() ).toBe( true );
		expect( harness.permissionRemoval.hasListener() ).toBe( true );
		expect( harness.storageChange.hasListener() ).toBe( true );
		expect( harness.tabActivation.hasListener() ).toBe( true );
		expect( harness.tabRemoval.hasListener() ).toBe( true );
		expect( harness.windowFocus.hasListener() ).toBe( true );
		await vi.waitFor( () => {
			expect( harness.start ).toHaveBeenCalledOnce();
		} );
		expect( harness.createAlarm ).toHaveBeenCalledWith( ProtectionBackgroundAlarmName.RECONCILIATION, {
			periodInMinutes: 1,
		} );
	} );

	it( 'registers optional navigation observation after permission is granted', async () => {
		const harness = createHarness( false );

		expect( () => {
			harness.controller.start();
		} ).not.toThrow();
		expect( harness.navigation.hasListener() ).toBe( false );
		await vi.waitFor( () => {
			expect( harness.failOpen ).toHaveBeenCalledOnce();
		} );
		harness.failOpen.mockClear();
		harness.start.mockClear();

		harness.browser.webNavigation = {
			onBeforeNavigate: harness.navigation,
			onCommitted: harness.committedNavigation,
		};
		harness.permissionAddition.emit( { permissions: [ 'webNavigation' ] } );
		expect( harness.navigation.hasListener() ).toBe( true );
		expect( harness.committedNavigation.hasListener() ).toBe( true );
		await vi.waitFor( () => {
			expect( harness.start ).toHaveBeenCalledOnce();
		} );

		harness.permissionRemoval.emit( { permissions: [ 'webNavigation' ] } );
		expect( harness.navigation.hasListener() ).toBe( false );
		expect( harness.committedNavigation.hasListener() ).toBe( false );
		await vi.waitFor( () => {
			expect( harness.failOpen ).toHaveBeenCalledOnce();
		} );
	} );

	it( 'handles navigation permission removal when no listener was registered', async () => {
		const harness = createHarness( false );

		harness.controller.start();
		harness.permissionRemoval.emit( { permissions: [ 'webNavigation' ] } );

		await vi.waitFor( () => {
			expect( harness.failOpen ).toHaveBeenCalledTimes( 2 );
		} );
		expect( harness.navigation.hasListener() ).toBe( false );
	} );

	it( 'fails open on cold startup when navigation observation is not granted', async () => {
		const harness = createHarness( true, false );

		harness.controller.start();
		await vi.waitFor( () => {
			expect( harness.failOpen ).toHaveBeenCalledOnce();
		} );

		expect( harness.containsPermission ).toHaveBeenCalledWith( {
			permissions: [ 'webNavigation' ],
		} );
		expect( harness.start ).not.toHaveBeenCalled();
	} );

	it( 'waits for cold-start permission restoration before routing navigation', async () => {
		const harness = createHarness();
		const permissionResult = new DeferredPermissionResult();

		harness.containsPermission.mockReturnValue( permissionResult.promise );
		harness.controller.start();
		harness.navigation.emit( { frameId: 0, tabId: 7, url: 'https://example.com/' } );
		expect( harness.handleNavigation ).not.toHaveBeenCalled();

		permissionResult.resolve( true );
		await vi.waitFor( () => {
			expect( harness.handleNavigation ).toHaveBeenCalledOnce();
		} );
		expect( harness.start.mock.invocationCallOrder[ 0 ] ).toBeLessThan(
			harness.handleNavigation.mock.invocationCallOrder[ 0 ] ?? Number.POSITIVE_INFINITY,
		);
	} );

	it( 'applies a permission grant after an older denied startup lookup', async () => {
		const harness = createHarness( false );
		const permissionResult = new DeferredPermissionResult();

		harness.containsPermission.mockReturnValue( permissionResult.promise );
		harness.controller.start();
		harness.browser.webNavigation = {
			onBeforeNavigate: harness.navigation,
			onCommitted: harness.committedNavigation,
		};
		harness.permissionAddition.emit( { permissions: [ 'webNavigation' ] } );
		permissionResult.resolve( false );

		await vi.waitFor( () => {
			expect( harness.failOpen ).toHaveBeenCalledOnce();
			expect( harness.start ).toHaveBeenCalledOnce();
		} );
		expect( harness.failOpen.mock.invocationCallOrder[ 0 ] ).toBeLessThan(
			harness.start.mock.invocationCallOrder[ 0 ] ?? Number.POSITIVE_INFINITY,
		);
	} );

	it( 'applies a permission revocation after an older granted startup lookup', async () => {
		const harness = createHarness();
		const permissionResult = new DeferredPermissionResult();

		harness.containsPermission.mockReturnValue( permissionResult.promise );
		harness.controller.start();
		harness.permissionRemoval.emit( { permissions: [ 'webNavigation' ] } );
		permissionResult.resolve( true );

		await vi.waitFor( () => {
			expect( harness.start ).toHaveBeenCalledOnce();
			expect( harness.failOpen ).toHaveBeenCalledOnce();
		} );
		expect( harness.start.mock.invocationCallOrder[ 0 ] ).toBeLessThan(
			harness.failOpen.mock.invocationCallOrder[ 0 ] ?? Number.POSITIVE_INFINITY,
		);
		expect( harness.navigation.hasListener() ).toBe( false );
	} );

	it( 'keeps runtime protection available when periodic alarm creation fails', async () => {
		const harness = createHarness();

		harness.createAlarm.mockRejectedValue( new Error( 'Alarm unavailable.' ) );
		harness.controller.start();
		await Promise.resolve();
		await Promise.resolve();

		expect( harness.start ).toHaveBeenCalledOnce();
		expect( harness.failOpen ).not.toHaveBeenCalled();
	} );

	it( 'routes only top-level navigation through a synchronous event listener', async () => {
		const harness = createHarness();
		const navigation = { frameId: 0, tabId: 7, url: 'https://example.com/' };

		harness.controller.start();

		const topLevelResult = harness.navigation.emit( navigation );
		const subframeResult = harness.navigation.emit( { ...navigation, frameId: 2 } );

		expect( topLevelResult ).toBeUndefined();
		expect( subframeResult ).toBeUndefined();
		await vi.waitFor( () => {
			expect( harness.handleNavigation ).toHaveBeenCalledOnce();
		} );
		expect( harness.handleNavigation ).toHaveBeenCalledWith( navigation );
	} );

	it( 'routes a committed top-level document so page-local allowance effects can be synchronized', async () => {
		const harness = createHarness();
		const navigation = { frameId: 0, tabId: 7, url: 'https://example.com/committed' };

		harness.controller.start();
		harness.committedNavigation.emit( navigation );
		harness.committedNavigation.emit( { ...navigation, frameId: 2 } );

		await vi.waitFor( () => {
			expect( harness.handleNavigation ).toHaveBeenCalledOnce();
		} );
		expect( harness.handleNavigation ).toHaveBeenCalledWith( navigation );
	} );

	it( 'routes supported top-level same-document navigation without observing subframes', async () => {
		const harness = createHarness();
		const historyNavigation = { frameId: 0, tabId: 7, url: 'https://example.com/feed' };
		const referenceNavigation = { frameId: 0, tabId: 7, url: 'https://example.com/feed#latest' };

		harness.controller.start();
		harness.historyNavigation.emit( historyNavigation );
		harness.referenceNavigation.emit( referenceNavigation );
		harness.historyNavigation.emit( { ...historyNavigation, frameId: 3 } );
		harness.referenceNavigation.emit( { ...referenceNavigation, frameId: 4 } );

		await vi.waitFor( () => {
			expect( harness.handleNavigation ).toHaveBeenCalledTimes( 2 );
		} );
		expect( harness.handleNavigation ).toHaveBeenNthCalledWith( 1, historyNavigation );
		expect( harness.handleNavigation ).toHaveBeenNthCalledWith( 2, referenceNavigation );
	} );

	it.each( [
		[ 'Chrome', 'chrome-extension://extension-id/interruption.html' ],
		[ 'Firefox', 'moz-extension://runtime-uuid/interruption.html' ],
		[ 'Safari', 'safari-web-extension://extension-id/interruption.html' ],
	] )( 'claims the exact top-level %s interruption page URL', async ( _browser, interruptionPageUrl ) => {
		const harness = createHarness();
		const response: InterruptionPageResponse = { state: 'unavailable' };
		const sendResponse = vi.fn();
		const controller = createProtectionBackgroundController( {
			browser: harness.browser,
			interruptionPageUrl,
			runtime: harness.runtime,
		} );

		harness.handlePageRequest.mockResolvedValue( response );
		controller.start();

		expect( harness.message.emit( {
			type: 'connect',
			documentVisible: true,
		}, {
			frameId: 0,
			tab: { id: 7 },
			url: interruptionPageUrl,
		}, sendResponse ) ).toBe( true );
		await vi.waitFor( () => {
			expect( sendResponse ).toHaveBeenCalledWith( response );
		} );
		expect( harness.handlePageRequest ).toHaveBeenCalledWith( {
			type: 'connect',
			documentVisible: true,
		}, 7 );
	} );

	it( 'restarts the permitted runtime before routing explicit recovery', async () => {
		const harness = createHarness();
		const response: InterruptionPageResponse = { state: 'unavailable' };
		const sendResponse = vi.fn();

		harness.handlePageRequest.mockResolvedValue( response );
		harness.controller.start();
		await vi.waitFor( () => {
			expect( harness.start ).toHaveBeenCalledOnce();
		} );
		harness.start.mockClear();
		harness.containsPermission.mockClear();

		expect( harness.message.emit( {
			type: InterruptionPageRequestType.RECOVER,
			documentVisible: true,
		}, {
			frameId: 0,
			tab: { id: 7 },
			url: INTERRUPTION_PAGE_URL,
		}, sendResponse ) ).toBe( true );
		await vi.waitFor( () => {
			expect( sendResponse ).toHaveBeenCalledWith( response );
		} );

		expect( harness.containsPermission ).toHaveBeenCalledWith( {
			permissions: [ 'webNavigation' ],
		} );
		expect( harness.start ).toHaveBeenCalledOnce();
		expect( harness.start.mock.invocationCallOrder[ 0 ] ).toBeLessThan(
			harness.handlePageRequest.mock.invocationCallOrder[ 0 ] ?? Number.POSITIVE_INFINITY,
		);
		expect( harness.handlePageRequest ).toHaveBeenCalledWith( {
			type: InterruptionPageRequestType.RECOVER,
			documentVisible: true,
		}, 7 );
	} );

	it( 'applies a permission removal after an older recovery lookup', async () => {
		const harness = createHarness();
		const permissionResult = new DeferredPermissionResult();
		const sendResponse = vi.fn();

		harness.controller.start();
		await vi.waitFor( () => {
			expect( harness.start ).toHaveBeenCalledOnce();
		} );
		harness.start.mockClear();
		harness.failOpen.mockClear();
		harness.containsPermission.mockReturnValue( permissionResult.promise );

		expect( harness.message.emit( {
			type: InterruptionPageRequestType.RECOVER,
			documentVisible: true,
		}, {
			frameId: 0,
			tab: { id: 7 },
			url: INTERRUPTION_PAGE_URL,
		}, sendResponse ) ).toBe( true );
		harness.permissionRemoval.emit( { permissions: [ 'webNavigation' ] } );
		permissionResult.resolve( true );

		await vi.waitFor( () => {
			expect( harness.start ).toHaveBeenCalledOnce();
			expect( harness.failOpen ).toHaveBeenCalledOnce();
		} );
		expect( harness.start.mock.invocationCallOrder[ 0 ] ).toBeLessThan(
			harness.failOpen.mock.invocationCallOrder[ 0 ] ?? Number.POSITIVE_INFINITY,
		);
	} );

	it( 'routes a protected page local expiry guard through authoritative clock reconciliation', async () => {
		const harness = createHarness();
		const sendResponse = vi.fn();

		harness.controller.start();

		expect( harness.message.emit( {
			type: ProtectionClockRequestType.RECONCILE_ALLOWANCE_EXPIRY,
			allowanceId: 'allowance_a',
		}, {
			frameId: 0,
			tab: { id: 7 },
			url: 'https://example.com/watch',
		}, sendResponse ) ).toBeUndefined();
		expect( sendResponse ).toHaveBeenCalledWith();
		await vi.waitFor( () => {
			expect( harness.handleClockTick ).toHaveBeenCalledOnce();
		} );
		expect( harness.handlePageRequest ).not.toHaveBeenCalled();
	} );

	it.each( [
		[ 'the extension interruption page', {
			frameId: 0,
			tab: { id: 7 },
			url: INTERRUPTION_PAGE_URL,
		} ],
		[ 'a protected-page iframe', {
			frameId: 2,
			tab: { id: 7 },
			url: 'https://example.com/embedded',
		} ],
		[ 'an HTTP page without a content-script tab', {
			frameId: 0,
			url: 'https://example.com/watch',
		} ],
	] )( 'rejects local expiry reconciliation from %s', ( _label, sender ) => {
		const harness = createHarness();
		const sendResponse = vi.fn();

		harness.controller.start();

		expect( harness.message.emit( {
			type: ProtectionClockRequestType.RECONCILE_ALLOWANCE_EXPIRY,
			allowanceId: 'allowance_a',
		}, sender, sendResponse ) ).toBeUndefined();
		expect( sendResponse ).not.toHaveBeenCalled();
		expect( harness.handleClockTick ).not.toHaveBeenCalled();
	} );

	it.each( [
		'http://example.com/path',
		'https://example.com/path',
	] )( 'claims the packaged top-level protected-page controller at %s', async ( senderUrl ) => {
		const harness = createHarness();
		const response: InterruptionPageResponse = { state: 'unavailable' };
		const sendResponse = vi.fn();

		harness.handlePageRequest.mockResolvedValue( response );
		harness.controller.start();

		expect( harness.message.emit( {
			type: 'connect',
			documentVisible: true,
		}, {
			frameId: 0,
			tab: { id: 7 },
			url: senderUrl,
		}, sendResponse ) ).toBe( true );
		await vi.waitFor( () => {
			expect( sendResponse ).toHaveBeenCalledWith( response );
		} );
		expect( harness.handlePageRequest ).toHaveBeenCalledOnce();
		expect( harness.handlePageRequest ).toHaveBeenCalledWith( {
			type: 'connect',
			documentVisible: true,
		}, 7 );
	} );

	it.each( [
		[ 'a missing frame identifier', {
			tab: { id: 7 },
			url: INTERRUPTION_PAGE_URL,
		} ],
		[ 'an interruption-page iframe', {
			frameId: 1,
			tab: { id: 7 },
			url: INTERRUPTION_PAGE_URL,
		} ],
		[ 'a protected-page iframe', {
			frameId: 2,
			tab: { id: 7 },
			url: 'https://example.com/embedded',
		} ],
		[ 'a missing sender URL', {
			frameId: 0,
			tab: { id: 7 },
		} ],
		[ 'another extension page', {
			frameId: 0,
			tab: { id: 7 },
			url: 'chrome-extension://extension-id/options.html',
		} ],
		[ 'another extension origin with the same page path', {
			frameId: 0,
			tab: { id: 7 },
			url: 'chrome-extension://another-extension/interruption.html',
		} ],
		[ 'an HTTP sender without a content-script tab', {
			frameId: 0,
			url: 'https://example.com/',
		} ],
		[ 'a file document', {
			frameId: 0,
			tab: { id: 7 },
			url: 'file:///tmp/interruption.html',
		} ],
		[ 'an opaque document', {
			frameId: 0,
			tab: { id: 7 },
			url: 'about:blank',
		} ],
		[ 'an unsupported network scheme', {
			frameId: 0,
			tab: { id: 7 },
			url: 'ftp://example.com/interruption.html',
		} ],
		[ 'a malformed URL', {
			frameId: 0,
			tab: { id: 7 },
			url: 'not a URL',
		} ],
	] )( 'rejects interruption requests from %s', ( _label, sender ) => {
		const harness = createHarness();
		const sendResponse = vi.fn();

		harness.controller.start();

		expect( harness.message.emit( {
			type: 'connect',
			documentVisible: true,
		}, sender, sendResponse ) ).toBeUndefined();
		expect( harness.handlePageRequest ).not.toHaveBeenCalled();
		expect( sendResponse ).not.toHaveBeenCalled();
	} );

	it( 'ignores unrelated messages from an authenticated interruption page', () => {
		const harness = createHarness();
		const sendResponse = vi.fn();

		harness.controller.start();

		expect( harness.message.emit( { unrelated: true }, {
			frameId: 0,
			tab: { id: 7 },
			url: INTERRUPTION_PAGE_URL,
		}, sendResponse ) ).toBeUndefined();
		expect( harness.handlePageRequest ).not.toHaveBeenCalled();
	} );

	it( 'returns unavailable and fails open when a claimed message rejects', async () => {
		const harness = createHarness();
		const sendResponse = vi.fn();

		harness.handlePageRequest.mockRejectedValue( new Error( 'Runtime unavailable.' ) );
		harness.controller.start();
		expect( harness.message.emit( {
			type: 'synchronize',
			documentVisible: true,
		}, {
			frameId: 0,
			tab: {},
			url: INTERRUPTION_PAGE_URL,
		}, sendResponse ) ).toBe( true );

		await vi.waitFor( () => {
			expect( harness.handlePageRequest ).toHaveBeenCalledWith( {
				type: 'synchronize',
				documentVisible: true,
			}, null );
			expect( sendResponse ).toHaveBeenCalledWith( { state: 'unavailable' } );
			expect( harness.failOpen ).toHaveBeenCalledOnce();
		} );
	} );

	it( 'routes tab lifecycle and tab or window focus events synchronously', async () => {
		const harness = createHarness();

		harness.controller.start();

		const removalResult = harness.tabRemoval.emit( 9, {} );
		const activationResult = harness.tabActivation.emit( {} );
		const focusResult = harness.windowFocus.emit( 3 );

		expect( removalResult ).toBeUndefined();
		expect( activationResult ).toBeUndefined();
		expect( focusResult ).toBeUndefined();
		await vi.waitFor( () => {
			expect( harness.handleTabRemoved ).toHaveBeenCalledWith( 9 );
			expect( harness.handleFocusChanged ).toHaveBeenCalledTimes( 2 );
		} );
	} );

	it( 'reconciles origin changes and recovers after navigation access changes', async () => {
		const harness = createHarness();
		const configurationChange = { 'tocus.protection.configuration.v1': { newValue: {} } };

		harness.controller.start();

		harness.storageChange.emit( configurationChange, 'local' );
		harness.storageChange.emit( configurationChange, 'sync' );
		harness.storageChange.emit( { unrelated: { newValue: true } }, 'local' );
		harness.permissionRemoval.emit( { permissions: [ 'notifications' ] } );
		harness.permissionRemoval.emit( { permissions: [ 'webNavigation' ] } );
		harness.permissionRemoval.emit( { origins: [ '*://example.com/*' ] } );
		harness.permissionAddition.emit( { permissions: [ 'notifications' ] } );
		harness.permissionAddition.emit( { origins: [ '*://example.com/*' ] } );
		harness.permissionAddition.emit( { permissions: [ 'webNavigation' ] } );
		await vi.waitFor( () => {
			expect( harness.start ).toHaveBeenCalledTimes( 2 );
		} );
		expect( harness.handleConfigurationChanged ).toHaveBeenCalledTimes( 3 );
		expect( harness.failOpen ).toHaveBeenCalledOnce();
	} );

	it( 'stays fail open when storage changes after navigation access is revoked', async () => {
		const harness = createHarness();
		const configurationChange = { 'tocus.protection.configuration.v1': { newValue: {} } };

		harness.controller.start();
		await vi.waitFor( () => {
			expect( harness.start ).toHaveBeenCalledOnce();
		} );
		harness.containsPermission.mockResolvedValue( false );
		harness.permissionRemoval.emit( { permissions: [ 'webNavigation' ] } );
		harness.storageChange.emit( configurationChange, 'local' );

		await vi.waitFor( () => {
			expect( harness.failOpen ).toHaveBeenCalledTimes( 2 );
		} );
		expect( harness.handleConfigurationChanged ).not.toHaveBeenCalled();
		expect( harness.start ).toHaveBeenCalledOnce();
	} );

	it( 'routes only protection-owned alarms', async () => {
		const harness = createHarness();

		harness.controller.start();

		harness.alarm.emit( { name: ProtectionBackgroundAlarmName.RECONCILIATION } );
		harness.alarm.emit( { name: 'tocus.protection.clock.1788368400000' } );
		harness.alarm.emit( { name: 'tocus.protection.clock.not-a-deadline' } );
		harness.alarm.emit( { name: 'tocus.protection.clockish.1788368400000' } );
		harness.alarm.emit( { name: 'another-extension-alarm' } );
		await vi.waitFor( () => {
			expect( harness.handleClockTick ).toHaveBeenCalledTimes( 2 );
		} );
	} );

	it( 'attempts fail-open cleanup after an event operation rejects', async () => {
		const harness = createHarness();

		harness.handleClockTick.mockRejectedValue( new Error( 'Clock reconciliation failed.' ) );
		harness.controller.start();
		harness.alarm.emit( { name: ProtectionBackgroundAlarmName.RECONCILIATION } );

		await vi.waitFor( () => {
			expect( harness.failOpen ).toHaveBeenCalledOnce();
		} );
	} );

	it( 'contains a rejected fail-open cleanup without creating an unhandled rejection', async () => {
		const harness = createHarness();

		harness.start.mockRejectedValue( new Error( 'Startup failed.' ) );
		harness.failOpen.mockRejectedValue( new Error( 'Cleanup failed.' ) );
		harness.controller.start();

		await vi.waitFor( () => {
			expect( harness.failOpen ).toHaveBeenCalledOnce();
		} );
	} );
} );
