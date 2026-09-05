import { describe, expect, it, vi } from 'vitest';
import { createIdleState, TestEmptyProtectionConfiguration } from '../../../../domains/protection/types/__fixtures__';
import { ProtectionConfigurationDocumentSchema } from '../../../../domains/protection/types/protected-site-configuration';
import { ProtectionStateType } from '../../../../domains/protection/types/protection-state';
import {
	PageIdSchema,
	ParticipantIdSchema,
} from '../../../../domains/protection/types/protection-value';
import { type ToolbarBadgeCopy } from '../../utils/toolbar-badge-projection';
import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import {
	InterruptionPageRequestType,
	InterruptionPageResponseState,
} from '../../types/runtime-message';
import { ProtectedPageMessageType } from '../../types/protected-page-message';
import { StatisticsFocusObservationMode } from '../../../../domains/statistics/utils/prepare-statistics-checkpoint';
import {
	EXAMPLE_CONFIGURATION,
	GROUPED_CONFIGURATION,
	MULTI_SCOPE_CONFIGURATION,
	MemoryConfigurationStorage,
	MemoryProtectionStorage,
	MemoryRuntimeBrowser,
	completeFocusedPause,
	createRuntime,
	presentAllowanceExpiryInterruption,
} from './__fixtures__';
import { createInertStatisticsRuntime } from './__fixtures__/statistics-runtime';

describe( 'createBrowserProtectionRuntime', () => {
	it( 'returns no popup snapshot before authoritative startup', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);

		await expect( runtime.readSnapshot() ).resolves.toBeNull();
	} );

	it( 'returns detached raw and permission-filtered popup state after startup', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		configurationStorage.accessibleConfiguration = TestEmptyProtectionConfiguration;
		const { runtime } = createRuntime( now, configurationStorage, browser );

		await runtime.start();
		const snapshot = await runtime.readSnapshot();

		expect( snapshot ).toMatchObject( {
			configuration: { sites: EXAMPLE_CONFIGURATION.sites },
			activeConfiguration: { sites: [] },
			statesByScope: {},
			capturedAtEpochMilliseconds: now.value,
			timeZone: 'UTC',
		} );
		expect( snapshot?.configuration ).not.toBe( configurationStorage.configuration );
		expect( snapshot?.activeConfiguration ).not.toBe( configurationStorage.accessibleConfiguration );
	} );

	it( 'returns no popup snapshot after protection becomes unavailable', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		const { runtime } = createRuntime( now, configurationStorage, browser );

		await runtime.start();
		configurationStorage.throwOnLoad = true;
		await runtime.handleConfigurationChanged();

		await expect( runtime.readSnapshot() ).resolves.toBeNull();
	} );

	it( 'returns no popup snapshot when coordinator state is unavailable', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { coordinator, runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);

		await runtime.start();
		vi.spyOn( coordinator, 'getStates' ).mockResolvedValueOnce( null );

		await expect( runtime.readSnapshot() ).resolves.toBeNull();
	} );

	it( 'dismisses an orphaned standalone interruption after synchronization', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);

		await runtime.start();
		browser.tabs = [ {
			id: 7,
			incognito: false,
			url: 'chrome-extension://extension-id/interruption.html',
		} ];

		await expect( runtime.handlePageRequest( {
			type: InterruptionPageRequestType.SYNCHRONIZE,
			documentVisible: true,
		}, 7, true ) ).resolves.toEqual( { state: InterruptionPageResponseState.UNAVAILABLE } );

		expect( browser.dismissedTabs ).toEqual( [ 7 ] );
	} );

	it( 'removes an orphaned interruption layer after synchronization', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);

		await runtime.start();
		browser.protectedPageUpdates = [];
		browser.protectedPagePresentations.set( 7, {
			allowanceWarningId: null,
			interruptionLayerPresented: true,
		} );

		await expect( runtime.handlePageRequest( {
			type: InterruptionPageRequestType.SYNCHRONIZE,
			documentVisible: true,
		}, 7, true ) ).resolves.toEqual( { state: InterruptionPageResponseState.UNAVAILABLE } );

		expect( browser.protectedPageUpdates ).toEqual( [ {
			tabId: 7,
			message: { type: ProtectedPageMessageType.REMOVE_INTERRUPTION_LAYER },
		} ] );
	} );

	it.each( [
		[ 'private', true ],
		[ 'privacy-unknown', undefined ],
	] )( 'does not persist a %s navigation and protects a later ordinary visit', async (
		_label,
		incognito,
	) => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const storage = new MemoryProtectionStorage();
		const { coordinator, runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
			storage,
		);
		browser.tabs = [ {
			id: 7,
			url: 'https://example.com/private',
			...( incognito === undefined ? {} : { incognito } ),
		} ];

		await runtime.start();
		await runtime.handleNavigation( {
			tabId: 7,
			frameId: 0,
			url: 'https://example.com/private',
		} );

		expect( await coordinator.getStates() ).toEqual( {} );
		expect( await coordinator.getStatisticsDelivery() ).toMatchObject( { outbox: [] } );
		expect( JSON.stringify( storage.state ) ).not.toContain( 'https://example.com/private' );
		expect( browser.navigations ).toEqual( [] );

		browser.tabs = [ {
			id: 7,
			incognito: false,
			url: 'https://example.com/ordinary',
		} ];
		await runtime.handleNavigation( {
			tabId: 7,
			frameId: 0,
			url: 'https://example.com/ordinary',
		} );

		expect( ( await coordinator.getStates() )?.scope_default?.type ).toBe(
			ProtectionStateType.WAITING,
		);
	} );

	it.each( [
		[ 'private', true ],
		[ 'privacy-unknown', undefined ],
	] )( 'removes retained state when an ordinary tab navigates with %s metadata', async (
		_label,
		incognito,
	) => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const storage = new MemoryProtectionStorage();
		const { coordinator, runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
			storage,
		);

		await runtime.start();
		await runtime.handleNavigation( {
			tabId: 7,
			frameId: 0,
			url: 'https://example.com/ordinary',
		} );
		browser.tabs = [ {
			id: 7,
			url: 'https://example.com/private',
			...( incognito === undefined ? {} : { incognito } ),
		} ];

		await runtime.handleNavigation( {
			tabId: 7,
			frameId: 0,
			url: 'https://example.com/private',
		} );

		expect( ( await coordinator.getStates() )?.scope_default ).toMatchObject( {
			type: ProtectionStateType.IDLE,
			ladder: { completedWaits: 0 },
		} );
		expect( await coordinator.getStatisticsDelivery() ).toMatchObject( { outbox: [] } );
		expect( JSON.stringify( storage.state ) ).not.toContain( 'https://example.com/private' );
	} );

	it.each( [
		[ 'private', true ],
		[ 'privacy-unknown', undefined ],
	] )( 'removes retained state when a %s interruption page sends a request', async (
		_label,
		incognito,
	) => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const storage = new MemoryProtectionStorage();
		const { coordinator, runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
			storage,
		);

		await runtime.start();
		await runtime.handleNavigation( {
			tabId: 7,
			frameId: 0,
			url: 'https://example.com/private',
		} );
		browser.tabs = [ {
			id: 7,
			url: 'chrome-extension://extension-id/interruption.html',
			...( incognito === undefined ? {} : { incognito } ),
		} ];

		await expect( runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CHECKPOINT,
			documentVisible: true,
			displayedFocusedDurationMilliseconds: 10_000,
		}, 7, false ) ).resolves.toEqual( {
			state: InterruptionPageResponseState.UNAVAILABLE,
		} );

		const state = ( await coordinator.getStates() )?.scope_default;

		expect( state ).toMatchObject( {
			type: ProtectionStateType.IDLE,
			ladder: { completedWaits: 0 },
		} );
		expect( await coordinator.getStatisticsDelivery() ).toMatchObject( { outbox: [] } );
		expect( JSON.stringify( storage.state ) ).not.toContain( 'https://example.com/private' );
		expect( browser.dismissedTabs ).toEqual( [ 7 ] );
	} );

	it( 'excludes sites without current host access from matching and redirects', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		configurationStorage.accessibleConfiguration = TestEmptyProtectionConfiguration;
		const { coordinator, runtime } = createRuntime( now, configurationStorage, browser );

		await runtime.start();
		await runtime.handleNavigation( {
			tabId: 7,
			frameId: 0,
			url: 'https://example.com/',
		} );

		expect( configurationStorage.filterCalls ).toBeGreaterThan( 0 );
		expect( browser.rules ).toEqual( [] );
		expect( browser.navigations ).toEqual( [] );
		expect( ( await coordinator.getStates() )?.scope_default ).toBeUndefined();
	} );

	it( 'fails open when permission filtering returns malformed configuration', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		configurationStorage.filterForRuntime = vi.fn().mockResolvedValue( {
			version: 'invalid',
		} );
		const { runtime } = createRuntime( now, configurationStorage, browser );

		await runtime.start();

		expect( browser.rules ).toEqual( [] );
		expect( browser.badge ).toMatchObject( { text: '' } );
	} );

	it( 'keeps browser operations inert before runtime startup', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);

		await runtime.handleClockTick();
		await runtime.handleFocusChanged();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		await runtime.handleTabRemoved( 7 );

		expect( await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONNECT,
			documentVisible: true,
		}, 7, true ) ).toEqual( { state: InterruptionPageResponseState.UNAVAILABLE } );
		expect( browser.rules ).toEqual( [] );
		expect( browser.navigations ).toEqual( [] );
	} );

	it( 'fails open when persisted protection state cannot be restored', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const storage = new MemoryProtectionStorage();
		storage.throwOnLoad = true;
		const { runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
			storage,
		);

		await runtime.start();

		expect( browser.rules ).toEqual( [] );
		expect( browser.protectionClockDeadlines ).toEqual( [] );
		expect( browser.badge ).toMatchObject( { text: '' } );
		expect( await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONNECT,
			documentVisible: true,
		}, 7, true ) ).toEqual( { state: InterruptionPageResponseState.UNAVAILABLE } );
	} );

	it( 'restores and releases persisted interruption state during cold fail-open startup', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		const storage = new MemoryProtectionStorage();
		const firstRuntime = createRuntime(
			now,
			configurationStorage,
			browser,
			storage,
		).runtime;

		await firstRuntime.start();
		await firstRuntime.handleNavigation( {
			tabId: 7,
			frameId: 0,
			url: 'https://example.com/watch?v=1',
		} );
		expect( browser.tabs[ 0 ]?.url ).toBe(
			'chrome-extension://extension-id/interruption.html',
		);

		const restartedStatistics = createInertStatisticsRuntime();
		const restarted = createRuntime(
			now,
			configurationStorage,
			browser,
			storage,
			undefined,
			restartedStatistics,
		);

		await restarted.runtime.failOpen();
		await vi.waitFor( () => {
			expect( restartedStatistics.discardFocusMeasurement ).toHaveBeenCalledOnce();
		} );

		expect( browser.tabs[ 0 ]?.url ).toBe( 'https://example.com/watch?v=1' );
		expect( restarted.coordinator.getStatisticsDeliveryBoundary() ).not.toBeNull();
		expect( ( await restarted.coordinator.getStates() )?.scope_default?.type ).toBe(
			ProtectionStateType.IDLE,
		);
	} );

	it( 'restores protection after a required browser permission is granted again', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);

		await runtime.start();
		expect( browser.rules ).toHaveLength( 1 );

		await runtime.failOpen();
		expect( browser.rules ).toEqual( [] );

		await runtime.start();
		expect( browser.rules ).toHaveLength( 1 );

		await runtime.start();
		expect( browser.rules ).toHaveLength( 1 );
	} );

	it( 'accepts explicit localized toolbar copy at runtime composition', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const localizedCopy: ToolbarBadgeCopy = {
			...TestEnglishLocalizationBundle.toolbar,
			inactive: { text: '', title: 'TOCus localizado' },
		};
		const { runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
			new MemoryProtectionStorage(),
			localizedCopy,
		);

		await runtime.start();

		expect( browser.badge ).toEqual( {
			phase: 'inactive',
			text: '',
			title: 'TOCus localizado',
		} );
	} );

	it( 'refreshes the toolbar after localized copy changes', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const localizedCopy: ToolbarBadgeCopy = {
			...TestEnglishLocalizationBundle.toolbar,
			inactive: { text: '', title: 'TOCus' },
		};
		const { runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
			new MemoryProtectionStorage(),
			localizedCopy,
		);

		await runtime.start();
		localizedCopy.inactive = { text: '', title: 'TOCus localizado' };
		await runtime.refreshToolbarBadge();

		expect( browser.badge ).toEqual( {
			phase: 'inactive',
			text: '',
			title: 'TOCus localizado',
		} );
	} );

	it( 'ignores a presentation refresh before protection becomes available', async () => {
		const browser = new MemoryRuntimeBrowser();
		const { runtime } = createRuntime(
			{ value: Date.UTC( 2026, 8, 2, 12 ) },
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);

		await runtime.refreshToolbarBadge();

		expect( browser.badge ).toBeNull();
	} );

	it( 'recovers its operation queue after persistence rejects a protected visit', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const storage = new MemoryProtectionStorage();
		const statisticsRuntime = createInertStatisticsRuntime();
		const { runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
			storage,
			undefined,
			statisticsRuntime,
		);
		await runtime.start();
		statisticsRuntime.checkpoint.mockClear();
		storage.throwOnSave = true;
		const navigation = {
			tabId: 7,
			frameId: 0,
			url: 'https://example.com/',
		};

		await expect( runtime.handleNavigation( navigation ) ).rejects.toThrow(
			'Protection state dispatch failed: storage-write-failed.',
		);

		expect( browser.rules ).toEqual( [] );
		expect( browser.badge ).toMatchObject( { text: '' } );
		expect( statisticsRuntime.checkpoint ).toHaveBeenCalledWith( null, {
			observedAtEpochMilliseconds: now.value,
			focusObservation: null,
			focusEpochTransition: {
				mode: StatisticsFocusObservationMode.BOUNDARY,
				previousFocusEpochId: 'focus_epoch_current',
				currentFocusEpochId: 'focus_epoch_current',
			},
		} );
		storage.throwOnSave = false;
		await expect( runtime.failOpen() ).resolves.toBeUndefined();
	} );

	it( 'connects a protected navigation through Waiting, Ready, Continue, and toolbar badges', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		const { coordinator, runtime } = createRuntime( now, configurationStorage, browser );

		await runtime.start();
		expect( browser.rules ).toHaveLength( 1 );

		await runtime.handleNavigation( {
			tabId: 7,
			frameId: 0,
			url: 'https://example.com/watch?v=1',
		} );
		const waiting = await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONNECT,
			documentVisible: true,
		}, 7, true );

		expect( waiting ).toEqual( {
			state: InterruptionPageResponseState.WAITING,
			capturedWaitDurationMilliseconds: 10_000,
			focusedProgressMilliseconds: 0,
			progressing: true,
		} );
		expect( browser.badge ).toMatchObject( { text: 'P10s', title: 'TOCus: Pause: 10 seconds remaining' } );

		const ready = await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CHECKPOINT,
			documentVisible: true,
			displayedFocusedDurationMilliseconds: 10_000,
		}, 7, true );

		expect( ready ).toEqual( {
			state: InterruptionPageResponseState.READY,
			allowanceExpiresAtEpochMilliseconds: now.value + 300_000,
		} );
		expect( browser.rules ).toEqual( [] );
		expect( browser.badge ).toMatchObject( { text: 'V5m', title: 'TOCus: Visit window: 5 minutes remaining' } );
		expect( browser.protectionClockDeadlines ).toEqual( [
			now.value + 60_000,
			now.value + 290_000,
			now.value + 300_000,
		] );

		await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONTINUE,
			documentVisible: true,
		}, 7, true );

		expect( browser.navigations ).toEqual( [
			{
				tabId: 7,
				url: 'chrome-extension://extension-id/interruption.html',
			},
			{
				tabId: 7,
				url: 'https://example.com/watch?v=1',
			},
		] );
		expect( ( await coordinator.getStates() )?.scope_default?.type ).toBe( ProtectionStateType.ALLOWANCE );
	} );

	it( 'ignores subframes and leaves scheduled-out navigation unprotected', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( {
			...EXAMPLE_CONFIGURATION,
			schedulesByScope: {
				scope_default: { mode: 'custom', windows: [ {
					weekday: 'Monday',
					startMinute: 0,
					endMinute: 1,
				} ] },
			},
		} );
		const { coordinator, runtime } = createRuntime( now, configurationStorage, browser );

		await runtime.start();
		expect( browser.rules ).toEqual( [] );
		await runtime.handleNavigation( { tabId: 7, frameId: 1, url: 'https://example.com/frame' } );
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );

		expect( ( await coordinator.getStates() )?.scope_default ).toBeUndefined();
	} );

	it( 'releases a navigation caught by a stale rule after its schedule ends', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const configuration = ProtectionConfigurationDocumentSchema.parse( {
			...EXAMPLE_CONFIGURATION,
			schedulesByScope: {
				scope_default: {
					mode: 'custom',
					windows: [ { weekday: 'Wednesday', startMinute: 720, endMinute: 721 } ],
				},
			},
		} );
		const browser = new MemoryRuntimeBrowser();
		const { runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( configuration ),
			browser,
		);
		await runtime.start();
		now.value += 120_000;
		browser.tabs = [ {
			id: 7,
			incognito: false,
			url: 'chrome-extension://extension-id/interruption.html',
		} ];

		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );

		expect( browser.rules ).toEqual( [] );
		expect( browser.tabs ).toEqual( [ {
			id: 7,
			incognito: false,
			url: 'https://example.com/',
		} ] );
	} );

	it( 'releases a navigation caught by a stale rule after its site is removed', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		const { runtime } = createRuntime( now, configurationStorage, browser );
		await runtime.start();
		configurationStorage.configuration = TestEmptyProtectionConfiguration;
		browser.tabs = [ {
			id: 7,
			incognito: false,
			url: 'chrome-extension://extension-id/interruption.html',
		} ];

		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );

		expect( browser.rules ).toEqual( [] );
		expect( browser.tabs ).toEqual( [ {
			id: 7,
			incognito: false,
			url: 'https://example.com/',
		} ] );
	} );

	it( 'ends an active wait when navigation observes that its scope was removed', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		const { coordinator, runtime } = createRuntime( now, configurationStorage, browser );
		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		configurationStorage.configuration = TestEmptyProtectionConfiguration;

		await runtime.handleNavigation( {
			tabId: 7,
			frameId: 0,
			url: 'https://unprotected.test/',
		} );

		expect( ( await coordinator.getStates() )?.scope_default?.type ).toBe( ProtectionStateType.IDLE );
		expect( browser.rules ).toEqual( [] );
	} );

	it( 'does not duplicate an existing wait for the same retained navigation', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { coordinator, runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);
		await runtime.start();

		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );

		const state = ( await coordinator.getStates() )?.scope_default;

		expect( state?.type ).toBe( ProtectionStateType.WAITING );
		expect( state?.type === ProtectionStateType.WAITING ? state.participants : [] ).toHaveLength( 1 );
		expect( browser.navigations ).toEqual( [ {
			tabId: 7,
			url: 'chrome-extension://extension-id/interruption.html',
		} ] );
	} );

	it( 'abandons a pending wait when its browser tab closes', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { coordinator, runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);
		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );

		await runtime.handleTabRemoved( 7 );

		expect( ( await coordinator.getStates() )?.scope_default?.type ).toBe( ProtectionStateType.IDLE );
	} );

	it( 'releases an active wait when its protection scope is removed', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		const { coordinator, runtime } = createRuntime( now, configurationStorage, browser );
		await runtime.start();
		expect( browser.rules ).toHaveLength( 1 );
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );

		configurationStorage.configuration = TestEmptyProtectionConfiguration;
		await runtime.handleConfigurationChanged();
		await runtime.handleClockTick();

		expect( browser.rules ).toEqual( [] );
		expect( ( await coordinator.getStates() )?.scope_default?.type ).toBe( ProtectionStateType.IDLE );
	} );

	it( 'shares one visit allowance across grouped sites and newly opened tabs', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { coordinator, runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( GROUPED_CONFIGURATION ),
			browser,
		);

		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		await completeFocusedPause( runtime, 7 );
		await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONTINUE,
			documentVisible: true,
		}, 7, true );
		await runtime.handleTabRemoved( 7 );
		browser.tabs = [ { id: 8, incognito: false, url: 'https://another.test/feed' } ];
		browser.focusedTabId = 8;

		await runtime.handleNavigation( { tabId: 8, frameId: 0, url: 'https://another.test/feed' } );

		expect( ( await coordinator.getStates() )?.scope_default?.type ).toBe( ProtectionStateType.ALLOWANCE );
		expect( browser.tabs ).toEqual( [ {
			id: 8,
			incognito: false,
			url: 'https://another.test/feed',
		} ] );
		expect( browser.navigations ).toHaveLength( 2 );
	} );

	it( 'keeps an independent site outside another scope allowance', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { coordinator, runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( MULTI_SCOPE_CONFIGURATION ),
			browser,
		);

		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		await completeFocusedPause( runtime, 7 );
		await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONTINUE,
			documentVisible: true,
		}, 7, true );
		browser.tabs.push( {
			id: 8,
			incognito: false,
			url: 'https://independent.test/feed',
		} );
		browser.focusedTabId = 8;

		await runtime.handleNavigation( { tabId: 8, frameId: 0, url: 'https://independent.test/feed' } );

		const states = await coordinator.getStates();

		expect( states?.scope_default?.type ).toBe( ProtectionStateType.ALLOWANCE );
		expect( states?.scope_independent?.type ).toBe( ProtectionStateType.WAITING );
		expect( browser.badge ).toMatchObject( { text: 'P10s' } );
	} );

	it( 'pauses focused progress while the browser application is not focused', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);

		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		browser.focusedTabId = null;
		await runtime.handleFocusChanged();

		const paused = await completeFocusedPause( runtime, 7 );

		expect( paused ).toMatchObject( {
			state: InterruptionPageResponseState.WAITING,
			focusedProgressMilliseconds: 0,
			progressing: false,
		} );
		browser.focusedTabId = 7;
		await runtime.handleFocusChanged();

		expect( await completeFocusedPause( runtime, 7 ) ).toMatchObject( {
			state: InterruptionPageResponseState.READY,
		} );
	} );

	it( 'releases a waiting page when its local schedule ends', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const configuration = ProtectionConfigurationDocumentSchema.parse( {
			...EXAMPLE_CONFIGURATION,
			schedulesByScope: {
				scope_default: {
					mode: 'custom',
					windows: [ { weekday: 'Wednesday', startMinute: 720, endMinute: 721 } ],
				},
			},
		} );
		const browser = new MemoryRuntimeBrowser();
		const { coordinator, runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( configuration ),
			browser,
		);

		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		now.value += 120_000;

		await runtime.handleClockTick();

		expect( ( await coordinator.getStates() )?.scope_default?.type ).toBe( ProtectionStateType.IDLE );
		expect( browser.tabs ).toEqual( [ {
			id: 7,
			incognito: false,
			url: 'https://example.com/',
		} ] );
		expect( browser.rules ).toEqual( [] );
	} );

	it( 'releases a waiting participant whose site leaves a shared scope', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( GROUPED_CONFIGURATION );
		const { coordinator, runtime } = createRuntime( now, configurationStorage, browser );

		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		configurationStorage.configuration = ProtectionConfigurationDocumentSchema.parse( {
			...GROUPED_CONFIGURATION,
			sites: GROUPED_CONFIGURATION.sites.filter( ( site ) => site.identityHost === 'another.test' ),
		} );

		await runtime.handleConfigurationChanged();

		expect( ( await coordinator.getStates() )?.scope_default?.type ).toBe( ProtectionStateType.IDLE );
		expect( browser.tabs ).toEqual( [ {
			id: 7,
			incognito: false,
			url: 'https://example.com/',
		} ] );
	} );

	it( 'gently interrupts a live protected page when its allowance expires', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);

		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		const ready = await completeFocusedPause( runtime, 7 );

		if ( ready.state !== InterruptionPageResponseState.READY ) {
			throw new Error( 'Expected the first pause to complete.' );
		}

		await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONTINUE,
			documentVisible: true,
		}, 7, true );
		now.value = ready.allowanceExpiresAtEpochMilliseconds;
		await runtime.handleClockTick();

		expect( await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONNECT,
			documentVisible: true,
		}, 7, true ) ).toMatchObject( {
			state: InterruptionPageResponseState.WAITING,
			capturedWaitDurationMilliseconds: 15_000,
		} );
		await completeFocusedPause( runtime, 7, 15_000 );
		await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONTINUE,
			documentVisible: true,
		}, 7, true );

		expect( browser.protectedPageUpdates ).toContainEqual( {
			tabId: 7,
			message: { type: ProtectedPageMessageType.PRESENT_INTERRUPTION_LAYER },
		} );
		expect( browser.protectedPageUpdates ).toContainEqual( {
			tabId: 7,
			message: { type: ProtectedPageMessageType.REMOVE_INTERRUPTION_LAYER },
		} );
		expect( browser.dismissedTabs ).toEqual( [] );
	} );

	it( 'removes every injected interruption layer during direct fail-open', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);
		await presentAllowanceExpiryInterruption( runtime, now );
		browser.tabs.push( {
			id: 8,
			incognito: false,
			url: 'https://unrelated.test/',
		} );
		browser.protectedPagePresentations.set( 8, {
			allowanceWarningId: null,
			interruptionLayerPresented: true,
		} );

		await runtime.failOpen();

		expect( browser.protectedPagePresentations.get( 7 ) ).toMatchObject( {
			interruptionLayerPresented: false,
		} );
		expect( browser.protectedPagePresentations.get( 8 ) ).toMatchObject( {
			interruptionLayerPresented: false,
		} );
		expect( browser.protectedPageUpdates.filter(
			( update ) => update.message.type === ProtectedPageMessageType.REMOVE_INTERRUPTION_LAYER,
		) ).toEqual( expect.arrayContaining( [
			{
				tabId: 7,
				message: { type: ProtectedPageMessageType.REMOVE_INTERRUPTION_LAYER },
			},
			{
				tabId: 8,
				message: { type: ProtectedPageMessageType.REMOVE_INTERRUPTION_LAYER },
			},
		] ) );
	} );

	it( 'removes an owned expiry layer when configuration becomes unavailable', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		const { runtime } = createRuntime( now, configurationStorage, browser );
		await presentAllowanceExpiryInterruption( runtime, now );
		configurationStorage.configuration = null;

		await runtime.handleConfigurationChanged();

		expect( browser.protectedPagePresentations.get( 7 ) ).toMatchObject( {
			interruptionLayerPresented: false,
		} );
	} );

	it( 'removes an owned expiry layer before its configured scope is discarded', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		const { coordinator, runtime } = createRuntime( now, configurationStorage, browser );
		await presentAllowanceExpiryInterruption( runtime, now );
		configurationStorage.configuration = TestEmptyProtectionConfiguration;

		await runtime.handleConfigurationChanged();

		expect( browser.protectedPagePresentations.get( 7 ) ).toMatchObject( {
			interruptionLayerPresented: false,
		} );
		expect( ( await coordinator.getStates() )?.scope_default?.type ).toBe( ProtectionStateType.IDLE );
	} );

	it( 'interrupts another protected allowance tab when it receives focus', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( GROUPED_CONFIGURATION ),
			browser,
		);

		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		const ready = await completeFocusedPause( runtime, 7 );

		if ( ready.state !== InterruptionPageResponseState.READY ) {
			throw new Error( 'Expected the first pause to complete.' );
		}

		await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONTINUE,
			documentVisible: true,
		}, 7, true );
		browser.tabs.push( {
			id: 8,
			incognito: false,
			url: 'https://another.test/feed',
		} );
		now.value = ready.allowanceExpiresAtEpochMilliseconds;
		await runtime.handleClockTick();

		browser.focusedTabId = 8;
		await runtime.handleFocusChanged();

		expect( browser.protectedPageUpdates ).toContainEqual( {
			tabId: 8,
			message: { type: ProtectedPageMessageType.PRESENT_INTERRUPTION_LAYER },
		} );
		expect( await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONNECT,
			documentVisible: true,
		}, 8, true ) ).toMatchObject( {
			state: InterruptionPageResponseState.WAITING,
			progressing: true,
		} );
	} );

	it( 'expires an elapsed allowance before reconciling browser focus', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);
		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		const ready = await completeFocusedPause( runtime, 7 );

		if ( ready.state !== InterruptionPageResponseState.READY ) {
			throw new Error( 'Expected the first pause to complete.' );
		}

		await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONTINUE,
			documentVisible: true,
		}, 7, true );
		now.value = ready.allowanceExpiresAtEpochMilliseconds;

		await runtime.handleFocusChanged();

		expect( await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONNECT,
			documentVisible: true,
		}, 7, true ) ).toMatchObject( {
			state: InterruptionPageResponseState.WAITING,
			capturedWaitDurationMilliseconds: 15_000,
			progressing: true,
		} );
	} );

	it( 'reconciles a persisted Ready page when the background runtime restarts', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const storage = new MemoryProtectionStorage();
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		const firstRuntime = createRuntime( now, configurationStorage, browser, storage ).runtime;

		await firstRuntime.start();
		await firstRuntime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		await completeFocusedPause( firstRuntime, 7 );

		const restartedRuntime = createRuntime( now, configurationStorage, browser, storage ).runtime;
		await restartedRuntime.start();

		expect( await restartedRuntime.handlePageRequest( {
			type: InterruptionPageRequestType.CONNECT,
			documentVisible: true,
		}, 7, true ) ).toMatchObject( {
			state: InterruptionPageResponseState.READY,
		} );
	} );

	it( 'removes a restored Waiting participant whose tab moved while runtime was asleep', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const storage = new MemoryProtectionStorage();
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		const firstRuntime = createRuntime( now, configurationStorage, browser, storage ).runtime;

		await firstRuntime.start();
		await firstRuntime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		browser.tabs = [ { id: 7, incognito: false, url: 'https://unrelated.test/' } ];
		browser.navigations = [];

		const restarted = createRuntime( now, configurationStorage, browser, storage );
		await restarted.runtime.start();

		expect( ( await restarted.coordinator.getStates() )?.scope_default?.type ).toBe(
			ProtectionStateType.IDLE,
		);
		expect( browser.navigations ).toEqual( [] );
	} );

	it( 'starts a protected wait when non-authoritative snapshots are temporarily unavailable', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { coordinator, runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);
		await runtime.start();
		const originalGetStates = coordinator.getStates.bind( coordinator );
		let getStatesInvocation = 0;
		const getStates = vi.spyOn( coordinator, 'getStates' ).mockImplementation( async () => {
			getStatesInvocation += 1;

			return getStatesInvocation === 1 || getStatesInvocation === 3
				? null
				: originalGetStates();
		} );

		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		getStates.mockRestore();

		expect( ( await coordinator.getStates() )?.scope_default?.type ).toBe( ProtectionStateType.WAITING );
	} );

	it( 'abandons a retained wait before an unprotected top-level navigation', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { coordinator, runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);
		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/first' } );

		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://unprotected.test/' } );

		expect( ( await coordinator.getStates() )?.scope_default?.type ).toBe( ProtectionStateType.IDLE );
		expect( browser.navigations ).toEqual( [
			{
				tabId: 7,
				url: 'chrome-extension://extension-id/interruption.html',
			},
			{
				tabId: 7,
				url: 'https://unprotected.test/',
			},
		] );
	} );

	it( 'finishes navigation cleanup when the post-departure snapshot becomes unavailable', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { coordinator, runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);
		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/first' } );
		const originalGetStates = coordinator.getStates.bind( coordinator );
		let getStatesInvocation = 0;
		const getStates = vi.spyOn( coordinator, 'getStates' ).mockImplementation( async () => {
			getStatesInvocation += 1;

			return getStatesInvocation === 6 ? null : originalGetStates();
		} );

		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://unprotected.test/' } );
		getStates.mockRestore();

		expect( ( await coordinator.getStates() )?.scope_default?.type ).toBe( ProtectionStateType.IDLE );
	} );

	it( 'tolerates unavailable state snapshots during tab cleanup and focus reconciliation', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { coordinator, runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);
		await runtime.start();
		const getStates = vi.spyOn( coordinator, 'getStates' );
		getStates.mockResolvedValueOnce( null );

		await runtime.handleTabRemoved( 99 );
		getStates.mockResolvedValueOnce( null );
		await runtime.handleFocusChanged();

		expect( browser.rules ).toHaveLength( 1 );
		expect( browser.navigations ).toEqual( [] );
	} );

	it( 'keeps focus reconciliation inert while authoritative state is unavailable', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { coordinator, runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);
		await runtime.start();
		const getStates = vi.spyOn( coordinator, 'getStates' ).mockResolvedValue( null );

		await runtime.handleFocusChanged();
		getStates.mockRestore();

		expect( browser.rules ).toHaveLength( 1 );
		expect( browser.navigations ).toEqual( [] );
	} );

	it( 'keeps an active allowance out of Waiting focus reconciliation', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);
		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		await completeFocusedPause( runtime, 7 );

		await runtime.handleFocusChanged();

		expect( browser.badge ).toMatchObject( { text: 'V5m' } );
	} );

	it( 'pauses a participant when its tab disappears between focus observations', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { coordinator, runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);
		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		const listTabs = vi.spyOn( browser, 'listTabs' );
		listTabs.mockResolvedValueOnce( browser.tabs );
		listTabs.mockResolvedValueOnce( browser.tabs );
		listTabs.mockResolvedValueOnce( [] );

		await runtime.handleFocusChanged();
		listTabs.mockRestore();

		const state = ( await coordinator.getStates() )?.scope_default;

		expect( state?.type ).toBe( ProtectionStateType.WAITING );
		expect( state?.type === ProtectionStateType.WAITING
			? state.participants[ 0 ]?.focusEligible
			: true ).toBe( false );
	} );

	it( 'ignores invalid and stale participant tabs during focus reconciliation', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { coordinator, runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);
		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		const statesByScope = await coordinator.getStates();
		const waitingState = statesByScope?.scope_default;

		if ( waitingState?.type !== ProtectionStateType.WAITING ) {
			throw new Error( 'Expected a Waiting state before focus reconciliation.' );
		}

		const participant = waitingState.participants[ 0 ];

		if ( participant === undefined ) {
			throw new Error( 'Expected a retained Waiting participant.' );
		}

		const observedStates = {
			...statesByScope,
			scope_default: {
				...waitingState,
				participants: [
					{
						...participant,
						participantId: ParticipantIdSchema.parse( 'participant_invalid_page' ),
						pageId: PageIdSchema.parse( 'page_external' ),
						focusEligible: false,
					},
					participant,
				],
			},
			scope_idle: createIdleState(),
		};
		const originalGetStates = coordinator.getStates.bind( coordinator );
		let getStatesInvocation = 0;
		const getStates = vi.spyOn( coordinator, 'getStates' ).mockImplementation( async () => {
			getStatesInvocation += 1;

			if ( getStatesInvocation === 5 ) {
				return null;
			}

			return getStatesInvocation <= 4 ? observedStates : originalGetStates();
		} );

		await runtime.handleFocusChanged();
		getStates.mockRestore();

		expect( browser.badge ).toMatchObject( { text: 'P10s' } );
	} );

	it( 'removes browser projections when focus reconciliation cannot validate configuration', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		const { runtime } = createRuntime( now, configurationStorage, browser );
		await runtime.start();
		configurationStorage.configuration = null;

		await runtime.handleFocusChanged();

		expect( browser.rules ).toEqual( [] );
		expect( browser.badge ).toMatchObject( { text: '' } );
	} );

	it( 'fails open when navigation cannot validate a previously available configuration', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		const { runtime } = createRuntime( now, configurationStorage, browser );
		await runtime.start();
		configurationStorage.configuration = null;

		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );

		expect( browser.rules ).toEqual( [] );
		expect( browser.badge ).toMatchObject( { text: '' } );
		expect( await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONNECT,
			documentVisible: true,
		}, 7, true ) ).toEqual( { state: InterruptionPageResponseState.UNAVAILABLE } );
	} );

	it( 'releases every interruption tab when configuration fails during tab cleanup', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( GROUPED_CONFIGURATION );
		const { coordinator, runtime } = createRuntime( now, configurationStorage, browser );
		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		browser.tabs.push( {
			id: 8,
			incognito: false,
			url: 'https://another.test/feed',
		} );
		await runtime.handleNavigation( { tabId: 8, frameId: 0, url: 'https://another.test/feed' } );
		configurationStorage.configuration = null;
		browser.tabs = browser.tabs.filter( ( tab ) => tab.id !== 8 );

		await runtime.handleTabRemoved( 8 );

		expect( browser.tabs ).toEqual( [ {
			id: 7,
			incognito: false,
			url: 'https://example.com/',
		} ] );
		expect( ( await coordinator.getStates() )?.scope_default?.type ).toBe( ProtectionStateType.IDLE );
		expect( await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONNECT,
			documentVisible: true,
		}, 7, true ) ).toEqual( { state: InterruptionPageResponseState.UNAVAILABLE } );
	} );

	it( 'starts a fresh wait after fail-open configuration recovery', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		const { coordinator, runtime } = createRuntime( now, configurationStorage, browser );
		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		configurationStorage.throwOnLoad = true;

		await runtime.handleClockTick();

		expect( browser.tabs ).toEqual( [ {
			id: 7,
			incognito: false,
			url: 'https://example.com/',
		} ] );
		expect( ( await coordinator.getStates() )?.scope_default?.type ).toBe( ProtectionStateType.IDLE );
		configurationStorage.throwOnLoad = false;
		await runtime.handleConfigurationChanged();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );

		expect( ( await coordinator.getStates() )?.scope_default?.type ).toBe( ProtectionStateType.WAITING );
		expect( browser.tabs ).toEqual( [ {
			id: 7,
			incognito: false,
			url: 'chrome-extension://extension-id/interruption.html',
		} ] );
	} );

	it( 'fails open when local configuration cannot be loaded', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		configurationStorage.throwOnLoad = true;
		const { runtime } = createRuntime( now, configurationStorage, browser );

		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );

		expect( browser.rules ).toEqual( [] );
		expect( browser.badge ).toMatchObject( { text: '' } );
		expect( await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONNECT,
			documentVisible: true,
		}, 7, true ) ).toEqual( { state: InterruptionPageResponseState.UNAVAILABLE } );
	} );

	it( 'fails open when permission filtering rejects a valid configuration', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		const { runtime } = createRuntime( now, configurationStorage, browser );
		await runtime.start();
		configurationStorage.throwOnFilter = true;

		await runtime.handleClockTick();

		expect( browser.rules ).toEqual( [] );
		expect( browser.badge ).toMatchObject( { text: '' } );
	} );
} );
