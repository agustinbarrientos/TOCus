import { describe, expect, it, vi } from 'vitest';
import { TestEmptyProtectionConfiguration } from '../../../../domains/protection/types/__fixtures__';
import { PopupProjectionStatus } from '../../types/popup-projection';
import { PopupRuntimeRequestType } from '../../types/runtime-message';
import { createPopupBackgroundController } from './index';
import {
	type PopupBackgroundMessageListener,
	type PopupBackgroundMessageSender,
	type PopupBackgroundSendResponse,
} from './types';

const POPUP_PAGE_URL = 'chrome-extension://extension-id/popup.html';
const INTERRUPTION_PAGE_URL = 'chrome-extension://extension-id/interruption.html';

/**
 * Returns the deterministic test time zone.
 * @return IANA time zone used by popup projections.
 * @since 0.1.0 Initial implementation.
 */
function getTestTimeZone(): string {
	return 'America/New_York';
}

/**
 * Returns the deterministic test wall-clock time.
 * @return Epoch milliseconds used by popup projections.
 * @since 0.1.0 Initial implementation.
 */
function getTestTime(): number {
	return 1_800_000_000_000;
}

/**
 * Creates one popup background-controller harness with an inspectable message listener.
 * @return Controller dependencies, runtime spies, and captured listener access.
 * @since 0.1.0 Initial implementation.
 */
function createHarness() {
	let listener: PopupBackgroundMessageListener | null = null;
	const addListener = vi.fn( ( candidate: PopupBackgroundMessageListener ) => {
		listener = candidate;
	} );
	const readSnapshot = vi.fn().mockResolvedValue( null );
	const refreshProtection = vi.fn().mockResolvedValue( undefined );
	const waitForProtectionReady = vi.fn().mockResolvedValue( undefined );
	const containsPermission = vi.fn().mockResolvedValue( true );
	const loadConfiguration = vi.fn().mockResolvedValue( TestEmptyProtectionConfiguration );
	const controller = createPopupBackgroundController( {
		browser: {
			permissions: { contains: containsPermission },
			runtime: { onMessage: { addListener } },
		},
		configurationStorage: { load: loadConfiguration },
		getTimeZone: getTestTimeZone,
		interruptionPageUrl: INTERRUPTION_PAGE_URL,
		now: getTestTime,
		popupPageUrl: POPUP_PAGE_URL,
		refreshProtection,
		runtime: { readSnapshot },
		waitForProtectionReady,
	} );

	return {
		addListener,
		containsPermission,
		controller,
		loadConfiguration,
		readSnapshot,
		refreshProtection,
		waitForProtectionReady,
		/**
		 * Returns the listener registered by the controller under test.
		 * @return Registered popup message listener.
		 * @since 0.1.0 Initial implementation.
		 */
		getListener(): PopupBackgroundMessageListener {
			if ( listener === null ) {
				throw new Error( 'Expected the controller to register its message listener.' );
			}

			return listener;
		},
	};
}

/**
 * Creates an authenticated popup-page sender without tab-only metadata.
 * @param overrides - Sender fields replaced for one test.
 * @return Browser message sender input.
 * @since 0.1.0 Initial implementation.
 */
function createSender(
	overrides: Partial<PopupBackgroundMessageSender> = {},
): PopupBackgroundMessageSender {
	return { url: POPUP_PAGE_URL, ...overrides };
}

describe( 'createPopupBackgroundController', () => {
	it( 'registers its local runtime listener synchronously', () => {
		const harness = createHarness();

		harness.controller.start();

		expect( harness.addListener ).toHaveBeenCalledOnce();
		expect( harness.getListener() ).toEqual( expect.any( Function ) );
	} );

	it.each( [
		createSender( { url: 'chrome-extension://extension-id/options.html' } ),
		createSender( { url: `${ POPUP_PAGE_URL }#unexpected` } ),
		{},
	] )( 'ignores popup requests from an unauthenticated sender', ( sender ) => {
		const harness = createHarness();
		const sendResponse = vi.fn<PopupBackgroundSendResponse>();
		harness.controller.start();

		expect( harness.getListener()( {
			type: PopupRuntimeRequestType.READ_STATUS,
			currentTab: null,
		}, sender, sendResponse ) ).toBeUndefined();
		expect( harness.readSnapshot ).not.toHaveBeenCalled();
		expect( sendResponse ).not.toHaveBeenCalled();
	} );

	it( 'ignores malformed popup messages from the authenticated page', () => {
		const harness = createHarness();
		const sendResponse = vi.fn<PopupBackgroundSendResponse>();
		harness.controller.start();

		expect( harness.getListener()( {
			type: PopupRuntimeRequestType.READ_STATUS,
			currentTab: { id: 7, url: 'https://example.com/' },
		}, createSender(), sendResponse ) ).toBeUndefined();
		expect( harness.readSnapshot ).not.toHaveBeenCalled();
	} );

	it( 'returns an unavailable projection when authoritative runtime state is unavailable', async () => {
		const harness = createHarness();
		const sendResponse = vi.fn<PopupBackgroundSendResponse>();
		harness.controller.start();

		expect( harness.getListener()( {
			type: PopupRuntimeRequestType.READ_STATUS,
			currentTab: null,
		}, createSender(), sendResponse ) ).toBe( true );
		await vi.waitFor( () => {
			expect( sendResponse ).toHaveBeenCalledWith( { status: PopupProjectionStatus.UNAVAILABLE } );
		} );
	} );

	it( 'waits for cold-start protection capability before reading initial status', async () => {
		const harness = createHarness();
		const readiness = Promise.withResolvers<undefined>();
		const sendResponse = vi.fn<PopupBackgroundSendResponse>();

		harness.waitForProtectionReady.mockReturnValue( readiness.promise );
		harness.readSnapshot.mockResolvedValue( {
			configuration: TestEmptyProtectionConfiguration,
			activeConfiguration: TestEmptyProtectionConfiguration,
			statesByScope: {},
			capturedAtEpochMilliseconds: 1_800_000_000_000,
			timeZone: 'America/New_York',
		} );
		harness.controller.start();
		harness.getListener()( {
			type: PopupRuntimeRequestType.READ_STATUS,
			currentTab: { id: 7, incognito: false, url: 'https://calm-place.test/path' },
		}, createSender(), sendResponse );
		await Promise.resolve();

		expect( harness.waitForProtectionReady ).toHaveBeenCalledOnce();
		expect( harness.readSnapshot ).not.toHaveBeenCalled();
		expect( sendResponse ).not.toHaveBeenCalled();

		readiness.resolve( undefined );
		await vi.waitFor( () => {
			expect( sendResponse ).toHaveBeenCalledWith( expect.objectContaining( {
				status: PopupProjectionStatus.AVAILABLE,
			} ) );
		} );
		expect( harness.readSnapshot ).toHaveBeenCalledOnce();
	} );

	it( 'projects an addable website before optional navigation access is granted', async () => {
		const harness = createHarness();
		const sendResponse = vi.fn<PopupBackgroundSendResponse>();
		harness.containsPermission.mockResolvedValue( false );
		harness.controller.start();

		harness.getListener()( {
			type: PopupRuntimeRequestType.READ_STATUS,
			currentTab: { id: 7, incognito: false, url: 'https://calm-place.test/path' },
		}, createSender(), sendResponse );

		await vi.waitFor( () => {
			expect( sendResponse ).toHaveBeenCalledOnce();
		} );
		expect( sendResponse.mock.calls[ 0 ]?.[ 0 ] ).toMatchObject( {
			status: PopupProjectionStatus.AVAILABLE,
			currentSite: {
				status: 'unprotected',
				identityHost: 'calm-place.test',
			},
		} );
		expect( harness.loadConfiguration ).toHaveBeenCalledOnce();
	} );

	it( 'returns unavailable when no-capability configuration cannot be validated', async () => {
		const harness = createHarness();
		const sendResponse = vi.fn<PopupBackgroundSendResponse>();

		harness.containsPermission.mockResolvedValue( false );
		harness.loadConfiguration.mockResolvedValue( null );
		harness.controller.start();
		harness.getListener()( {
			type: PopupRuntimeRequestType.READ_STATUS,
			currentTab: { id: 7, incognito: false, url: 'https://calm-place.test/' },
		}, createSender(), sendResponse );

		await vi.waitFor( () => {
			expect( sendResponse ).toHaveBeenCalledWith( { status: PopupProjectionStatus.UNAVAILABLE } );
		} );
	} );

	it( 'returns only a semantic projection for an ordinary active website', async () => {
		const harness = createHarness();
		const sendResponse = vi.fn<PopupBackgroundSendResponse>();
		harness.readSnapshot.mockResolvedValue( {
			configuration: TestEmptyProtectionConfiguration,
			activeConfiguration: TestEmptyProtectionConfiguration,
			statesByScope: {},
			capturedAtEpochMilliseconds: 1_800_000_000_000,
			timeZone: 'America/New_York',
		} );
		harness.controller.start();

		harness.getListener()( {
			type: PopupRuntimeRequestType.READ_STATUS,
			currentTab: { id: 7, incognito: false, url: 'https://calm-place.test/path' },
		}, createSender(), sendResponse );

		await vi.waitFor( () => {
			expect( sendResponse ).toHaveBeenCalledOnce();
		} );
		expect( sendResponse.mock.calls[ 0 ]?.[ 0 ] ).toMatchObject( {
			status: PopupProjectionStatus.AVAILABLE,
			currentSite: {
				status: 'unprotected',
				identityHost: 'calm-place.test',
			},
		} );
		const response = sendResponse.mock.calls[ 0 ]?.[ 0 ];
		expect( JSON.stringify( response ) ).not.toContain( '/path' );
	} );

	it( 'refreshes changed configuration before reading a new projection', async () => {
		const harness = createHarness();
		const sendResponse = vi.fn<PopupBackgroundSendResponse>();
		harness.controller.start();

		harness.getListener()( {
			type: PopupRuntimeRequestType.REFRESH_STATUS,
			currentTab: null,
		}, createSender(), sendResponse );

		await vi.waitFor( () => {
			expect( sendResponse ).toHaveBeenCalledOnce();
		} );
		expect( harness.refreshProtection ).toHaveBeenCalledOnce();
		expect( harness.readSnapshot ).toHaveBeenCalledOnce();
		expect( harness.refreshProtection.mock.invocationCallOrder[ 0 ] ).toBeLessThan(
			harness.readSnapshot.mock.invocationCallOrder[ 0 ] ?? Number.NEGATIVE_INFINITY,
		);
	} );

	it( 'returns an unavailable projection when projection work rejects', async () => {
		const harness = createHarness();
		const sendResponse = vi.fn<PopupBackgroundSendResponse>();
		harness.readSnapshot.mockRejectedValue( new Error( 'Runtime unavailable.' ) );
		harness.controller.start();

		harness.getListener()( {
			type: PopupRuntimeRequestType.READ_STATUS,
			currentTab: null,
		}, createSender(), sendResponse );

		await vi.waitFor( () => {
			expect( sendResponse ).toHaveBeenCalledWith( { status: PopupProjectionStatus.UNAVAILABLE } );
		} );
	} );
} );
