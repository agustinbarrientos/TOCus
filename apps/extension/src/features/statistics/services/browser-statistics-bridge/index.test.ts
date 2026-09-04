import { describe, expect, it, vi } from 'vitest';
import {
	ProtectionCoordinatorInitializationStatus,
	type ProtectionCoordinator,
} from '../../../../domains/protection/services/protection-coordinator';
import {
	TestEmptyProtectionConfiguration,
	createIdleState,
} from '../../../../domains/protection/types/__fixtures__';
import {
	ProtectionConfigurationDocumentSchema,
	type ProtectionConfigurationDocument,
} from '../../../../domains/protection/types/protected-site-configuration';
import {
	DefaultProtectionScopeId,
	ProtectionFactBatchIdSchema,
} from '../../../../domains/protection/types/protection-value';
import { StoredProtectionStatisticsDeliveryStatus } from '../../../../domains/protection/types/stored-protection-statistics-delivery';
import {
	StatisticsProjectionStatus,
	type StatisticsProjection,
} from '../../../../domains/statistics/types/statistics-projection';
import { StatisticsFocusEpochIdSchema } from '../../../../domains/statistics/types/statistics-value';
import {
	type ProtectionRuntimeBrowser,
	type ProtectionRuntimeTab,
} from '../../../protection-runtime/types/browser-runtime';
import {
	type StatisticsCheckpointObservation,
	type StatisticsRuntime,
} from '../statistics-runtime';
import { StatisticsFocusObservationMode } from '../../../../domains/statistics/utils/prepare-statistics-checkpoint';
import { createBrowserStatisticsBridge } from './index';
import { type BrowserStatisticsBridge } from './types';

/**
 * Single-site configuration used by bridge tests.
 * @since 0.1.0 Initial implementation.
 */
const EXAMPLE_CONFIGURATION = ProtectionConfigurationDocumentSchema.parse( {
	...TestEmptyProtectionConfiguration,
	sites: [ {
		identityHost: 'example.com',
		rule: {
			host: 'example.com',
			includeSubdomains: true,
			scopeId: DefaultProtectionScopeId,
		},
	} ],
} );

/**
 * Available projection returned by read and reset tests.
 * @since 0.1.0 Initial implementation.
 */
const AVAILABLE_PROJECTION: StatisticsProjection = {
	status: StatisticsProjectionStatus.AVAILABLE,
	estimatedReclaimedMilliseconds: 120_000,
	focusedPauseMilliseconds: 8_000,
	reconsideredVisitCount: 3,
	completedWaitCount: 2,
	allowanceGrantedCount: 2,
};

/**
 * Mutable wall clock used by bridge tests.
 * @since 0.1.0 Initial implementation.
 */
interface MutableClock {
	error: Error | null;
	value: number;
}

/**
 * Inspectable browser boundary used by bridge tests.
 * @since 0.1.0 Initial implementation.
 */
interface BrowserDouble extends Pick<ProtectionRuntimeBrowser, 'getFocusedTabId' | 'listTabs'> {
	getFocusedTabId: ReturnType<typeof vi.fn<ProtectionRuntimeBrowser[ 'getFocusedTabId' ]>>;
	listTabs: ReturnType<typeof vi.fn<ProtectionRuntimeBrowser[ 'listTabs' ]>>;
}

/**
 * Inspectable coordinator boundary used by bridge tests.
 * @since 0.1.0 Initial implementation.
 */
interface CoordinatorDouble extends Pick<
	ProtectionCoordinator,
	'getStates' |
	'getStatisticsDelivery' |
	'getStatisticsDeliveryBoundary' |
	'initialize'
> {
	getStates: ReturnType<typeof vi.fn<ProtectionCoordinator[ 'getStates' ]>>;
	getStatisticsDelivery: ReturnType<typeof vi.fn<ProtectionCoordinator[ 'getStatisticsDelivery' ]>>;
	getStatisticsDeliveryBoundary: ReturnType<
		typeof vi.fn<ProtectionCoordinator[ 'getStatisticsDeliveryBoundary' ]>
	>;
	initialize: ReturnType<typeof vi.fn<ProtectionCoordinator[ 'initialize' ]>>;
}

/**
 * Inspectable statistics runtime used by bridge tests.
 * @since 0.1.0 Initial implementation.
 */
interface StatisticsRuntimeDouble extends StatisticsRuntime {
	beginFocusObservation: ReturnType<typeof vi.fn<StatisticsRuntime[ 'beginFocusObservation' ]>>;
	checkpoint: ReturnType<typeof vi.fn<StatisticsRuntime[ 'checkpoint' ]>>;
	discardFocusMeasurement: ReturnType<typeof vi.fn<StatisticsRuntime[ 'discardFocusMeasurement' ]>>;
	drainProtectionFacts: ReturnType<typeof vi.fn<StatisticsRuntime[ 'drainProtectionFacts' ]>>;
	getSnapshot: ReturnType<typeof vi.fn<StatisticsRuntime[ 'getSnapshot' ]>>;
	reconcileConfiguration: ReturnType<typeof vi.fn<StatisticsRuntime[ 'reconcileConfiguration' ]>>;
	reset: ReturnType<typeof vi.fn<StatisticsRuntime[ 'reset' ]>>;
}

/**
 * Complete dependencies returned to one bridge test.
 * @since 0.1.0 Initial implementation.
 */
interface BridgeHarness {
	bridge: BrowserStatisticsBridge;
	browser: BrowserDouble;
	clock: MutableClock;
	configurationStorage: {
		load: ReturnType<typeof vi.fn<() => Promise<ProtectionConfigurationDocument | null>>>;
	};
	coordinator: CoordinatorDouble;
	statisticsRuntime: StatisticsRuntimeDouble;
}

/**
 * Promise whose completion is controlled by one bridge test.
 * @since 0.1.0 Initial implementation.
 */
class DeferredPromise {
	/**
	 * Promise controlled by this deferred test boundary.
	 * @since 0.1.0 Initial implementation.
	 */
	readonly promise: Promise<void>;

	private resolvePromise: ( () => void ) | null = null;

	/**
	 * Creates one unresolved promise.
	 * @since 0.1.0 Initial implementation.
	 */
	constructor() {
		this.promise = new Promise<void>( ( resolve ) => {
			this.resolvePromise = resolve;
		} );
	}

	/**
	 * Resolves the pending promise once.
	 * @since 0.1.0 Initial implementation.
	 */
	resolve(): void {
		this.resolvePromise?.();
		this.resolvePromise = null;
	}
}

/**
 * Creates an inspectable statistics runtime for bridge tests.
 * @return Statistics runtime with deterministic default behavior.
 * @since 0.1.0 Initial implementation.
 */
function createStatisticsRuntime(): StatisticsRuntimeDouble {
	const focusEpochId = StatisticsFocusEpochIdSchema.parse( 'focus_epoch_current' );

	return {
		beginFocusObservation: vi.fn().mockImplementation( (
			mode: Parameters<StatisticsRuntime[ 'beginFocusObservation' ]>[ 0 ],
		) => Promise.resolve( {
			mode,
			previousFocusEpochId: mode === StatisticsFocusObservationMode.STARTUP
				? null
				: focusEpochId,
			currentFocusEpochId: focusEpochId,
		} ) ),
		checkpoint: vi.fn().mockResolvedValue( undefined ),
		drainProtectionFacts: vi.fn().mockResolvedValue( undefined ),
		discardFocusMeasurement: vi.fn().mockResolvedValue( undefined ),
		getSnapshot: vi.fn().mockReturnValue( {
			deliveryStatus: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
			focusMeasurementEnabled: false,
			projection: AVAILABLE_PROJECTION,
		} ),
		reconcileConfiguration: vi.fn().mockResolvedValue( undefined ),
		reset: vi.fn().mockResolvedValue( true ),
	};
}

/**
 * Creates one bridge with deterministic local dependencies.
 * @param rawConfiguration - Raw protection configuration returned by storage.
 * @return Inspectable bridge test harness.
 * @since 0.1.0 Initial implementation.
 */
function createBridgeHarness(
	rawConfiguration: ProtectionConfigurationDocument | null = EXAMPLE_CONFIGURATION,
): BridgeHarness {
	const clock: MutableClock = { error: null, value: Date.UTC( 2026, 8, 2, 12 ) };
	const browser: BrowserDouble = {
		getFocusedTabId: vi.fn().mockResolvedValue( 7 ),
		listTabs: vi.fn().mockResolvedValue( [ {
			id: 7,
			incognito: false,
			url: 'https://example.com/',
		} ] ),
	};
	const configurationStorage = {
		load: vi.fn<() => Promise<ProtectionConfigurationDocument | null>>()
			.mockResolvedValue( rawConfiguration ),
	};
	const coordinator: CoordinatorDouble = {
		getStates: vi.fn().mockResolvedValue( {} ),
		getStatisticsDelivery: vi.fn().mockResolvedValue( {
			status: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
			outbox: [],
		} ),
		getStatisticsDeliveryBoundary: vi.fn().mockReturnValue( { lastBatchId: null } ),
		initialize: vi.fn().mockResolvedValue( {
			status: ProtectionCoordinatorInitializationStatus.READY,
			decisions: [],
			facts: [],
			requirements: [],
		} ),
	};
	const statisticsRuntime = createStatisticsRuntime();

	/**
	 * Returns the mutable test clock or its configured failure.
	 * @return Current test epoch milliseconds.
	 * @since 0.1.0 Initial implementation.
	 */
	function now(): number {
		if ( clock.error !== null ) {
			throw clock.error;
		}

		return clock.value;
	}

	return {
		bridge: createBrowserStatisticsBridge( {
			browser,
			configurationStorage,
			coordinator,
			now,
			statisticsRuntime,
		} ),
		browser,
		clock,
		configurationStorage,
		coordinator,
		statisticsRuntime,
	};
}

describe( 'createBrowserStatisticsBridge', () => {
	it( 'starts a focus boundary before asynchronously inspecting browser focus', async () => {
		const { bridge, browser, statisticsRuntime } = createBridgeHarness();

		await bridge.captureObservation( StatisticsFocusObservationMode.BOUNDARY );

		expect( statisticsRuntime.beginFocusObservation.mock.invocationCallOrder[ 0 ] ).toBeLessThan(
			browser.getFocusedTabId.mock.invocationCallOrder[ 0 ] ?? Number.POSITIVE_INFINITY,
		);
		expect( statisticsRuntime.beginFocusObservation.mock.invocationCallOrder[ 0 ] ).toBeLessThan(
			browser.listTabs.mock.invocationCallOrder[ 0 ] ?? Number.POSITIVE_INFINITY,
		);
	} );

	it( 'does not backdate protected focus when a private-tab boundary is superseded', async () => {
		const initialTime = Date.UTC( 2026, 8, 2, 12 );
		const { bridge, browser, clock } = createBridgeHarness();
		const delayedPrivateBoundaryFocusRead = Promise.withResolvers<number | null>();

		browser.listTabs.mockResolvedValue( [
			{
				id: 7,
				incognito: false,
				url: 'https://example.com/',
				windowId: 1,
			},
			{
				id: 8,
				incognito: true,
				url: 'https://private.example/',
				windowId: 1,
			},
		] );
		const initialProtectedObservation = await bridge.captureObservation(
			StatisticsFocusObservationMode.BOUNDARY,
			undefined,
			{ tabId: 7, windowId: 1 },
		);

		browser.getFocusedTabId
			.mockReturnValueOnce( delayedPrivateBoundaryFocusRead.promise )
			.mockResolvedValueOnce( 7 );

		clock.value = initialTime + 10_000;
		const privateBoundary = bridge.captureObservation(
			StatisticsFocusObservationMode.BOUNDARY,
			undefined,
			{ tabId: 8, windowId: 1 },
		);
		clock.value = initialTime + 20_000;
		const protectedBoundary = bridge.captureObservation(
			StatisticsFocusObservationMode.BOUNDARY,
			undefined,
			{ tabId: 7, windowId: 1 },
		);
		clock.value = initialTime + 21_000;
		const protectedObservation = await protectedBoundary;
		clock.value = initialTime + 30_000;
		delayedPrivateBoundaryFocusRead.resolve( 7 );
		const privateObservation = await privateBoundary;

		expect( initialProtectedObservation ).toMatchObject( {
			observedAtEpochMilliseconds: initialTime,
			focusObservation: {
				focusedAtEpochMilliseconds: initialTime,
				focusedTabId: 7,
			},
		} );
		expect( privateObservation ).toMatchObject( {
			observedAtEpochMilliseconds: initialTime + 10_000,
			focusObservation: null,
		} );
		expect( protectedObservation ).toMatchObject( {
			observedAtEpochMilliseconds: initialTime + 20_000,
			focusObservation: {
				focusedAtEpochMilliseconds: initialTime + 21_000,
				focusedTabId: 7,
			},
		} );
	} );

	it.each( [
		[ 'tab', { tabId: 8, windowId: 1 } ],
		[ 'window', { tabId: 7, windowId: 2 } ],
	] )( 'rejects a focus snapshot that does not match the triggering %s', async ( _, focusEvent ) => {
		const { bridge, browser } = createBridgeHarness();

		browser.listTabs.mockResolvedValue( [ {
			id: 7,
			incognito: false,
			url: 'https://example.com/',
			windowId: 1,
		} ] );

		await expect( bridge.captureObservation(
			StatisticsFocusObservationMode.BOUNDARY,
			undefined,
			focusEvent,
		) ).resolves.toMatchObject( { focusObservation: null } );
	} );

	it.each( [
		[ 'a malformed marker', null ],
		[ 'an unsafe window', { windowId: Number.NaN } ],
		[ 'an invalid window', { windowId: -2 } ],
		[ 'an unsafe tab', { tabId: Number.NaN, windowId: 1 } ],
		[ 'an invalid tab', { tabId: -1, windowId: 1 } ],
	] )( 'rejects a focus snapshot for %s', async ( _, focusEvent ) => {
		const { bridge } = createBridgeHarness();

		await expect( bridge.captureObservation(
			StatisticsFocusObservationMode.BOUNDARY,
			undefined,
			focusEvent,
		) ).resolves.toMatchObject( { focusObservation: null } );
	} );

	it.each( [
		[ 'matching browser blur', { windowId: -1 }, false ],
		[ 'stale window focus', { windowId: 1 }, true ],
		[ 'stale tab focus', { tabId: 7, windowId: -1 }, true ],
	] )( 'handles %s while no browser window is focused', async ( _, focusEvent, unavailable ) => {
		const { bridge, browser } = createBridgeHarness();

		browser.getFocusedTabId.mockResolvedValue( null );
		const observation = await bridge.captureObservation(
			StatisticsFocusObservationMode.BOUNDARY,
			undefined,
			focusEvent,
		);

		expect( observation.focusObservation === null ).toBe( unavailable );
	} );

	it( 'removes private and unknown tab details at browser observation capture', async () => {
		const { bridge, browser, clock } = createBridgeHarness();
		const tabs: ReadonlyArray<ProtectionRuntimeTab> = [
			{ id: 7, incognito: false, url: 'https://ordinary.example/' },
			{ id: 8, incognito: true, url: 'https://private.example/' },
			{ id: 9, url: 'https://unknown.example/' },
		];
		browser.getFocusedTabId.mockResolvedValue( 8 );
		browser.listTabs.mockResolvedValue( tabs );

		const observation = await bridge.captureObservation(
			StatisticsFocusObservationMode.BOUNDARY,
			{ tabId: 8, frameId: 0, url: 'https://private.example/path' },
		);

		expect( observation.focusObservation ).toEqual( {
			focusedAtEpochMilliseconds: clock.value,
			focusedTabId: null,
			tabs: [ { id: 7, incognito: false, url: 'https://ordinary.example/' } ],
		} );
	} );

	it.each( [ 'throws', 'rejects' ] as const )(
		'uses an unavailable observation when browser inspection %s',
		async ( scenario ) => {
			const { bridge, browser } = createBridgeHarness();

			if ( scenario === 'throws' ) {
				browser.getFocusedTabId.mockImplementation( () => {
					throw new Error( 'Focused tab unavailable.' );
				} );
			} else {
				browser.getFocusedTabId.mockRejectedValue( new Error( 'Focused tab unavailable.' ) );
			}

			await expect( bridge.captureObservation(
				StatisticsFocusObservationMode.BOUNDARY,
			) ).resolves.toMatchObject( { focusObservation: null } );
		},
	);

	it.each( [ 'throwing', 'rejected' ] as const )(
		'uses an unavailable observation when focus epoch persistence is %s',
		async ( scenario ) => {
			const { bridge, statisticsRuntime } = createBridgeHarness();

			if ( scenario === 'throwing' ) {
				statisticsRuntime.beginFocusObservation.mockImplementation( () => {
					throw new Error( 'Focus epoch unavailable.' );
				} );
			} else {
				statisticsRuntime.beginFocusObservation.mockRejectedValue(
					new Error( 'Focus epoch unavailable.' ),
				);
			}

			await expect( bridge.captureObservation(
				StatisticsFocusObservationMode.BOUNDARY,
			) ).resolves.toMatchObject( {
				focusEpochTransition: null,
				focusObservation: null,
			} );
		},
	);

	it.each( [ 'throwing', 'unsafe' ] as const )(
		'uses an unavailable observation for a %s event clock',
		async ( scenario ) => {
			const { bridge, browser, clock } = createBridgeHarness();
			if ( scenario === 'throwing' ) {
				clock.error = new Error( 'Clock unavailable.' );
			} else {
				clock.value = Number.NaN;
			}

			const observation = await bridge.captureObservation( StatisticsFocusObservationMode.BOUNDARY );

			expect( observation.observedAtEpochMilliseconds ).toBeNull();
			expect( observation.focusObservation ).toBeNull();
			expect( browser.getFocusedTabId ).not.toHaveBeenCalled();
		},
	);

	it( 'drains the captured delivery boundary before checkpointing', async () => {
		const { bridge, coordinator, statisticsRuntime } = createBridgeHarness();
		bridge.observeProtectionOperation(
			EXAMPLE_CONFIGURATION,
			bridge.captureObservation( StatisticsFocusObservationMode.BOUNDARY ),
		);

		await vi.waitFor( () => {
			expect( statisticsRuntime.checkpoint ).toHaveBeenCalledOnce();
		} );
		expect( statisticsRuntime.drainProtectionFacts ).toHaveBeenCalledWith( { lastBatchId: null } );
		expect( statisticsRuntime.drainProtectionFacts.mock.invocationCallOrder[ 0 ] ).toBeLessThan(
			statisticsRuntime.checkpoint.mock.invocationCallOrder[ 0 ] ?? Number.POSITIVE_INFINITY,
		);
		expect( coordinator.getStates ).toHaveBeenCalledOnce();
		expect( statisticsRuntime.checkpoint.mock.lastCall?.[ 0 ] ).toEqual( EXAMPLE_CONFIGURATION );
		expect( statisticsRuntime.checkpoint.mock.lastCall?.[ 1 ] ).toMatchObject( {
			focusObservation: { focusedTabId: 7 },
		} );
	} );

	it( 'contains synchronous delivery-boundary failures while scheduling observations', () => {
		const { bridge, coordinator } = createBridgeHarness();
		coordinator.getStatisticsDeliveryBoundary.mockImplementation( () => {
			throw new Error( 'Statistics boundary unavailable.' );
		} );

		expect( () => {
			bridge.observeProtectionOperation(
				EXAMPLE_CONFIGURATION,
				bridge.captureObservation( StatisticsFocusObservationMode.BOUNDARY ),
			);
		} ).not.toThrow();
	} );

	it( 'checkpoints an observation after fact draining rejects', async () => {
		const { bridge, statisticsRuntime } = createBridgeHarness();
		statisticsRuntime.drainProtectionFacts.mockRejectedValue(
			new Error( 'Statistics delivery unavailable.' ),
		);

		bridge.observeProtectionOperation(
			EXAMPLE_CONFIGURATION,
			bridge.captureObservation( StatisticsFocusObservationMode.BOUNDARY ),
		);

		await vi.waitFor( () => {
			expect( statisticsRuntime.checkpoint ).toHaveBeenCalledOnce();
		} );
	} );

	it( 'uses an unavailable observation when protection state inspection rejects', async () => {
		const { bridge, coordinator, statisticsRuntime } = createBridgeHarness();
		coordinator.getStates.mockRejectedValue( new Error( 'Protection state unavailable.' ) );
		bridge.observeProtectionOperation(
			EXAMPLE_CONFIGURATION,
			bridge.captureObservation( StatisticsFocusObservationMode.BOUNDARY ),
		);

		await vi.waitFor( () => {
			expect( statisticsRuntime.checkpoint ).toHaveBeenCalledOnce();
		} );
		expect( statisticsRuntime.checkpoint.mock.lastCall?.[ 1 ] ).toMatchObject( {
			focusObservation: null,
		} );
	} );

	it( 'reconciles raw configuration before a subsequently queued observation', async () => {
		const { bridge, statisticsRuntime } = createBridgeHarness();
		bridge.reconcileConfiguration( EXAMPLE_CONFIGURATION );
		bridge.observeProtectionOperation(
			EXAMPLE_CONFIGURATION,
			bridge.captureObservation( StatisticsFocusObservationMode.STARTUP ),
		);

		await vi.waitFor( () => {
			expect( statisticsRuntime.checkpoint ).toHaveBeenCalledOnce();
		} );
		expect( statisticsRuntime.reconcileConfiguration.mock.invocationCallOrder[ 0 ] ).toBeLessThan(
			statisticsRuntime.drainProtectionFacts.mock.invocationCallOrder[ 0 ] ?? Number.POSITIVE_INFINITY,
		);
	} );

	it( 'reads local statistics without starting browser protection', async () => {
		const { bridge, configurationStorage, coordinator, statisticsRuntime } = createBridgeHarness();

		await expect( bridge.readStatistics() ).resolves.toEqual( AVAILABLE_PROJECTION );
		expect( configurationStorage.load ).toHaveBeenCalledOnce();
		expect( statisticsRuntime.reconcileConfiguration ).toHaveBeenCalledWith( EXAMPLE_CONFIGURATION );
		expect( statisticsRuntime.drainProtectionFacts ).toHaveBeenCalledWith( { lastBatchId: null } );
		expect( coordinator.initialize ).not.toHaveBeenCalled();
	} );

	it( 'returns unavailable when statistics configuration cannot be read', async () => {
		const { bridge, configurationStorage, statisticsRuntime } = createBridgeHarness();
		configurationStorage.load.mockRejectedValue( new Error( 'Configuration unavailable.' ) );

		await expect( bridge.readStatistics() ).resolves.toEqual( {
			status: StatisticsProjectionStatus.UNAVAILABLE,
		} );
		expect( statisticsRuntime.reconcileConfiguration ).toHaveBeenCalledWith( null );
	} );

	it( 'returns unavailable when statistics configuration reconciliation rejects', async () => {
		const { bridge, statisticsRuntime } = createBridgeHarness();
		statisticsRuntime.reconcileConfiguration.mockRejectedValue(
			new Error( 'Statistics configuration unavailable.' ),
		);

		await expect( bridge.readStatistics() ).resolves.toEqual( {
			status: StatisticsProjectionStatus.UNAVAILABLE,
		} );
		expect( statisticsRuntime.drainProtectionFacts ).not.toHaveBeenCalled();
	} );

	it( 'returns unavailable when explicit fact draining rejects', async () => {
		const { bridge, statisticsRuntime } = createBridgeHarness();
		statisticsRuntime.drainProtectionFacts.mockRejectedValue(
			new Error( 'Statistics delivery unavailable.' ),
		);

		await expect( bridge.readStatistics() ).resolves.toEqual( {
			status: StatisticsProjectionStatus.UNAVAILABLE,
		} );
	} );

	it( 'returns unavailable when delivery-status inspection throws', async () => {
		const { bridge, statisticsRuntime } = createBridgeHarness();
		statisticsRuntime.getSnapshot.mockImplementation( () => {
			throw new Error( 'Statistics snapshot unavailable.' );
		} );

		await expect( bridge.readStatistics() ).resolves.toEqual( {
			status: StatisticsProjectionStatus.UNAVAILABLE,
		} );
	} );

	it( 'returns unavailable when lazy coordinator initialization rejects', async () => {
		const { bridge, coordinator } = createBridgeHarness();
		coordinator.getStatisticsDelivery.mockResolvedValue( null );
		coordinator.getStatisticsDeliveryBoundary.mockReturnValue( null );
		coordinator.initialize.mockRejectedValue( new Error( 'Statistics delivery unavailable.' ) );

		await expect( bridge.readStatistics() ).resolves.toEqual( {
			status: StatisticsProjectionStatus.UNAVAILABLE,
		} );
	} );

	it.each( [ 'malformed', 'throwing' ] as const )(
		'returns unavailable for a %s statistics snapshot',
		async ( scenario ) => {
			const { bridge, statisticsRuntime } = createBridgeHarness();
			if ( scenario === 'throwing' ) {
				statisticsRuntime.getSnapshot
					.mockReturnValueOnce( {
						deliveryStatus: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
						focusMeasurementEnabled: false,
						projection: AVAILABLE_PROJECTION,
					} )
					.mockImplementation( () => {
						throw new Error( 'Statistics snapshot unavailable.' );
					} );
			} else {
				const snapshot = {
					deliveryStatus: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
					focusMeasurementEnabled: false,
					projection: AVAILABLE_PROJECTION,
				};

				Reflect.set( snapshot, 'projection', { status: 'unsafe' } );
				statisticsRuntime.getSnapshot.mockReturnValue( snapshot );
			}

			await expect( bridge.readStatistics() ).resolves.toEqual( {
				status: StatisticsProjectionStatus.UNAVAILABLE,
			} );
		},
	);

	it( 'recovers its queue after a queued boundary lookup rejects', async () => {
		const { bridge, coordinator } = createBridgeHarness();
		coordinator.getStatisticsDelivery.mockResolvedValue( null );
		coordinator.getStatisticsDeliveryBoundary
			.mockReturnValueOnce( null )
			.mockImplementationOnce( () => {
				throw new Error( 'Statistics boundary unavailable.' );
			} );

		await expect( bridge.readStatistics() ).rejects.toThrow( 'Statistics boundary unavailable.' );
		coordinator.getStatisticsDeliveryBoundary.mockReturnValue( { lastBatchId: null } );
		await expect( bridge.readStatistics() ).resolves.toEqual( AVAILABLE_PROJECTION );
	} );

	it( 'resets statistics without draining the discarded delivery', async () => {
		const { bridge, statisticsRuntime } = createBridgeHarness();

		await expect( bridge.resetStatistics() ).resolves.toEqual( AVAILABLE_PROJECTION );
		expect( statisticsRuntime.reconcileConfiguration ).toHaveBeenCalledWith( EXAMPLE_CONFIGURATION );
		expect( statisticsRuntime.reset ).toHaveBeenCalledOnce();
		expect( statisticsRuntime.drainProtectionFacts ).not.toHaveBeenCalled();
	} );

	it( 'resets statistics without replacing malformed protection settings', async () => {
		const { bridge, statisticsRuntime } = createBridgeHarness( null );

		await expect( bridge.resetStatistics() ).resolves.toEqual( AVAILABLE_PROJECTION );
		expect( statisticsRuntime.reconcileConfiguration ).toHaveBeenCalledWith( null );
		expect( statisticsRuntime.reset ).toHaveBeenCalledOnce();
	} );

	it( 'returns unavailable when reset configuration cannot be read', async () => {
		const { bridge, configurationStorage, statisticsRuntime } = createBridgeHarness();
		configurationStorage.load.mockRejectedValue( new Error( 'Configuration unavailable.' ) );

		await expect( bridge.resetStatistics() ).resolves.toEqual( {
			status: StatisticsProjectionStatus.UNAVAILABLE,
		} );
		expect( statisticsRuntime.reset ).not.toHaveBeenCalled();
	} );

	it.each( [ 'failed', 'rejected' ] as const )(
		'returns unavailable when an explicit statistics reset is %s',
		async ( scenario ) => {
			const { bridge, statisticsRuntime } = createBridgeHarness();
			if ( scenario === 'rejected' ) {
				statisticsRuntime.reset.mockRejectedValue( new Error( 'Statistics reset unavailable.' ) );
			} else {
				statisticsRuntime.reset.mockResolvedValue( false );
			}

			await expect( bridge.resetStatistics() ).resolves.toEqual( {
				status: StatisticsProjectionStatus.UNAVAILABLE,
			} );
		},
	);

	it( 'captures event-time focus changes while statistics work is delayed', async () => {
		const initialTime = Date.UTC( 2026, 8, 2, 12 );
		const { bridge, browser, clock, statisticsRuntime } = createBridgeHarness();
		const pendingStatistics = new DeferredPromise();
		const observations: StatisticsCheckpointObservation[] = [];
		statisticsRuntime.reconcileConfiguration.mockImplementation( () => pendingStatistics.promise );
		statisticsRuntime.checkpoint.mockImplementation( ( _configuration, observation ) => {
			observations.push( observation );
			return Promise.resolve();
		} );
		bridge.reconcileConfiguration( EXAMPLE_CONFIGURATION );

		clock.value = initialTime + 10_000;
		browser.getFocusedTabId.mockResolvedValue( null );
		const unfocusedObservation = await bridge.captureObservation(
			StatisticsFocusObservationMode.BOUNDARY,
		);
		bridge.observeProtectionOperation(
			EXAMPLE_CONFIGURATION,
			Promise.resolve( unfocusedObservation ),
		);
		clock.value = initialTime + 20_000;
		browser.getFocusedTabId.mockResolvedValue( 7 );
		const focusedObservation = await bridge.captureObservation(
			StatisticsFocusObservationMode.BOUNDARY,
		);
		bridge.observeProtectionOperation(
			EXAMPLE_CONFIGURATION,
			Promise.resolve( focusedObservation ),
		);
		clock.value = initialTime + 50_000;
		pendingStatistics.resolve();

		await vi.waitFor( () => {
			expect( observations ).toHaveLength( 2 );
		} );
		expect( observations ).toMatchObject( [
			{
				observedAtEpochMilliseconds: initialTime + 10_000,
				focusObservation: {
					focusedAtEpochMilliseconds: initialTime + 10_000,
					focusedTabId: null,
				},
			},
			{
				observedAtEpochMilliseconds: initialTime + 20_000,
				focusObservation: {
					focusedAtEpochMilliseconds: initialTime + 20_000,
					focusedTabId: 7,
				},
			},
		] );
	} );

	it( 'captures each state and delivery boundary before delayed statistics work', async () => {
		const { bridge, coordinator, statisticsRuntime } = createBridgeHarness();
		const pendingStatistics = new DeferredPromise();
		const firstBatchId = ProtectionFactBatchIdSchema.parse( 'batch_first' );
		const secondBatchId = ProtectionFactBatchIdSchema.parse( 'batch_second' );
		const firstStates = {};
		const secondStates = { scope_default: createIdleState() };
		statisticsRuntime.reconcileConfiguration.mockImplementation( () => pendingStatistics.promise );
		coordinator.getStatisticsDeliveryBoundary
			.mockReturnValueOnce( { lastBatchId: firstBatchId } )
			.mockReturnValueOnce( { lastBatchId: secondBatchId } );
		coordinator.getStates
			.mockResolvedValueOnce( firstStates )
			.mockResolvedValueOnce( secondStates );
		bridge.reconcileConfiguration( EXAMPLE_CONFIGURATION );

		const firstObservation = await bridge.captureObservation(
			StatisticsFocusObservationMode.BOUNDARY,
		);
		bridge.observeProtectionOperation(
			EXAMPLE_CONFIGURATION,
			Promise.resolve( firstObservation ),
		);
		const secondObservation = await bridge.captureObservation(
			StatisticsFocusObservationMode.BOUNDARY,
		);
		bridge.observeProtectionOperation(
			EXAMPLE_CONFIGURATION,
			Promise.resolve( secondObservation ),
		);

		expect( coordinator.getStatisticsDeliveryBoundary ).toHaveBeenCalledTimes( 2 );
		expect( coordinator.getStates ).toHaveBeenCalledTimes( 2 );
		pendingStatistics.resolve();

		await vi.waitFor( () => {
			expect( statisticsRuntime.checkpoint ).toHaveBeenCalledTimes( 2 );
		} );
		expect( statisticsRuntime.drainProtectionFacts ).toHaveBeenNthCalledWith( 1, {
			lastBatchId: firstBatchId,
		} );
		expect( statisticsRuntime.drainProtectionFacts ).toHaveBeenNthCalledWith( 2, {
			lastBatchId: secondBatchId,
		} );
		expect(
			statisticsRuntime.checkpoint.mock.calls.map( ( call ) => call[ 1 ].focusObservation?.statesByScope ),
		).toEqual( [ firstStates, secondStates ] );
	} );
} );
