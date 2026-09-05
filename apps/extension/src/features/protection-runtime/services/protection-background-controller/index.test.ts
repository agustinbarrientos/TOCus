import { describe, expect, it, vi } from 'vitest';
import {
	InterruptionPageRequestType,
	ProtectionClockRequestType,
	type InterruptionPageResponse,
} from '../../types/runtime-message';
import { ProtectionBackgroundAlarmName, createProtectionBackgroundController } from './index';
import { StatisticsFocusObservationMode } from '../../../../domains/statistics/utils/prepare-statistics-checkpoint';
import { ProtectionConfigurationStorageKey } from '../../../../domains/protection/services/protection-configuration-storage';
import {
	DeferredPermissionResult,
	INTERRUPTION_PAGE_URL,
	createHarness,
} from './__fixtures__';

describe( 'createProtectionBackgroundController', () => {
	it( 'refreshes configuration through the navigation-capability gate', async () => {
		const harness = createHarness();
		harness.controller.start();
		await vi.waitFor( () => {
			expect( harness.start ).toHaveBeenCalledOnce();
		} );
		harness.containsPermission.mockClear();

		await harness.controller.refresh();

		expect( harness.containsPermission ).toHaveBeenCalledWith( { permissions: [ 'webNavigation' ] } );
		expect( harness.handleConfigurationChanged ).toHaveBeenCalledOnce();
	} );

	it( 'fails open instead of refreshing when navigation access is unavailable', async () => {
		const harness = createHarness( true, false );
		harness.controller.start();
		await vi.waitFor( () => {
			expect( harness.failOpen ).toHaveBeenCalledOnce();
		} );
		harness.failOpen.mockClear();

		await harness.controller.refresh();

		expect( harness.handleConfigurationChanged ).not.toHaveBeenCalled();
		expect( harness.failOpen ).toHaveBeenCalledOnce();
	} );

	it( 'fails open and rejects when explicit reconciliation fails', async () => {
		const harness = createHarness();
		const failure = new Error( 'Reconciliation failed.' );

		harness.controller.start();
		await harness.controller.waitUntilReady();
		harness.failOpen.mockClear();
		harness.handleConfigurationChanged.mockRejectedValue( failure );

		await expect( harness.controller.refresh() ).rejects.toBe( failure );
		expect( harness.failOpen ).toHaveBeenCalledOnce();
		expect( harness.failOpen ).toHaveBeenCalledWith(
			harness.capturedStatisticsObservations.at( -1 ),
		);
	} );

	it( 'exposes cold-start readiness through the capability barrier', async () => {
		const harness = createHarness();
		const permissionResult = new DeferredPermissionResult();
		let ready = false;

		harness.containsPermission.mockReturnValue( permissionResult.promise );
		harness.controller.start();
		void harness.controller.waitUntilReady().then( () => {
			ready = true;
		} );
		await Promise.resolve();

		expect( ready ).toBe( false );
		expect( harness.start ).not.toHaveBeenCalled();

		permissionResult.resolve( true );
		await harness.controller.waitUntilReady();

		expect( ready ).toBe( true );
		expect( harness.start ).toHaveBeenCalledOnce();
	} );

	it( 'registers listeners synchronously before starting restoration', async () => {
		const harness = createHarness();

		harness.controller.start();

		expect( harness.alarm.hasListener() ).toBe( true );
		expect( harness.message.hasListener() ).toBe( true );
		expect( harness.navigation.hasListener() ).toBe( true );
		expect( harness.committedNavigation.hasListener() ).toBe( true );
		expect( harness.errorNavigation.hasListener() ).toBe( true );
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
		expect( harness.captureStatisticsObservation ).toHaveBeenCalledWith(
			StatisticsFocusObservationMode.STARTUP,
		);
	} );

	it( 'captures every potentially state-changing browser event as a statistics boundary', async () => {
		const harness = createHarness();
		const navigation = { frameId: 0, tabId: 7, url: 'https://example.com/' };

		harness.controller.start();
		await vi.waitFor( () => {
			expect( harness.start ).toHaveBeenCalledOnce();
		} );
		harness.captureStatisticsObservation.mockClear();
		harness.navigation.emit( navigation );
		harness.message.emit( {
			type: ProtectionClockRequestType.RECONCILE_ALLOWANCE_EXPIRY,
			allowanceId: 'allowance_a',
		}, {
			frameId: 0,
			tab: { id: 7, incognito: false },
			url: 'https://example.com/',
		}, vi.fn() );
		harness.message.emit( {
			type: InterruptionPageRequestType.CONNECT,
			documentVisible: true,
		}, {
			frameId: 0,
			tab: { id: 7, incognito: false },
			url: INTERRUPTION_PAGE_URL,
		}, vi.fn() );
		harness.tabRemoval.emit( 7, {} );
		harness.tabActivation.emit( {} );
		harness.windowFocus.emit( 1 );
		harness.storageChange.emit( {
			[ ProtectionConfigurationStorageKey.CONFIGURATION ]: { newValue: {} },
		}, 'local' );
		harness.permissionRemoval.emit( { origins: [ '*://example.com/*' ] } );
		harness.permissionAddition.emit( { origins: [ '*://example.com/*' ] } );
		harness.alarm.emit( { name: ProtectionBackgroundAlarmName.RECONCILIATION } );

		expect( harness.captureStatisticsObservation.mock.calls ).toEqual( [
			[ StatisticsFocusObservationMode.BOUNDARY, {
				...navigation,
				phase: 'before-navigate',
			} ],
			[ StatisticsFocusObservationMode.BOUNDARY ],
			[ StatisticsFocusObservationMode.BOUNDARY ],
			[ StatisticsFocusObservationMode.BOUNDARY ],
			[ StatisticsFocusObservationMode.BOUNDARY, undefined, null ],
			[ StatisticsFocusObservationMode.BOUNDARY, undefined, { windowId: 1 } ],
			[ StatisticsFocusObservationMode.BOUNDARY ],
			[ StatisticsFocusObservationMode.BOUNDARY ],
			[ StatisticsFocusObservationMode.BOUNDARY ],
			[ StatisticsFocusObservationMode.BOUNDARY ],
		] );
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
		expect( harness.captureStatisticsObservation ).toHaveBeenCalledTimes( 2 );

		permissionResult.resolve( true );
		await vi.waitFor( () => {
			expect( harness.handleNavigation ).toHaveBeenCalledOnce();
		} );
		expect( harness.start.mock.invocationCallOrder[ 0 ] ).toBeLessThan(
			harness.handleNavigation.mock.invocationCallOrder[ 0 ] ?? Number.POSITIVE_INFINITY,
		);
		expect( harness.start ).toHaveBeenCalledWith(
			harness.capturedStatisticsObservations[ 0 ],
		);
		expect( harness.handleNavigation ).toHaveBeenCalledWith(
			{
				frameId: 0,
				phase: 'before-navigate',
				tabId: 7,
				url: 'https://example.com/',
			},
			harness.capturedStatisticsObservations[ 1 ],
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
		expect( harness.handleNavigation ).toHaveBeenCalledWith( {
			...navigation,
			phase: 'before-navigate',
		}, expect.any( Promise ) );
	} );

	it( 'routes a committed top-level document so page-local allowance effects can be synchronized', async () => {
		const harness = createHarness();
		const navigation = {
			frameId: 0,
			tabId: 7,
			transitionQualifiers: [ 'server_redirect' ],
			transitionType: 'link',
			url: 'https://example.com/committed',
		};

		harness.controller.start();
		harness.committedNavigation.emit( navigation );
		harness.committedNavigation.emit( { ...navigation, frameId: 2 } );

		await vi.waitFor( () => {
			expect( harness.handleNavigation ).toHaveBeenCalledOnce();
		} );
		expect( harness.handleNavigation ).toHaveBeenCalledWith( {
			...navigation,
			phase: 'committed',
		}, expect.any( Promise ) );
	} );

	it( 'routes a top-level browser error as a terminal navigation outcome', async () => {
		const harness = createHarness();
		const navigation = {
			frameId: 0,
			tabId: 7,
			url: 'https://example.com/unavailable',
		};

		harness.controller.start();
		harness.errorNavigation.emit( navigation );
		harness.errorNavigation.emit( { ...navigation, frameId: 2 } );

		await vi.waitFor( () => {
			expect( harness.handleNavigation ).toHaveBeenCalledOnce();
		} );
		expect( harness.handleNavigation ).toHaveBeenCalledWith( {
			...navigation,
			phase: 'error-occurred',
		}, expect.any( Promise ) );
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
		expect( harness.handleNavigation ).toHaveBeenNthCalledWith(
			1,
			{
				...historyNavigation,
				phase: 'history-state-updated',
			},
			expect.any( Promise ),
		);
		expect( harness.handleNavigation ).toHaveBeenNthCalledWith(
			2,
			{
				...referenceNavigation,
				phase: 'reference-fragment-updated',
			},
			expect.any( Promise ),
		);
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
			optionsPageUrl: interruptionPageUrl.replace( 'interruption.html', 'options.html' ),
			runtime: harness.runtime,
		} );

		harness.handlePageRequest.mockResolvedValue( response );
		controller.start();

		expect( harness.message.emit( {
			type: 'connect',
			documentVisible: true,
		}, {
			frameId: 0,
			tab: { id: 7, incognito: false },
			url: interruptionPageUrl,
		}, sendResponse ) ).toBe( true );
		await vi.waitFor( () => {
			expect( sendResponse ).toHaveBeenCalledWith( response );
		} );
		expect( harness.handlePageRequest ).toHaveBeenCalledWith( {
			type: 'connect',
			documentVisible: true,
		}, 7, true, expect.any( Promise ) );
	} );

	it.each( [
		[ 'private', true ],
		[ 'unknown-privacy', undefined ],
	] )( 'marks an authenticated %s page ineligible for protection', async (
		_label,
		incognito,
	) => {
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
			tab: {
				id: 7,
				...( incognito === undefined ? {} : { incognito } ),
			},
			url: INTERRUPTION_PAGE_URL,
		}, sendResponse ) ).toBe( true );
		await vi.waitFor( () => {
			expect( sendResponse ).toHaveBeenCalledWith( response );
		} );
		expect( harness.handlePageRequest ).toHaveBeenCalledWith( {
			type: 'connect',
			documentVisible: true,
		}, 7, false, expect.any( Promise ) );
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
			tab: { id: 7, incognito: false },
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
		}, 7, true, expect.any( Promise ) );
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
			tab: { id: 7, incognito: false },
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
		harness.captureStatisticsObservation.mockClear();

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
		expect( harness.captureStatisticsObservation ).toHaveBeenCalledWith(
			StatisticsFocusObservationMode.BOUNDARY,
		);
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
			tab: { id: 7, incognito: false },
			url: senderUrl,
		}, sendResponse ) ).toBe( true );
		await vi.waitFor( () => {
			expect( sendResponse ).toHaveBeenCalledWith( response );
		} );
		expect( harness.handlePageRequest ).toHaveBeenCalledOnce();
		expect( harness.handlePageRequest ).toHaveBeenCalledWith( {
			type: 'connect',
			documentVisible: true,
		}, 7, true, expect.any( Promise ) );
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
			}, null, false, expect.any( Promise ) );
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
			expect( harness.handleTabRemoved ).toHaveBeenCalledWith( 9, expect.any( Promise ) );
			expect( harness.handleFocusChanged ).toHaveBeenCalledTimes( 2 );
		} );
	} );

	it( 'carries exact tab and window identity into focus observations', () => {
		const harness = createHarness();

		harness.controller.start();
		harness.captureStatisticsObservation.mockClear();
		harness.tabActivation.emit( { tabId: 7, windowId: 3 } );
		harness.windowFocus.emit( 4 );

		expect( harness.captureStatisticsObservation.mock.calls ).toEqual( [
			[
				StatisticsFocusObservationMode.BOUNDARY,
				undefined,
				{ tabId: 7, windowId: 3 },
			],
			[
				StatisticsFocusObservationMode.BOUNDARY,
				undefined,
				{ windowId: 4 },
			],
		] );
	} );

	it( 'marks malformed tab and window focus identities as unavailable', () => {
		const harness = createHarness();

		harness.controller.start();
		harness.captureStatisticsObservation.mockClear();
		[
			null,
			7,
			{},
			{ tabId: '7', windowId: 3 },
			{ tabId: -1, windowId: 3 },
			{ tabId: 7 },
			{ tabId: 7, windowId: '3' },
			{ tabId: 7, windowId: -1 },
		].forEach( ( activation ) => harness.tabActivation.emit( activation ) );
		[ Number.NaN, -2 ].forEach( ( windowId ) => harness.windowFocus.emit( windowId ) );

		expect( harness.captureStatisticsObservation ).toHaveBeenCalledTimes( 10 );
		harness.captureStatisticsObservation.mock.calls.forEach( ( call ) => {
			expect( call ).toEqual( [ StatisticsFocusObservationMode.BOUNDARY, undefined, null ] );
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
		harness.captureStatisticsObservation.mockClear();

		harness.alarm.emit( { name: ProtectionBackgroundAlarmName.RECONCILIATION } );
		harness.alarm.emit( { name: 'tocus.protection.clock.1788368400000' } );
		harness.alarm.emit( { name: 'tocus.protection.clock.not-a-deadline' } );
		harness.alarm.emit( { name: 'tocus.protection.clockish.1788368400000' } );
		harness.alarm.emit( { name: 'another-extension-alarm' } );
		await vi.waitFor( () => {
			expect( harness.handleClockTick ).toHaveBeenCalledTimes( 2 );
		} );
		expect( harness.captureStatisticsObservation.mock.calls ).toEqual( [
			[ StatisticsFocusObservationMode.BOUNDARY ],
			[ StatisticsFocusObservationMode.BOUNDARY ],
		] );
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
