import { describe, expect, it } from 'vitest';
import { StoredProtectionStatisticsDeliveryStatus } from '../../../../domains/protection/types/stored-protection-statistics-delivery';
import { StatisticsDocumentSchema } from '../../../../domains/statistics/types/statistics-document';
import { StatisticsProjectionStatus } from '../../../../domains/statistics/types/statistics-projection';
import {
	createStatisticsRuntime,
	type StatisticsRuntimeOptions,
} from './index';
import {
	TEST_NOW_EPOCH_MILLISECONDS,
	createActiveStatisticsDocument,
	createDelivery,
	createFocusSession,
	createReconsideredBatch,
	createRuntimeHarness,
	createStatisticsDocument,
	reconcileRuntime,
	reuseCurrentGenerationId,
} from './__fixtures__';

describe( 'statistics runtime reset', () => {
	it( 'clears delivery, session work, and all totals under a fresh generation', async () => {
		const populatedDocument = StatisticsDocumentSchema.parse( {
			...createActiveStatisticsDocument(),
			scopes: {
				scope_default: {
					...createActiveStatisticsDocument().scopes.scope_default,
					totals: {
						estimatedReclaimedMilliseconds: 120_000,
						focusedPauseMilliseconds: 8_000,
						reconsideredVisitCount: 3,
						completedWaitCount: 2,
						allowanceGrantedCount: 2,
					},
				},
			},
		} );
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.INCOMPLETE, [
				createReconsideredBatch( 'batch_pending' ),
			] ),
			populatedDocument,
			createFocusSession( TEST_NOW_EPOCH_MILLISECONDS - 30_000 ),
		);

		await reconcileRuntime( harness.runtime );
		harness.trace.length = 0;
		harness.storage.savedDocuments.length = 0;

		await expect( harness.runtime.reset() ).resolves.toBe( true );
		expect( harness.trace ).toEqual( [
			'delivery:begin',
			'local:reconcile',
			'session:remove',
			'delivery:complete',
		] );
		expect( harness.storage.savedDocuments ).toEqual( [
			expect.objectContaining( {
				generationId: 'generation_reset',
				lastAppliedBatchId: null,
				scopes: {
					scope_default: {
						currentMeasurementRevision: 'revision_current',
						totals: {
							estimatedReclaimedMilliseconds: 0,
							focusedPauseMilliseconds: 0,
							reconsideredVisitCount: 0,
							completedWaitCount: 0,
							allowanceGrantedCount: 0,
						},
					},
				},
			} ),
		] );
		expect( harness.runtime.getSnapshot() ).toEqual( {
			deliveryStatus: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
			focusMeasurementEnabled: true,
			projection: {
				status: StatisticsProjectionStatus.AVAILABLE,
				estimatedReclaimedMilliseconds: null,
				focusedPauseMilliseconds: 0,
				reconsideredVisitCount: 0,
				completedWaitCount: 0,
				allowanceGrantedCount: 0,
			},
		} );
	} );

	it.each( [ 'rejected', 'failed' ] )( 'keeps local and session statistics when delivery reset is %s', async ( scenario ) => {
		const harness = createRuntimeHarness();

		await reconcileRuntime( harness.runtime );
		harness.trace.length = 0;
		harness.storage.savedDocuments.length = 0;
		harness.coordinator.resetResult = scenario !== 'rejected';
		harness.coordinator.resetFailure = scenario === 'failed'
			? new Error( 'delivery reset unavailable' )
			: null;

		await expect( harness.runtime.reset() ).resolves.toBe( false );
		expect( harness.trace ).toEqual( [ 'delivery:begin' ] );
		expect( harness.storage.savedDocuments ).toEqual( [] );
		expect( harness.sessionStorage.removedDocuments ).toEqual( [] );
		expect( harness.runtime.getSnapshot().deliveryStatus ).toBeNull();
	} );

	it( 'keeps reset incomplete when session cleanup fails after zero totals persist', async () => {
		const harness = createRuntimeHarness();

		await reconcileRuntime( harness.runtime );
		harness.trace.length = 0;
		harness.storage.savedDocuments.length = 0;
		harness.sessionStorage.removeFailure = new Error( 'session reset unavailable' );

		await expect( harness.runtime.reset() ).resolves.toBe( false );
		expect( harness.trace ).toEqual( [ 'delivery:begin', 'local:reconcile' ] );
		expect( harness.storage.savedDocuments ).toHaveLength( 1 );
		expect( harness.storage.savedDocuments[ 0 ]?.generationId ).toBe( 'generation_reset' );
		expect( harness.runtime.getSnapshot() ).toMatchObject( {
			deliveryStatus: StoredProtectionStatisticsDeliveryStatus.INCOMPLETE,
			focusMeasurementEnabled: false,
		} );
	} );

	it( 'keeps reset incomplete when delivery reset completion is rejected', async () => {
		const harness = createRuntimeHarness();

		await reconcileRuntime( harness.runtime );
		harness.trace.length = 0;
		harness.storage.savedDocuments.length = 0;
		harness.coordinator.resetCompletionResult = false;

		await expect( harness.runtime.reset() ).resolves.toBe( false );

		expect( harness.trace ).toEqual( [
			'delivery:begin',
			'local:reconcile',
			'session:remove',
			'delivery:complete',
		] );
		expect( harness.storage.savedDocuments ).toHaveLength( 1 );
		expect( harness.storage.savedDocuments[ 0 ]?.generationId ).toBe( 'generation_reset' );
		expect( harness.sessionStorage.removedDocuments ).toHaveLength( 1 );
		expect( harness.runtime.getSnapshot() ).toEqual( {
			deliveryStatus: StoredProtectionStatisticsDeliveryStatus.INCOMPLETE,
			focusMeasurementEnabled: false,
			projection: { status: StatisticsProjectionStatus.UNAVAILABLE },
		} );
	} );

	it( 'keeps reset incomplete when the zero totals write fails', async () => {
		const harness = createRuntimeHarness();

		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();
		harness.trace.length = 0;
		harness.storage.savedDocuments.length = 0;
		harness.storage.saveFailure = new Error( 'local reset unavailable' );

		await expect( harness.runtime.reset() ).resolves.toBe( false );
		expect( harness.trace ).toEqual( [ 'delivery:begin' ] );
		expect( harness.storage.savedDocuments ).toEqual( [] );
		expect( harness.sessionStorage.removedDocuments ).toEqual( [] );
		expect( harness.runtime.getSnapshot() ).toMatchObject( {
			deliveryStatus: StoredProtectionStatisticsDeliveryStatus.INCOMPLETE,
			focusMeasurementEnabled: false,
		} );
	} );

	it( 'never exposes old totals after a failed reset and completes safely after restart', async () => {
		const populatedDocument = StatisticsDocumentSchema.parse( {
			...createStatisticsDocument( 'scope_default', 'revision_current' ),
			scopes: {
				scope_default: {
					...createStatisticsDocument( 'scope_default', 'revision_current' )
						.scopes.scope_default,
					totals: {
						estimatedReclaimedMilliseconds: 120_000,
						focusedPauseMilliseconds: 8_000,
						reconsideredVisitCount: 3,
						completedWaitCount: 2,
						allowanceGrantedCount: 2,
					},
				},
			},
		} );
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE, [
				createReconsideredBatch( 'batch_pending' ),
			] ),
			populatedDocument,
			createFocusSession( TEST_NOW_EPOCH_MILLISECONDS - 30_000 ),
		);

		await reconcileRuntime( harness.runtime );
		harness.storage.saveFailure = new Error( 'zero totals unavailable' );
		await expect( harness.runtime.reset() ).resolves.toBe( false );
		expect( harness.runtime.getSnapshot().projection ).toEqual( {
			status: StatisticsProjectionStatus.UNAVAILABLE,
		} );

		harness.storage.saveFailure = null;
		const restartedRuntime = createStatisticsRuntime( harness.options );

		await reconcileRuntime( restartedRuntime );
		await restartedRuntime.drainProtectionFacts();
		expect( restartedRuntime.getSnapshot().projection ).toEqual( {
			status: StatisticsProjectionStatus.UNAVAILABLE,
		} );
		await expect( restartedRuntime.reset() ).resolves.toBe( true );
		expect( restartedRuntime.getSnapshot().projection ).toMatchObject( {
			status: StatisticsProjectionStatus.AVAILABLE,
			reconsideredVisitCount: 0,
			completedWaitCount: 0,
			allowanceGrantedCount: 0,
			focusedPauseMilliseconds: 0,
		} );
	} );

	it( 'keeps zero totals unavailable until reset completion succeeds after restart', async () => {
		const harness = createRuntimeHarness();

		await reconcileRuntime( harness.runtime );
		harness.coordinator.resetCompletionFailure = new Error( 'completion unavailable' );
		await expect( harness.runtime.reset() ).resolves.toBe( false );
		expect( harness.runtime.getSnapshot().projection ).toEqual( {
			status: StatisticsProjectionStatus.UNAVAILABLE,
		} );

		harness.coordinator.resetCompletionFailure = null;
		const restartedRuntime = createStatisticsRuntime( harness.options );

		await reconcileRuntime( restartedRuntime );
		await restartedRuntime.drainProtectionFacts();
		expect( restartedRuntime.getSnapshot().projection ).toEqual( {
			status: StatisticsProjectionStatus.UNAVAILABLE,
		} );
		await expect( restartedRuntime.reset() ).resolves.toBe( true );
		expect( restartedRuntime.getSnapshot().projection ).toMatchObject( {
			status: StatisticsProjectionStatus.AVAILABLE,
			reconsideredVisitCount: 0,
		} );
	} );

	it( 'replaces an unsafe local statistics document during an explicit reset', async () => {
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.INCOMPLETE ),
			null,
		);

		await reconcileRuntime( harness.runtime );
		harness.trace.length = 0;

		await expect( harness.runtime.reset() ).resolves.toBe( true );
		expect( harness.trace ).toEqual( [
			'delivery:begin',
			'local:reconcile',
			'session:remove',
			'delivery:complete',
		] );
		expect( harness.runtime.getSnapshot() ).toMatchObject( {
			deliveryStatus: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
			projection: {
				status: StatisticsProjectionStatus.AVAILABLE,
				reconsideredVisitCount: 0,
			},
		} );
	} );

	it( 'resets statistics without requiring a valid protection configuration', async () => {
		const unavailableHarness = createRuntimeHarness();

		await unavailableHarness.runtime.reconcileConfiguration( null );
		await expect( unavailableHarness.runtime.reset() ).resolves.toBe( true );
		expect( unavailableHarness.trace ).toEqual( [
			'delivery:begin',
			'local:reconcile',
			'session:remove',
			'delivery:complete',
		] );
		expect( unavailableHarness.runtime.getSnapshot() ).toMatchObject( {
			focusMeasurementEnabled: false,
			projection: {
				status: StatisticsProjectionStatus.AVAILABLE,
				reconsideredVisitCount: 0,
			},
		} );
	} );

	it( 'does not mutate persistence when a reset generation is invalid', async () => {

		const invalidGenerationHarness = createRuntimeHarness();
		const invalidOptions: StatisticsRuntimeOptions = {
			coordinator: invalidGenerationHarness.coordinator,
			storage: invalidGenerationHarness.storage,
			sessionStorage: invalidGenerationHarness.sessionStorage,
			createGenerationId: reuseCurrentGenerationId,
		};
		const invalidRuntime = createStatisticsRuntime( invalidOptions );

		await reconcileRuntime( invalidRuntime );
		invalidGenerationHarness.trace.length = 0;
		invalidGenerationHarness.storage.savedDocuments.length = 0;

		await expect( invalidRuntime.reset() ).resolves.toBe( false );
		expect( invalidGenerationHarness.trace ).toEqual( [] );
		expect( invalidGenerationHarness.storage.savedDocuments ).toEqual( [] );
	} );
} );
