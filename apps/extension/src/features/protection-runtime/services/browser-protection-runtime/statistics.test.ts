import { describe, expect, it, vi } from 'vitest';
import { TestEmptyProtectionConfiguration } from '../../../../domains/protection/types/__fixtures__';
import { ProtectionConfigurationDocumentSchema } from '../../../../domains/protection/types/protected-site-configuration';
import { ProtectionFactType } from '../../../../domains/protection/types/protection-fact';
import { ProtectionStateType } from '../../../../domains/protection/types/protection-state';
import { StoredProtectionStatisticsDeliveryStatus } from '../../../../domains/protection/types/stored-protection-statistics-delivery';
import { StatisticsFocusObservationMode } from '../../../../domains/statistics/utils/prepare-statistics-checkpoint';
import { ProtectionRuntimeNavigationPhase } from '../../types/browser-runtime';
import { InterruptionPageRequestType } from '../../types/runtime-message';
import { type StatisticsCheckpointObservation } from '../../../statistics/services/statistics-runtime';
import {
	DeferredPromise,
	EXAMPLE_CONFIGURATION,
	GROUPED_CONFIGURATION,
	MemoryConfigurationStorage,
	MemoryRuntimeBrowser,
	MULTI_SCOPE_CONFIGURATION,
	createRuntime,
	waitForQueuedWork,
} from './__fixtures__';
import { createInertStatisticsRuntime } from './__fixtures__/statistics-runtime';

describe( 'createBrowserProtectionRuntime statistics integration', () => {
	it( 'classifies startup, clock samples, and focus changes explicitly', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const statisticsRuntime = createInertStatisticsRuntime();
		const { runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			new MemoryRuntimeBrowser(),
			undefined,
			undefined,
			statisticsRuntime,
		);

		await runtime.start();
		await runtime.handleClockTick();
		await runtime.handleFocusChanged();

		expect( statisticsRuntime.beginFocusObservation.mock.calls ).toEqual( [
			[ StatisticsFocusObservationMode.STARTUP ],
			[ StatisticsFocusObservationMode.SAMPLE ],
			[ StatisticsFocusObservationMode.BOUNDARY ],
		] );
	} );

	it( 'reconciles raw statistics revisions before draining restored observations', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		configurationStorage.accessibleConfiguration = TestEmptyProtectionConfiguration;
		const filterConfiguration = vi.spyOn( configurationStorage, 'filterForRuntime' );
		const statisticsRuntime = createInertStatisticsRuntime();
		const { coordinator, runtime } = createRuntime(
			now,
			configurationStorage,
			browser,
			undefined,
			undefined,
			statisticsRuntime,
		);
		const initialize = vi.spyOn( coordinator, 'initialize' );

		await runtime.start();
		await vi.waitFor( () => {
			expect( statisticsRuntime.checkpoint ).toHaveBeenCalled();
		} );

		expect( statisticsRuntime.reconcileConfiguration ).toHaveBeenCalledWith( EXAMPLE_CONFIGURATION );
		expect( filterConfiguration.mock.invocationCallOrder[ 0 ] ).toBeLessThan(
			initialize.mock.invocationCallOrder[ 0 ] ?? Number.POSITIVE_INFINITY,
		);
		const drainCallOrder = statisticsRuntime.drainProtectionFacts.mock.invocationCallOrder;

		expect( statisticsRuntime.reconcileConfiguration.mock.invocationCallOrder[ 0 ] ).toBeLessThan(
			drainCallOrder[ 0 ] ?? Number.POSITIVE_INFINITY,
		);
		expect( drainCallOrder[ 0 ] ).toBeGreaterThan(
			initialize.mock.invocationCallOrder[ 0 ] ?? Number.NEGATIVE_INFINITY,
		);
		expect( statisticsRuntime.checkpoint.mock.lastCall?.[ 0 ] )
			.toStrictEqual( TestEmptyProtectionConfiguration );
		expect( statisticsRuntime.checkpoint.mock.lastCall?.[ 1 ] ).toMatchObject( {
			observedAtEpochMilliseconds: now.value,
			focusObservation: { focusedTabId: 7 },
		} );
		expect( drainCallOrder[ 0 ] ).toBeLessThan(
			statisticsRuntime.checkpoint.mock.invocationCallOrder[ 0 ] ?? Number.POSITIVE_INFINITY,
		);
	} );

	it( 'forwards each observed navigation with the final accessible configuration', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		const statisticsRuntime = createInertStatisticsRuntime();
		const { runtime } = createRuntime(
			now,
			configurationStorage,
			browser,
			undefined,
			undefined,
			statisticsRuntime,
		);
		const navigation = { tabId: 7, frameId: 0, url: 'https://example.com/' };
		await runtime.start();
		await runtime.readStatistics();
		statisticsRuntime.checkpoint.mockClear();

		await runtime.handleNavigation( navigation );
		await vi.waitFor( () => {
			expect( statisticsRuntime.checkpoint.mock.lastCall?.[ 0 ] )
				.toStrictEqual( EXAMPLE_CONFIGURATION );
			expect( statisticsRuntime.checkpoint.mock.lastCall?.[ 1 ] ).toMatchObject( {
				observedAtEpochMilliseconds: now.value,
				focusObservation: { navigation },
			} );
		} );
	} );

	it( 'exposes the bridge-backed statistics reset through the runtime', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const statisticsRuntime = createInertStatisticsRuntime();
		const { runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			new MemoryRuntimeBrowser(),
			undefined,
			undefined,
			statisticsRuntime,
		);

		await runtime.start();
		await runtime.readStatistics();
		statisticsRuntime.reset.mockClear();

		await expect( runtime.resetStatistics() ).resolves.toEqual( { status: 'unavailable' } );
		expect( statisticsRuntime.reset ).toHaveBeenCalledOnce();
	} );

	it( 'keeps queued statistics complete when a tab closes after its scope is removed', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( MULTI_SCOPE_CONFIGURATION );
		const { coordinator, runtime } = createRuntime( now, configurationStorage, browser );

		browser.tabs = [ { id: 7, incognito: false, url: 'https://independent.test/' } ];
		await runtime.start();
		await runtime.handleNavigation( {
			frameId: 0,
			tabId: 7,
			url: 'https://independent.test/',
		} );
		await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CHECKPOINT,
			documentVisible: true,
			displayedFocusedDurationMilliseconds: 1_000,
		}, 7, true );
		const deliveryBeforeRemoval = await coordinator.getStatisticsDelivery();

		expect( deliveryBeforeRemoval ).toMatchObject( {
			status: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
			outbox: [ { scopeId: 'scope_independent' } ],
		} );

		configurationStorage.configuration = GROUPED_CONFIGURATION;
		await runtime.handleTabRemoved( 7 );

		expect( await coordinator.getStatisticsDelivery() ).toEqual( deliveryBeforeRemoval );
		expect( ( await coordinator.getStates() )?.scope_independent?.type ).toBe(
			ProtectionStateType.IDLE,
		);
	} );

	it( 'reconciles a raced configuration revision before draining its departure fact', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		const statisticsRuntime = createInertStatisticsRuntime();
		const { coordinator, runtime } = createRuntime(
			now,
			configurationStorage,
			browser,
			undefined,
			undefined,
			statisticsRuntime,
		);
		browser.tabs = [ { id: 7, incognito: false, url: 'https://example.com/watch?v=1' } ];
		await runtime.start();
		await runtime.handleNavigation( {
			frameId: 0,
			phase: ProtectionRuntimeNavigationPhase.BEFORE_NAVIGATE,
			tabId: 7,
			url: 'https://example.com/',
		} );
		await runtime.readStatistics();
		statisticsRuntime.reconcileConfiguration.mockClear();
		statisticsRuntime.drainProtectionFacts.mockClear();
		const racedConfiguration = ProtectionConfigurationDocumentSchema.parse( {
			...EXAMPLE_CONFIGURATION,
			measurementRevisionsByScope: {
				scope_default: 'revision_raced_navigation',
			},
		} );
		configurationStorage.configuration = racedConfiguration;

		await runtime.handleNavigation( {
			frameId: 0,
			phase: ProtectionRuntimeNavigationPhase.BEFORE_NAVIGATE,
			tabId: 7,
			url: 'https://unprotected.test/',
		} );
		await runtime.handleNavigation( {
			frameId: 0,
			phase: ProtectionRuntimeNavigationPhase.COMMITTED,
			tabId: 7,
			transitionQualifiers: [],
			transitionType: 'link',
			url: 'https://unprotected.test/',
		} );
		await vi.waitFor( () => {
			expect( statisticsRuntime.drainProtectionFacts ).toHaveBeenCalled();
		} );

		expect( statisticsRuntime.reconcileConfiguration ).toHaveBeenCalledWith( racedConfiguration );
		expect( statisticsRuntime.reconcileConfiguration.mock.invocationCallOrder[ 0 ] ).toBeLessThan(
			statisticsRuntime.drainProtectionFacts.mock.invocationCallOrder[ 0 ] ?? Number.POSITIVE_INFINITY,
		);
		expect( statisticsRuntime.drainProtectionFacts ).toHaveBeenCalledWith( {
			lastBatchId: 'fact_batch_runtime_1',
		} );
		expect( await coordinator.getStatisticsDelivery() ).toMatchObject( {
			outbox: [ {
				measurementRevision: 'revision_raced_navigation',
				facts: [ { type: ProtectionFactType.RECONSIDERED_VISIT } ],
			} ],
		} );
	} );

	it( 'drains and checkpoints every non-navigation browser observation', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const statisticsRuntime = createInertStatisticsRuntime();
		const { runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
			undefined,
			undefined,
			statisticsRuntime,
		);
		await runtime.start();
		await runtime.readStatistics();
		const operations = [
			() => runtime.handlePageRequest( {
				type: InterruptionPageRequestType.CONNECT,
				documentVisible: true,
			}, 99, true ),
			() => runtime.handleTabRemoved( 99 ),
			() => runtime.handleFocusChanged(),
			() => runtime.handleClockTick(),
			() => runtime.handleConfigurationChanged(),
		] satisfies ReadonlyArray<() => Promise<unknown>>;

		for ( const operation of operations ) {
			statisticsRuntime.drainProtectionFacts.mockClear();
			statisticsRuntime.checkpoint.mockClear();

			await operation();
			await vi.waitFor( () => {
				expect( statisticsRuntime.checkpoint ).toHaveBeenCalledOnce();
			} );

			expect( statisticsRuntime.drainProtectionFacts ).toHaveBeenCalledOnce();
			expect( statisticsRuntime.checkpoint.mock.lastCall?.[ 0 ] )
				.toStrictEqual( EXAMPLE_CONFIGURATION );
			expect( statisticsRuntime.checkpoint.mock.lastCall?.[ 1 ] ).toMatchObject( {
				observedAtEpochMilliseconds: now.value,
				focusObservation: { focusedTabId: 7 },
			} );
		}
	} );

	it( 'keeps protection available when every statistics boundary rejects', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const statisticsRuntime = createInertStatisticsRuntime();
		statisticsRuntime.reconcileConfiguration.mockRejectedValue(
			new Error( 'Statistics configuration unavailable.' ),
		);
		statisticsRuntime.drainProtectionFacts.mockRejectedValue(
			new Error( 'Statistics delivery unavailable.' ),
		);
		statisticsRuntime.checkpoint.mockRejectedValue(
			new Error( 'Statistics checkpoint unavailable.' ),
		);
		const { coordinator, runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
			undefined,
			undefined,
			statisticsRuntime,
		);

		await runtime.start();
		await runtime.handleNavigation( {
			tabId: 7,
			frameId: 0,
			url: 'https://example.com/',
		} );

		expect( ( await coordinator.getStates() )?.scope_default?.type ).toBe(
			ProtectionStateType.WAITING,
		);
		expect( browser.tabs ).toEqual( [ {
			id: 7,
			incognito: false,
			url: 'chrome-extension://extension-id/interruption.html',
		} ] );
	} );

	it( 'keeps protection available when statistics delivery-boundary capture throws', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { coordinator, runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);

		await runtime.start();
		vi.spyOn( coordinator, 'getStatisticsDeliveryBoundary' ).mockImplementation( () => {
			throw new Error( 'Statistics boundary unavailable.' );
		} );

		await expect( runtime.handleNavigation( {
			tabId: 7,
			frameId: 0,
			url: 'https://example.com/',
		} ) ).resolves.toBeUndefined();
		expect( ( await coordinator.getStates() )?.scope_default?.type ).toBe(
			ProtectionStateType.WAITING,
		);
		expect( browser.tabs ).toEqual( [ {
			id: 7,
			incognito: false,
			url: 'chrome-extension://extension-id/interruption.html',
		} ] );
	} );

	it( 'protects navigation without waiting for a pending statistics observation', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const statisticsRuntime = createInertStatisticsRuntime();
		const { runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
			undefined,
			undefined,
			statisticsRuntime,
		);

		await runtime.start();
		await runtime.readStatistics();
		const pendingStatistics = new DeferredPromise();
		statisticsRuntime.reconcileConfiguration.mockImplementation( () => pendingStatistics.promise );
		let navigationCompleted = false;
		const navigation = runtime.handleNavigation( {
			tabId: 7,
			frameId: 0,
			url: 'https://example.com/',
		} ).then( () => {
			navigationCompleted = true;
		} );

		await waitForQueuedWork();
		const completedBeforeStatistics = navigationCompleted;
		const tabsBeforeStatistics = browser.tabs;
		pendingStatistics.resolve();
		await navigation;

		expect( completedBeforeStatistics ).toBe( true );
		expect( tabsBeforeStatistics ).toEqual( [ {
			id: 7,
			incognito: false,
			url: 'chrome-extension://extension-id/interruption.html',
		} ] );
	} );

	it( 'protects navigation without waiting for a pending statistics read', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const statisticsRuntime = createInertStatisticsRuntime();
		const { runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
			undefined,
			undefined,
			statisticsRuntime,
		);

		await runtime.start();
		await runtime.readStatistics();
		statisticsRuntime.reconcileConfiguration.mockClear();
		const pendingStatistics = new DeferredPromise();
		statisticsRuntime.reconcileConfiguration.mockImplementation( () => pendingStatistics.promise );
		const statisticsRead = runtime.readStatistics();

		await vi.waitFor( () => {
			expect( statisticsRuntime.reconcileConfiguration ).toHaveBeenCalled();
		} );
		let navigationCompleted = false;
		const navigation = runtime.handleNavigation( {
			tabId: 7,
			frameId: 0,
			url: 'https://example.com/',
		} ).then( () => {
			navigationCompleted = true;
		} );

		await waitForQueuedWork();
		const completedBeforeStatistics = navigationCompleted;
		const tabsBeforeStatistics = browser.tabs;
		pendingStatistics.resolve();
		await Promise.all( [ statisticsRead, navigation ] );

		expect( completedBeforeStatistics ).toBe( true );
		expect( tabsBeforeStatistics ).toEqual( [ {
			id: 7,
			incognito: false,
			url: 'chrome-extension://extension-id/interruption.html',
		} ] );
	} );

	it( 'closes a superseded blur boundary without backdating refocus', async () => {
		const initialTime = Date.UTC( 2026, 8, 2, 12 );
		const now = { value: initialTime };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		const statisticsRuntime = createInertStatisticsRuntime();
		const observedCheckpoints: StatisticsCheckpointObservation[] = [];
		const { runtime } = createRuntime(
			now,
			configurationStorage,
			browser,
			undefined,
			undefined,
			statisticsRuntime,
		);

		await runtime.start();
		await runtime.readStatistics();
		statisticsRuntime.checkpoint.mockClear();
		statisticsRuntime.checkpoint.mockImplementation( ( _configuration, observation ) => {
			observedCheckpoints.push( observation );
			return Promise.resolve();
		} );
		browser.tabs = [ { id: 7, incognito: false, url: 'https://example.com/' } ];
		const pendingProtection = new DeferredPromise();
		const loadConfiguration = vi.spyOn( configurationStorage, 'load' ).mockImplementationOnce(
			() => pendingProtection.promise.then( () => EXAMPLE_CONFIGURATION ),
		);
		const clockTick = runtime.handleClockTick();

		await vi.waitFor( () => {
			expect( loadConfiguration ).toHaveBeenCalled();
		} );
		now.value = initialTime + 10_000;
		browser.focusedTabId = null;
		const blur = runtime.handleFocusChanged();
		now.value = initialTime + 20_000;
		browser.focusedTabId = 7;
		const refocus = runtime.handleFocusChanged();
		now.value = initialTime + 50_000;
		pendingProtection.resolve();
		await Promise.all( [ clockTick, blur, refocus ] );
		await vi.waitFor( () => {
			expect( statisticsRuntime.checkpoint ).toHaveBeenCalledTimes( 3 );
		} );

		expect( observedCheckpoints.slice( -2 ) ).toMatchObject( [
			{
				observedAtEpochMilliseconds: initialTime + 10_000,
				focusObservation: null,
			},
			{
				observedAtEpochMilliseconds: initialTime + 20_000,
				focusObservation: {
					focusedAtEpochMilliseconds: initialTime + 50_000,
					focusedTabId: 7,
				},
			},
		] );
	} );

	it( 'uses a controller-captured observation after capability work delays runtime entry', async () => {
		const initialTime = Date.UTC( 2026, 8, 2, 12 );
		const now = { value: initialTime };
		const browser = new MemoryRuntimeBrowser();
		const statisticsRuntime = createInertStatisticsRuntime();
		const { runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
			undefined,
			undefined,
			statisticsRuntime,
		);

		await runtime.start();
		await runtime.readStatistics();
		statisticsRuntime.checkpoint.mockClear();
		now.value = initialTime + 10_000;
		browser.focusedTabId = null;
		const observation = runtime.captureStatisticsObservation(
			StatisticsFocusObservationMode.BOUNDARY,
		);
		now.value = initialTime + 50_000;
		browser.focusedTabId = 7;
		await runtime.handleFocusChanged( observation );
		await vi.waitFor( () => {
			expect( statisticsRuntime.checkpoint ).toHaveBeenCalledOnce();
		} );

		expect( statisticsRuntime.checkpoint.mock.lastCall?.[ 1 ] ).toMatchObject( {
			observedAtEpochMilliseconds: initialTime + 10_000,
			focusObservation: { focusedTabId: null },
		} );
	} );
} );
