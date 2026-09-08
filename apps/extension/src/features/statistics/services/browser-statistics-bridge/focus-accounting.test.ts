import { describe, expect, it, vi } from 'vitest';
import { ProtectionCoordinatorInitializationStatus } from '../../../../domains/protection/services/protection-coordinator';
import { createWaitingState } from '../../../../domains/protection/types/__fixtures__';
import type { ProtectionFactBatchId } from '../../../../domains/protection/types/protection-value';
import { StoredProtectionStatisticsDeliveryStatus } from '../../../../domains/protection/types/stored-protection-statistics-delivery';
import { StatisticsProjectionStatus } from '../../../../domains/statistics/types/statistics-projection';
import { StatisticsSessionDocumentSchema } from '../../../../domains/statistics/types/statistics-session';
import { StatisticsFocusObservationMode } from '../../../../domains/statistics/utils/prepare-statistics-checkpoint';
import { createStatisticsRuntime } from '../statistics-runtime';
import {
	TEST_CONFIGURATION,
	TEST_NOW_EPOCH_MILLISECONDS,
	createActiveStatisticsDocument,
	createAllowanceBatch,
	createFocusSession,
	createMatchingAllowanceState,
	createReconsideredBatch,
	createRuntimeHarness,
	reconcileRuntime,
} from '../statistics-runtime/__fixtures__';
import { createBrowserStatisticsBridge } from './index';
import type { BrowserStatisticsBridge } from './types';

/**
 * Connects a real statistics runtime to controlled browser and protection boundaries.
 * @param harness - Real runtime with in-memory persistence and browser inputs.
 * @param lastBatchId - Durable fact prefix captured by the browser operation.
 * @return Browser bridge exercising actual focus and aggregate persistence.
 * @since 0.1.0 Initial implementation.
 */
function createRuntimeBridge(
	harness: ReturnType<typeof createRuntimeHarness>,
	lastBatchId: ProtectionFactBatchId | null = null,
): BrowserStatisticsBridge {
	return createBrowserStatisticsBridge( {
		browser: {
			getFocusedTabId: vi.fn().mockImplementation( () => Promise.resolve( harness.browser.focusedTabId ) ),
			listTabs: vi.fn().mockImplementation( () => Promise.resolve( harness.browser.tabs ) ),
		},
		configurationStorage: { load: vi.fn().mockResolvedValue( TEST_CONFIGURATION ) },
		coordinator: {
			getStates: harness.coordinator.getStates.bind( harness.coordinator ),
			getStatisticsDelivery: harness.coordinator.getStatisticsDelivery.bind( harness.coordinator ),
			getStatisticsDeliveryBoundary: vi.fn().mockReturnValue( { lastBatchId } ),
			initialize: vi.fn().mockResolvedValue( {
				status: ProtectionCoordinatorInitializationStatus.READY,
				decisions: [],
				facts: [],
				requirements: [],
			} ),
		},
		now: harness.clock.now.bind( harness.clock ),
		statisticsRuntime: harness.runtime,
	} );
}

describe( 'browser statistics focus accounting', () => {
	it.each( [ false, true ] )( 'closes focus before valuing a post-expiry fact (acknowledgement retry: %s)', async ( retryAcknowledgement ) => {
		const expiresAtEpochMilliseconds = TEST_NOW_EPOCH_MILLISECONDS + 180_000;
		const batch = createReconsideredBatch(
			'batch_after_expiry',
			'scope_default',
			'revision_current',
			expiresAtEpochMilliseconds + 1_000,
		);
		const harness = createRuntimeHarness(
			undefined,
			createActiveStatisticsDocument(),
			createFocusSession( expiresAtEpochMilliseconds - 60_000 ),
		);

		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();
		harness.clock.nowEpochMilliseconds = expiresAtEpochMilliseconds + 1_000;
		harness.coordinator.states = { scope_default: createWaitingState() };
		harness.coordinator.replaceDelivery( {
			status: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
			outbox: [ batch ],
		} );
		if ( retryAcknowledgement ) {
			harness.coordinator.acknowledgementFailure = new Error( 'Acknowledgement unavailable.' );
		}
		const bridge = createRuntimeBridge( harness, batch.batchId );

		bridge.observeProtectionOperation(
			TEST_CONFIGURATION,
			bridge.captureObservation( StatisticsFocusObservationMode.BOUNDARY ),
		);
		let projection = await bridge.readStatistics();

		if ( retryAcknowledgement ) {
			expect( projection ).toEqual( { status: StatisticsProjectionStatus.UNAVAILABLE } );
			harness.coordinator.acknowledgementFailure = null;
			projection = await bridge.readStatistics();
		}

		expect( harness.sessionStorage.savedDocuments.at( -1 )?.pendingInterval ).toMatchObject( {
			allowanceId: 'allowance_current',
			startedAtEpochMilliseconds: expiresAtEpochMilliseconds - 60_000,
			endedAtEpochMilliseconds: expiresAtEpochMilliseconds + 1_000,
		} );
		expect( harness.storage.savedDocuments.at( -1 )?.scopes.scope_default?.activeAllowance )
			.toBeUndefined();
		expect( projection ).toMatchObject( {
			status: StatisticsProjectionStatus.AVAILABLE,
			estimatedReclaimedMilliseconds: 300_000,
			reconsideredVisitCount: 1,
		} );
	} );

	it( 'replays final focused use before retained expiry facts after aggregation fails and the runtime restarts', async () => {
		const expiresAtEpochMilliseconds = TEST_NOW_EPOCH_MILLISECONDS + 180_000;
		const batch = createReconsideredBatch(
			'batch_after_expiry',
			'scope_default',
			'revision_current',
			expiresAtEpochMilliseconds + 1_000,
		);
		const harness = createRuntimeHarness(
			undefined,
			createActiveStatisticsDocument(),
			createFocusSession( expiresAtEpochMilliseconds - 60_000 ),
		);

		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();
		harness.clock.nowEpochMilliseconds = expiresAtEpochMilliseconds + 1_000;
		harness.coordinator.states = { scope_default: createWaitingState() };
		harness.coordinator.replaceDelivery( {
			status: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
			outbox: [ batch ],
		} );
		harness.storage.saveFailure = new Error( 'Local aggregation unavailable.' );
		const bridge = createRuntimeBridge( harness, batch.batchId );

		bridge.observeProtectionOperation(
			TEST_CONFIGURATION,
			bridge.captureObservation( StatisticsFocusObservationMode.BOUNDARY ),
		);
		expect( await bridge.readStatistics() ).toEqual( { status: StatisticsProjectionStatus.UNAVAILABLE } );
		expect( harness.sessionStorage.savedDocuments.at( -1 )?.pendingInterval ).toMatchObject( {
			startedAtEpochMilliseconds: expiresAtEpochMilliseconds - 60_000,
			endedAtEpochMilliseconds: expiresAtEpochMilliseconds + 1_000,
		} );
		harness.storage.saveFailure = null;
		const restartedBridge = createRuntimeBridge( {
			...harness,
			runtime: createStatisticsRuntime( harness.options ),
		}, batch.batchId );

		expect( await restartedBridge.readStatistics() ).toMatchObject( {
			status: StatisticsProjectionStatus.AVAILABLE,
			estimatedReclaimedMilliseconds: 300_000,
			reconsideredVisitCount: 1,
		} );
		expect( harness.storage.savedDocuments.map( ( document ) =>
			document.scopes.scope_default?.activeAllowance,
		) ).toContainEqual( expect.objectContaining( {
			allowanceId: 'allowance_current',
			confirmedFocusedUseMilliseconds: 60_000,
			accountedThroughEpochMilliseconds: expiresAtEpochMilliseconds,
		} ) );
		expect( harness.storage.savedDocuments.at( -1 )?.scopes.scope_default?.activeAllowance )
			.toBeUndefined();
	} );

	it( 'starts focus for a newly delivered allowance after accounting for the previous allowance', async () => {
		const expiresAtEpochMilliseconds = TEST_NOW_EPOCH_MILLISECONDS + 180_000;
		const batch = createAllowanceBatch( 'batch_next', 'allowance_next', expiresAtEpochMilliseconds );
		const harness = createRuntimeHarness(
			undefined,
			createActiveStatisticsDocument(),
			createFocusSession( expiresAtEpochMilliseconds - 60_000 ),
		);

		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();
		harness.clock.nowEpochMilliseconds = expiresAtEpochMilliseconds;
		harness.browser.focusedTabId = 7;
		harness.browser.tabs = [ { id: 7, incognito: false, url: 'https://example.com/' } ];
		harness.coordinator.states = {
			scope_default: createMatchingAllowanceState( 'scope_default', 'allowance_next', expiresAtEpochMilliseconds ),
		};
		harness.coordinator.replaceDelivery( {
			status: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
			outbox: [ batch ],
		} );
		const bridge = createRuntimeBridge( harness, batch.batchId );

		bridge.observeProtectionOperation(
			TEST_CONFIGURATION,
			bridge.captureObservation( StatisticsFocusObservationMode.BOUNDARY ),
		);
		await bridge.readStatistics();
		expect( harness.sessionStorage.savedDocuments.map( ( document ) => document.pendingInterval ) )
			.toContainEqual( expect.objectContaining( {
				allowanceId: 'allowance_current',
				startedAtEpochMilliseconds: expiresAtEpochMilliseconds - 60_000,
				endedAtEpochMilliseconds: expiresAtEpochMilliseconds,
			} ) );
		harness.clock.nowEpochMilliseconds += 30_000;
		bridge.observeProtectionOperation(
			TEST_CONFIGURATION,
			bridge.captureObservation( StatisticsFocusObservationMode.SAMPLE ),
		);
		await bridge.readStatistics();

		expect( harness.storage.savedDocuments.at( -1 )?.scopes.scope_default )
			.toMatchObject( {
				totals: { estimatedReclaimedMilliseconds: 0 },
				activeAllowance: {
					allowanceId: 'allowance_next',
					confirmedFocusedUseMilliseconds: 30_000,
				},
			} );
	} );

	it( 'preserves a persisted focus anchor until delivery initializes after a runtime restart', async () => {
		const session = createFocusSession( TEST_NOW_EPOCH_MILLISECONDS - 60_000 );
		const harness = createRuntimeHarness(
			undefined,
			createActiveStatisticsDocument(),
			StatisticsSessionDocumentSchema.parse( {
				...session,
				focusAnchor: { ...session.focusAnchor, siteHost: 'example.com' },
			} ),
		);

		harness.browser.focusedTabId = 7;
		harness.browser.tabs = [ { id: 7, incognito: false, url: 'https://example.com/' } ];
		harness.coordinator.states = { scope_default: createMatchingAllowanceState() };
		await reconcileRuntime( harness.runtime );
		const bridge = createRuntimeBridge( harness );

		bridge.observeProtectionOperation(
			TEST_CONFIGURATION,
			bridge.captureObservation( StatisticsFocusObservationMode.STARTUP ),
		);
		await bridge.readStatistics();
		bridge.observeProtectionOperation(
			TEST_CONFIGURATION,
			bridge.captureObservation( StatisticsFocusObservationMode.SAMPLE ),
		);
		await bridge.readStatistics();

		expect( harness.storage.savedDocuments.at( -1 )?.scopes.scope_default?.activeAllowance )
			.toMatchObject( { confirmedFocusedUseMilliseconds: 60_000 } );
	} );

	it( 'discards unfrozen focus when the current protection delivery becomes incomplete', async () => {
		const harness = createRuntimeHarness(
			undefined,
			createActiveStatisticsDocument(),
			createFocusSession( TEST_NOW_EPOCH_MILLISECONDS - 60_000 ),
		);

		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();
		harness.coordinator.replaceDelivery( {
			status: StoredProtectionStatisticsDeliveryStatus.INCOMPLETE,
			outbox: [],
		} );
		const bridge = createRuntimeBridge( harness );

		bridge.observeProtectionOperation(
			TEST_CONFIGURATION,
			bridge.captureObservation( StatisticsFocusObservationMode.BOUNDARY ),
		);
		await bridge.readStatistics();

		expect( harness.storage.savedDocuments.at( -1 )?.scopes.scope_default?.activeAllowance )
			.toMatchObject( { confirmedFocusedUseMilliseconds: 0 } );
		expect( harness.runtime.getSnapshot().focusMeasurementEnabled ).toBe( false );
	} );
} );
