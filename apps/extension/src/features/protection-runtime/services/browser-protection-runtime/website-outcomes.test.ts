import { describe, expect, it, vi } from 'vitest';
import { CompletionAction } from '../../../../domains/protection/types/completion-action';
import { ProtectionFactType } from '../../../../domains/protection/types/protection-fact';
import type { ProtectionCoordinator } from '../../../../domains/protection/services/protection-coordinator';
import { TestEmptyProtectionConfiguration } from '../../../../domains/protection/types/__fixtures__';
import { InterruptionNavigationReplacementRequestSchema, InterruptionPageRequestType } from '../../types/runtime-message';
import { createBrowserProtectionAdapter } from '../browser-protection-adapter';
import { EXAMPLE_CONFIGURATION, GROUPED_CONFIGURATION, MemoryConfigurationStorage, MemoryRuntimeBrowser,
	completeFocusedPause, createRuntime, readActiveAllowanceExpiry } from './__fixtures__';

/**
 * Reads real queued facts before the observational statistics consumer acknowledges them.
 * @param coordinator - Coordinator holding the durable observational outbox.
 * @return Facts retained for delivery, before acknowledgement.
 */
async function facts( coordinator: ProtectionCoordinator ) {
	return ( await coordinator.getStatisticsDelivery() )?.outbox.flatMap( ( batch ) => batch.facts ) ?? [];
}

const continueRequest = { type: InterruptionPageRequestType.CONTINUE, documentVisible: true };

describe( 'browser-accepted website outcomes', () => {
	it( 'retains accepted owner entry when a later grouped-tab decision fails', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 23, 59, 59, 900 ) };
		const browser = new MemoryRuntimeBrowser();
		browser.tabs = [ { id: 7, incognito: false, url: 'https://example.com/one' },
			{ id: 9, incognito: false, url: 'https://another.test/two' } ];
		const configuration = { ...GROUPED_CONFIGURATION, timingConfiguration: {
			...GROUPED_CONFIGURATION.timingConfiguration, completionAction: CompletionAction.OPEN_AUTOMATICALLY,
		} };
		const { runtime, coordinator } = createRuntime( now, new MemoryConfigurationStorage( configuration ), browser );
		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/one' } );
		await runtime.handleNavigation( { tabId: 9, frameId: 0, url: 'https://another.test/two' } );
		const navigate = browser.navigateTab;
		const listTabs = browser.listTabs;
		let ownerAccepted = false;
		browser.navigateTab = async ( ...args ) => {
			const accepted = await navigate( ...args );
			ownerAccepted = accepted;
			return accepted;
		};
		browser.listTabs = async () => {
			if ( ownerAccepted ) {
				throw new Error( 'Unrelated second-tab observation failed.' );
			}
			return listTabs();
		};
		await expect( completeFocusedPause( runtime, 7 ) ).rejects.toThrow( 'Unrelated second-tab observation failed.' );
		expect( browser.tabs.find( ( tab ) => tab.id === 7 )?.url ).toBe( 'https://example.com/one' );
		expect( ( await facts( coordinator ) ).filter( ( fact ) => fact.type === ProtectionFactType.CONTINUED_VISIT ) )
			.toMatchObject( [ { siteHost: 'example.com', observedLocalHour: 23 } ] );
		expect( ( await coordinator.getStatisticsDelivery() )?.pendingContinuations ?? [] ).toEqual( [] );
	} );
	it.each( [ false, true ] )( 'captures acceptance before delayed audio cleanup fails: %s', async ( fails ) => {
		const now = { value: Date.UTC( 2026, 8, 2, 23, 59, 59, 900 ) };
		const browser = new MemoryRuntimeBrowser();
		const { runtime, coordinator } = createRuntime(
			now, new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ), browser,
		);
		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/entry' } );
		await completeFocusedPause( runtime, 7 );
		const acceptedAt = now.value;
		const adapter = createBrowserProtectionAdapter( {
			runtime: {
				/** @return Extension-owned interruption URL accepted by the real replacement adapter. */
				getURL: () => 'chrome-extension://extension-id/pause.html',
			},
			alarms: { clear: vi.fn(), create: vi.fn(), getAll: vi.fn() },
			declarativeNetRequest: { getDynamicRules: vi.fn(), updateDynamicRules: vi.fn() },
			scripting: { executeScript: vi.fn(), insertCSS: vi.fn() },
			windows: { getLastFocused: vi.fn() },
			tabs: {
				/** @return Current real runtime fixture tabs observed by the adapter. */
				query: () => Promise.resolve( browser.tabs ),
				/**
				 * Accepts a native replacement only after the tab adopts its validated destination.
				 * @param tabId - Target tab identity.
				 * @param input - Replacement request validated by the production request schema.
				 * @return Accepted replacement response.
				 */
				sendMessage: ( tabId, input ) => {
					const request = InterruptionNavigationReplacementRequestSchema.parse( input );
					browser.tabs = browser.tabs.map( ( tab ) => tab.id === tabId ? { ...tab, url: request.url } : tab );
					return Promise.resolve( { replaced: true } );
				},
				update: vi.fn(),
			},
		}, {
			mute: vi.fn(), restoreExcept: vi.fn(), observeMuteChange: vi.fn(),
			/** @return Cleanup completion after the clock crosses midnight, or a rejected cleanup. */
			restore: () => {
				now.value += 500;
				if ( fails ) {
					return Promise.reject( new Error( 'Audio cleanup failed after accepted navigation.' ) );
				}
				return Promise.resolve();
			},
		} );
		browser.navigateTab = adapter.navigateTab;
		await runtime.handlePageRequest( continueRequest, 7, true );
		const delivery = await coordinator.getStatisticsDelivery();
		const accepted = delivery?.outbox.find( ( batch ) => batch.facts.some(
			( fact ) => fact.type === ProtectionFactType.CONTINUED_VISIT ) );
		expect( accepted ).toMatchObject( { observedLocalDate: '2026-09-02', facts: [ {
			observedAtEpochMilliseconds: acceptedAt, observedLocalHour: 23, siteHost: 'example.com',
		} ] } );
		expect( delivery?.pendingContinuations ?? [] ).toEqual( [] );
	} );
	it( 'counts two participant continuations separately from their shared wait and allowance', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 23 ) };
		const browser = new MemoryRuntimeBrowser();
		browser.tabs = [ { id: 7, incognito: false, url: 'https://example.com/one' },
			{ id: 9, incognito: false, url: 'https://another.test/two' } ];
		const { runtime, coordinator } = createRuntime(
			now, new MemoryConfigurationStorage( GROUPED_CONFIGURATION ), browser,
		);
		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/one' } );
		await runtime.handleNavigation( { tabId: 9, frameId: 0, url: 'https://another.test/two' } );
		await completeFocusedPause( runtime, 7 );
		expect( ( await facts( coordinator ) ).filter( ( fact ) => fact.type === ProtectionFactType.CONTINUED_VISIT ) )
			.toEqual( [] );
		await runtime.handlePageRequest( continueRequest, 7, true );
		browser.focusedTabId = 9;
		await runtime.handlePageRequest( continueRequest, 9, true );
		await runtime.handlePageRequest( continueRequest, 9, true );
		const recorded = await facts( coordinator );
		expect( recorded.filter( ( fact ) => fact.type === ProtectionFactType.COMPLETED_WAIT ) ).toHaveLength( 1 );
		expect( recorded.filter( ( fact ) => fact.type === ProtectionFactType.ALLOWANCE_GRANTED ) ).toHaveLength( 1 );
		expect( recorded.filter( ( fact ) => fact.type === ProtectionFactType.CONTINUED_VISIT ) ).toMatchObject( [
			{ siteHost: 'example.com', observedLocalHour: 23 }, { siteHost: 'another.test', observedLocalHour: 23 },
		] );
		expect( ( await coordinator.getStatisticsDelivery() )?.pendingContinuations ?? [] ).toEqual( [] );
	} );
	it( 'counts automatic owner entry only after its navigation is accepted', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configuration = { ...EXAMPLE_CONFIGURATION, timingConfiguration: {
			...EXAMPLE_CONFIGURATION.timingConfiguration,
			completionAction: CompletionAction.OPEN_AUTOMATICALLY } };
		const { runtime, coordinator } = createRuntime( now, new MemoryConfigurationStorage( configuration ), browser );
		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/automatic' } );
		await completeFocusedPause( runtime, 7 );
		expect( browser.tabs.find( ( tab ) => tab.id === 7 )?.url ).toBe( 'https://example.com/automatic' );
		expect( ( await facts( coordinator ) ).filter( ( fact ) => fact.type === ProtectionFactType.CONTINUED_VISIT ) )
			.toMatchObject( [ { siteHost: 'example.com', observedLocalHour: 12 } ] );
	} );
	it.each( [ 'stale', 'rejected' ] )( 'does not count a %s browser release', async ( disposition ) => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { runtime, coordinator } = createRuntime(
			now, new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ), browser,
		);
		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/entry' } );
		await completeFocusedPause( runtime, 7 );
		browser.navigateTab = () => {
			if ( disposition === 'rejected' ) {
				return Promise.reject( new Error( 'Browser rejected navigation' ) );
			}
			browser.tabs = [ { id: 7, incognito: false, url: 'https://elsewhere.test/' } ];
			return Promise.resolve( false );
		};
		const result = runtime.handlePageRequest( continueRequest, 7, true );
		if ( disposition === 'rejected' ) {
			await expect( result ).rejects.toThrow( 'Browser rejected navigation' );
		} else {
			await result;
		}
		expect( ( await facts( coordinator ) ).filter( ( fact ) => fact.type === ProtectionFactType.CONTINUED_VISIT ) )
			.toEqual( [] );
		expect( ( await coordinator.getStatisticsDelivery() )?.pendingContinuations ?? [] ).toEqual( [] );
	} );
	it( 'excludes expiry-origin resume and navigation already covered by an allowance', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { runtime, coordinator } = createRuntime(
			now, new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ), browser,
		);
		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/entry' } );
		await completeFocusedPause( runtime, 7 );
		await runtime.handlePageRequest( continueRequest, 7, true );
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/covered' } );
		now.value = await readActiveAllowanceExpiry( runtime );
		await runtime.handleClockTick();
		await completeFocusedPause( runtime, 7, 15_000 );
		await runtime.handlePageRequest( continueRequest, 7, true );
		expect( ( await facts( coordinator ) ).filter( ( fact ) => fact.type === ProtectionFactType.CONTINUED_VISIT ) )
			.toHaveLength( 1 );
	} );
	it.each( [ 'configuration', 'permission' ] )( 'does not count release after %s removal', async ( removal ) => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const storage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		const { runtime, coordinator } = createRuntime( now, storage, browser );
		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/entry' } );
		await completeFocusedPause( runtime, 7 );
		if ( removal === 'configuration' ) {
			storage.configuration = TestEmptyProtectionConfiguration;
		} else {
			storage.accessibleConfiguration = TestEmptyProtectionConfiguration;
		}
		await runtime.handleConfigurationChanged();
		await runtime.handlePageRequest( continueRequest, 7, true );
		expect( ( await facts( coordinator ) ).filter( ( fact ) => fact.type === ProtectionFactType.CONTINUED_VISIT ) )
			.toEqual( [] );
	} );
} );
