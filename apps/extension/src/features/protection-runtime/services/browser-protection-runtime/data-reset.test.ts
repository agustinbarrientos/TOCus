import { describe, expect, it, vi } from 'vitest';
import { TestEmptyProtectionConfiguration } from '../../../../domains/protection/types/__fixtures__';
import { StatisticsFocusObservationMode } from '../../../../domains/statistics/utils/prepare-statistics-checkpoint';
import { InterruptionPageRequestType } from '../../types/runtime-message';
import { ProtectedPageMessageType } from '../../types/protected-page-message';
import {
	DeferredPromise,
	EXAMPLE_CONFIGURATION,
	MemoryConfigurationStorage,
	MemoryProtectionStorage,
	MemoryRuntimeBrowser,
	completeFocusedPause,
	createRuntime,
	waitForQueuedWork,
} from './__fixtures__';
import { createInertStatisticsRuntime } from './__fixtures__/statistics-runtime';

describe( 'browser protection runtime local data reset', () => {
	it( 'keeps cold startup free of observations and persistence until resumed', async () => {
		const statisticsRuntime = createInertStatisticsRuntime();
		const storage = new MemoryProtectionStorage();
		const browser = new MemoryRuntimeBrowser();
		const { runtime } = createRuntime(
			{ value: 200_000 },
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
			storage,
			undefined,
			statisticsRuntime,
			true,
		);

		await runtime.start();
		await runtime.handleConfigurationChanged();
		await runtime.failOpen();
		await expect( runtime.readStatistics() ).resolves.toEqual( { status: 'unavailable' } );
		await expect( runtime.resetStatistics() ).resolves.toEqual( { status: 'unavailable' } );
		await expect( runtime.captureStatisticsObservation( StatisticsFocusObservationMode.BOUNDARY ) )
			.resolves.toEqual( {
				observedAtEpochMilliseconds: null, focusObservation: null, focusEpochTransition: null,
			} );
		expect( statisticsRuntime.beginFocusObservation ).not.toHaveBeenCalled();
		expect( storage.state ).toEqual( {} );
		expect( browser.rules ).toEqual( [] );

		await runtime.resumeAfterDataReset();
		expect( storage.state ).toEqual( {} );
		await runtime.start();
		expect( browser.rules.length ).toBeGreaterThan( 0 );
	} );

	it( 'releases retained destinations before forgetting state without persisting a reset', async () => {
		const configuration = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		const storage = new MemoryProtectionStorage();
		const browser = new MemoryRuntimeBrowser();
		const { coordinator, runtime } = createRuntime( { value: 200_000 }, configuration, browser, storage );
		await runtime.start();
		await runtime.handleNavigation( { frameId: 0, tabId: 7, url: 'https://example.com/watch?v=1' } );
		const retainedState = structuredClone( storage.state );

		await runtime.suspendForDataReset();
		expect( browser.rules ).toEqual( [] );
		expect( browser.protectionClockDeadlines ).toEqual( [] );
		expect( browser.tabs[ 0 ]?.url ).toBe( 'https://example.com/watch?v=1' );
		expect( storage.state ).toEqual( retainedState );

		storage.state = {};
		configuration.configuration = TestEmptyProtectionConfiguration;
		await runtime.resumeAfterDataReset();
		expect( storage.state ).toEqual( {} );
		await expect( coordinator.getStates() ).resolves.toBeNull();
		await expect( coordinator.getStatisticsDelivery() ).resolves.toBeNull();
		expect( coordinator.getSessionContinuityId() ).toBeNull();
		await expect( runtime.readSnapshot() ).resolves.toBeNull();
		await runtime.start();
		await expect( coordinator.getStates() ).resolves.toEqual( {} );
		expect( browser.rules ).toEqual( [] );
	} );

	it.each( [ 'waiting', 'ready' ] )( 'releases persisted %s destinations after worker restart without writes', async ( phase ) => {
		const configuration = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		const storage = new MemoryProtectionStorage();
		const browser = new MemoryRuntimeBrowser();
		const clock = { value: 200_000 };
		const { runtime } = createRuntime( clock, configuration, browser, storage );
		await runtime.start();
		await runtime.handleNavigation( { frameId: 0, tabId: 7, url: 'https://example.com/watch?v=1' } );

		if ( phase === 'ready' ) {
			await completeFocusedPause( runtime, 7, 10_000 );
		}

		await runtime.readStatistics();
		clock.value += 10_000_000;
		storage.state = { session: storage.state.session };
		const retainedState = structuredClone( storage.state );
		const restarted = createRuntime( clock, configuration, browser, storage, undefined, undefined, true );

		await restarted.runtime.suspendForDataReset();
		expect( browser.tabs[ 0 ]?.url ).toBe( 'https://example.com/watch?v=1' );
		expect( storage.state ).toEqual( retainedState );
		await expect( restarted.coordinator.getStates() ).resolves.toBeNull();
	} );

	it( 'discards queued page and navigation work while draining a started operation', async () => {
		const configuration = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		const browser = new MemoryRuntimeBrowser();
		const { coordinator, runtime } = createRuntime( { value: 200_000 }, configuration, browser );
		await runtime.start();
		await runtime.readStatistics();
		const started = new DeferredPromise();
		const release = new DeferredPromise();
		vi.spyOn( configuration, 'load' ).mockImplementationOnce( async () => {
			started.resolve();
			await release.promise;
			return EXAMPLE_CONFIGURATION;
		} );
		const current = runtime.handleConfigurationChanged();
		await started.promise;
		const queued = runtime.handleNavigation( { frameId: 0, tabId: 7, url: 'https://example.com/' } );
		const page = runtime.handlePageRequest( { type: InterruptionPageRequestType.SYNCHRONIZE }, 7, true );
		const suspension = runtime.suspendForDataReset();
		await runtime.handleFocusChanged();
		await runtime.handleTabRemoved( 7 );
		await runtime.handleClockTick();
		await runtime.refreshToolbarBadge();
		release.resolve();
		await Promise.all( [ current, queued, suspension ] );

		await expect( page ).resolves.toEqual( { state: 'unavailable' } );
		await expect( coordinator.getStates() ).resolves.toEqual( {} );
		expect( browser.navigations ).toEqual( [] );
		expect( browser.rules ).toEqual( [] );
	} );

	it( 'waits for active statistics and ingress focus writes while refusing additional reads', async () => {
		const statisticsRuntime = createInertStatisticsRuntime();
		const { runtime } = createRuntime(
			{ value: 200_000 },
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			new MemoryRuntimeBrowser(),
			undefined,
			undefined,
			statisticsRuntime,
		);
		await runtime.start();
		await runtime.readStatistics();
		const readStarted = new DeferredPromise();
		const releaseRead = new DeferredPromise();
		const releaseFocus = new DeferredPromise();
		statisticsRuntime.reconcileConfiguration.mockImplementationOnce( async () => {
			readStarted.resolve();
			await releaseRead.promise;
		} );
		statisticsRuntime.beginFocusObservation.mockImplementationOnce( async () => {
			await releaseFocus.promise;
			return null;
		} );
		const observation = runtime.captureStatisticsObservation( StatisticsFocusObservationMode.BOUNDARY );
		const read = runtime.readStatistics();
		await readStarted.promise;
		const queuedRead = runtime.readStatistics();
		let suspended = false;
		const suspension = runtime.suspendForDataReset().then( () => {
			suspended = true;
		} );
		await expect( runtime.readStatistics() ).resolves.toEqual( { status: 'unavailable' } );
		await expect( runtime.resetStatistics() ).resolves.toEqual( { status: 'unavailable' } );
		releaseRead.resolve();
		await waitForQueuedWork();
		expect( suspended ).toBe( false );
		releaseFocus.resolve();
		await Promise.all( [ observation, suspension ] );
		await expect( read ).resolves.toEqual( { status: 'unavailable' } );
		await expect( queuedRead ).resolves.toEqual( { status: 'unavailable' } );
	} );

	it( 'keeps intake suspended after cleanup failure and retries cleanup safely', async () => {
		const browser = new MemoryRuntimeBrowser();
		const { runtime } = createRuntime(
			{ value: 200_000 }, new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ), browser,
		);
		await runtime.start();
		const replacement = vi.spyOn( browser, 'replaceNavigationRules' );
		replacement.mockRejectedValueOnce( new Error( 'Browser cleanup unavailable.' ) );
		await expect( runtime.suspendForDataReset() ).rejects.toThrow( 'Failed to remove protection navigation rules.' );
		await runtime.start();
		await expect( runtime.readSnapshot() ).resolves.toBeNull();
		await runtime.suspendForDataReset();
		await runtime.suspendForDataReset();
		expect( browser.rules ).toEqual( [] );
	} );

	it.each( [ 'synchronizeProtectionClock', 'updateToolbarBadge' ] as const )(
		'requires successful %s cleanup before reset can continue',
		async ( method ) => {
			const browser = new MemoryRuntimeBrowser();
			const { runtime } = createRuntime(
				{ value: 200_000 }, new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ), browser,
			);
			await runtime.start();
			vi.spyOn( browser, method ).mockRejectedValueOnce( new Error( 'Browser cleanup failed.' ) );

			await expect( runtime.suspendForDataReset() ).rejects.toThrow( 'Failed to clear protection browser effects.' );
			await runtime.start();
			await expect( runtime.readSnapshot() ).resolves.toBeNull();
			await expect( runtime.suspendForDataReset() ).resolves.toBeUndefined();
		},
	);

	it( 'requires successful warning and expiry guard cleanup before reset can continue', async () => {
		const browser = new MemoryRuntimeBrowser();
		const { runtime } = createRuntime(
			{ value: 200_000 }, new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ), browser,
		);
		await runtime.start();
		const updatePresentation = browser.updateProtectedPagePresentation;
		const update = vi.spyOn( browser, 'updateProtectedPagePresentation' ).mockImplementation( ( tabId, message ) => {
			return message.type === ProtectedPageMessageType.REMOVE_ALLOWANCE_EXPIRY_GUARD
				? Promise.reject( new Error( 'Warning cleanup failed.' ) )
				: updatePresentation( tabId, message );
		} );

		await expect( runtime.suspendForDataReset() ).rejects.toThrow( 'Failed to clear protection browser effects.' );
		await expect( runtime.readSnapshot() ).resolves.toBeNull();
		expect( update ).toHaveBeenCalledWith( 7, {
			type: ProtectedPageMessageType.REMOVE_ALLOWANCE_EXPIRY_GUARD,
		}, true );
		expect( update ).toHaveBeenCalledWith( 7, {
			type: ProtectedPageMessageType.REMOVE_INTERRUPTION_LAYER,
		}, true );
		update.mockRestore();
		await expect( runtime.suspendForDataReset() ).resolves.toBeUndefined();
	} );

	it( 'ignores controller-delayed events captured before or during reset after resuming', async () => {
		const browser = new MemoryRuntimeBrowser();
		const { coordinator, runtime } = createRuntime(
			{ value: 200_000 }, new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ), browser,
		);
		await runtime.start();
		const oldObservation = runtime.captureStatisticsObservation( StatisticsFocusObservationMode.BOUNDARY );
		await runtime.suspendForDataReset();
		const suspendedObservation = runtime.captureStatisticsObservation( StatisticsFocusObservationMode.BOUNDARY );
		await runtime.resumeAfterDataReset();
		await runtime.start();
		await runtime.handleNavigation(
			{ frameId: 0, tabId: 7, url: 'https://example.com/' }, oldObservation,
		);
		await runtime.handleNavigation(
			{ frameId: 0, tabId: 7, url: 'https://example.com/' }, suspendedObservation,
		);

		await expect( coordinator.getStates() ).resolves.toEqual( {} );
		expect( browser.navigations ).toEqual( [] );
	} );
} );
