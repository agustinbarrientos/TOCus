import { afterEach, expect, it, vi, type MockInstance } from 'vitest';
import type { Browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createProtectionBackgroundController } from './index';
import { InterruptionPageRequestType, InterruptionPageResponseSchema,
	InterruptionPageResponseState } from '../../types/runtime-message';
import { ProtectionStateType } from '../../../../domains/protection/types/protection-state';
import { createRuntime, EXAMPLE_CONFIGURATION, MemoryConfigurationStorage,
	MemoryProtectionStorage, MemoryRuntimeBrowser, waitForQueuedWork } from '../browser-protection-runtime/__fixtures__';

afterEach( () => {
	vi.restoreAllMocks();
	fakeBrowser.reset();
} );

it.each( [ 'before', 'during' ] )( 'rejects a cold navigation carrier captured %s a later data reset', async ( arrival ) => {
	fakeBrowser.reset();
	const contains = vi.spyOn( fakeBrowser.permissions, 'contains' ) as MockInstance<
		( permissions: Browser.permissions.Permissions ) => Promise<boolean>>;
	contains.mockResolvedValue( true );
	vi.spyOn( fakeBrowser.permissions.onAdded, 'addListener' ).mockReturnValue( undefined );
	vi.spyOn( fakeBrowser.permissions.onRemoved, 'addListener' ).mockReturnValue( undefined );
	const browser = new MemoryRuntimeBrowser();
	const interruptionPageUrl = 'chrome-extension://extension-id/interruption.html';
	const carrierUrl = `${ interruptionPageUrl }#destination=https://example.com/old-visit`;
	browser.tabs = [ { id: 7, incognito: false, url: carrierUrl } ];
	const { runtime, coordinator } = createRuntime(
		{ value: 200_000 },
		new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
		browser,
		new MemoryProtectionStorage(),
		undefined,
		undefined,
		true,
	);
	const startup = Promise.withResolvers<boolean>();
	const controller = createProtectionBackgroundController( {
		browser: fakeBrowser, runtime, interruptionPageUrl,
		optionsPageUrl: 'chrome-extension://extension-id/options.html',
		/** @return The controlled initial-recovery barrier. */
		waitForStartupRecovery: () => startup.promise,
	} );
	controller.start();
	await controller.waitUntilReady();
	if ( arrival === 'during' ) {
		await runtime.suspendForDataReset();
	}
	const response = Promise.withResolvers<unknown>();
	const tab = await fakeBrowser.tabs.create( {} );
	await fakeBrowser.runtime.onMessage.trigger( { type: 'resolve-navigation-redirect' },
		{ frameId: 0, url: carrierUrl, tab: { ...tab, id: 7, incognito: false, url: carrierUrl } },
		response.resolve ).then( () => undefined );
	await waitForQueuedWork();
	if ( arrival === 'before' ) {
		await runtime.suspendForDataReset();
	}
	await runtime.resumeAfterDataReset();
	await runtime.start();
	browser.tabs = [ { id: 7, incognito: false, url: carrierUrl } ];
	const navigationsBeforeRecovery = structuredClone( browser.navigations );
	startup.resolve( true );
	await expect( response.promise ).resolves.toEqual( { url: null } );
	await expect( coordinator.getStates() ).resolves.toEqual( {} );
	expect( browser.navigations ).toEqual( navigationsBeforeRecovery );
} );

it.each( [ 'before', 'during' ] )( 'rejects a cold request captured %s a later data reset', async ( arrival ) => {
	fakeBrowser.reset();
	const contains = vi.spyOn( fakeBrowser.permissions, 'contains' ) as MockInstance<
		( permissions: Browser.permissions.Permissions ) => Promise<boolean>>;
	contains.mockResolvedValue( true );
	vi.spyOn( fakeBrowser.permissions.onAdded, 'addListener' ).mockReturnValue( undefined );
	vi.spyOn( fakeBrowser.permissions.onRemoved, 'addListener' ).mockReturnValue( undefined );
	const { runtime, coordinator } = createRuntime(
		{ value: 200_000 },
		new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
		new MemoryRuntimeBrowser(),
		new MemoryProtectionStorage(),
		undefined,
		undefined,
		true,
	);
	const startup = Promise.withResolvers<boolean>();
	const controller = createProtectionBackgroundController( {
		browser: fakeBrowser, runtime,
		interruptionPageUrl: 'chrome-extension://extension-id/interruption.html',
		optionsPageUrl: 'chrome-extension://extension-id/options.html',
		/** @return The controlled initial-recovery barrier. */
		waitForStartupRecovery: () => startup.promise,
	} );
	controller.start();
	await controller.waitUntilReady();
	if ( arrival === 'during' ) {
		await runtime.suspendForDataReset();
	}
	const response = Promise.withResolvers<unknown>();
	let responded = false;
	void response.promise.then( () => {
		responded = true;
	} );
	const tab = await fakeBrowser.tabs.create( {} );
	await fakeBrowser.runtime.onMessage.trigger( {
		type: InterruptionPageRequestType.CHECKPOINT,
		documentVisible: true, displayedFocusedDurationMilliseconds: 9_000,
	}, { frameId: 0, url: 'chrome-extension://extension-id/interruption.html',
		tab: { ...tab, id: 7, incognito: false } }, response.resolve ).then( () => undefined );
	await waitForQueuedWork();
	const respondedBeforeRecovery = responded;
	if ( arrival === 'before' ) {
		await runtime.suspendForDataReset();
	}
	await runtime.resumeAfterDataReset();
	await runtime.start();
	await runtime.handleNavigation( { frameId: 0, tabId: 7, url: 'https://example.com/new-visit' } );
	await runtime.handlePageRequest( { type: InterruptionPageRequestType.CONNECT, documentVisible: true }, 7, true );
	startup.resolve( true );
	expect( InterruptionPageResponseSchema.parse( await response.promise ) )
		.toEqual( { state: InterruptionPageResponseState.UNAVAILABLE } );
	expect( respondedBeforeRecovery ).toBe( false );
	expect( ( await coordinator.getStates() )?.scope_default ).toMatchObject( {
		type: ProtectionStateType.WAITING, confirmedFocusedDurationMilliseconds: 0,
		participants: [ { retainedDestination: 'https://example.com/new-visit' } ],
	} );
} );
