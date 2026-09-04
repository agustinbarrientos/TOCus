import { describe, expect, it } from 'vitest';
import { ProtectionConfigurationDocumentSchema } from '../../../../domains/protection/types/protected-site-configuration';
import { DefaultProtectionSchedule } from '../../../../domains/protection/types/protection-schedule';
import { StoredProtectionStatisticsDeliveryStatus } from '../../../../domains/protection/types/stored-protection-statistics-delivery';
import { StatisticsDocumentSchema } from '../../../../domains/statistics/types/statistics-document';
import { StatisticsProjectionStatus } from '../../../../domains/statistics/types/statistics-projection';
import {
	TEST_CONFIGURATION,
	TEST_NOW_EPOCH_MILLISECONDS,
	checkpointRuntime,
	createActiveStatisticsDocument,
	createAllowanceBatch,
	createDelivery,
	createFocusSession,
	createMatchingAllowanceState,
	createPendingSession,
	createReconsideredBatch,
	createRuntimeHarness,
	createStatisticsDocument,
	reconcileRuntime,
} from './__fixtures__';

describe( 'statistics runtime initialization and fact delivery', () => {
	it( 'persists raw configuration revision reconciliation before enabling drain', async () => {
		const harness = createRuntimeHarness();

		await expect( reconcileRuntime( harness.runtime ) ).resolves.toBeUndefined();
		expect( harness.storage.savedDocuments ).toHaveLength( 1 );
		expect( harness.storage.savedDocuments[ 0 ]?.scopes.scope_default ).toEqual( {
			totals: createStatisticsDocument().scopes.scope_default?.totals,
			currentMeasurementRevision: 'revision_current',
		} );
		expect( harness.runtime.getSnapshot() ).toMatchObject( {
			deliveryStatus: null,
			focusMeasurementEnabled: false,
			projection: { status: StatisticsProjectionStatus.UNAVAILABLE },
		} );

		await harness.runtime.drainProtectionFacts();

		expect( harness.coordinator.deliveryReadCount ).toBe( 1 );
		expect( harness.runtime.getSnapshot() ).toMatchObject( {
			deliveryStatus: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
			focusMeasurementEnabled: true,
		} );
	} );

	it( 'keeps removed independent totals through restart, queued delivery, and re-addition', async () => {
		const historicalDocument = StatisticsDocumentSchema.parse( {
			...createStatisticsDocument( 'scope_removed', 'revision_removed' ),
			scopes: {
				scope_removed: {
					totals: {
						estimatedReclaimedMilliseconds: 6_000_000,
						focusedPauseMilliseconds: 42_000,
						reconsideredVisitCount: 20,
						completedWaitCount: 15,
						allowanceGrantedCount: 15,
					},
					currentMeasurementRevision: 'revision_removed',
					latestBaseline: {
						measurementRevision: 'revision_removed',
						focusedUseMilliseconds: 120_000,
					},
				},
			},
		} );
		const retainedDelivery = createDelivery(
			StoredProtectionStatisticsDeliveryStatus.COMPLETE,
			[ createReconsideredBatch( 'batch_removed', 'scope_removed', 'revision_removed' ) ],
		);
		const removalHarness = createRuntimeHarness( retainedDelivery, historicalDocument );

		await reconcileRuntime( removalHarness.runtime );

		const persistedAfterRemoval = StatisticsDocumentSchema.parse(
			removalHarness.storage.savedDocuments.at( -1 ),
		);
		const restartedHarness = createRuntimeHarness( retainedDelivery, persistedAfterRemoval );

		await reconcileRuntime( restartedHarness.runtime );
		await restartedHarness.runtime.drainProtectionFacts();

		expect( restartedHarness.runtime.getSnapshot().projection ).toMatchObject( {
			status: StatisticsProjectionStatus.AVAILABLE,
			estimatedReclaimedMilliseconds: 6_120_000,
			focusedPauseMilliseconds: 42_000,
			reconsideredVisitCount: 21,
			completedWaitCount: 15,
			allowanceGrantedCount: 15,
		} );
		expect( await restartedHarness.coordinator.getStatisticsDelivery() ).toEqual(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE ),
		);

		const readdedConfiguration = ProtectionConfigurationDocumentSchema.parse( {
			...TEST_CONFIGURATION,
			sites: [
				...TEST_CONFIGURATION.sites,
				{
					identityHost: 'readded.example',
					rule: {
						host: 'readded.example',
						includeSubdomains: false,
						scopeId: 'scope_readded',
					},
				},
			],
			schedulesByScope: {
				scope_default: DefaultProtectionSchedule,
				scope_readded: DefaultProtectionSchedule,
			},
			measurementRevisionsByScope: {
				scope_default: 'revision_current',
				scope_readded: 'revision_readded',
			},
		} );

		await reconcileRuntime( restartedHarness.runtime, readdedConfiguration );
		await restartedHarness.runtime.drainProtectionFacts();

		expect( restartedHarness.runtime.getSnapshot().projection ).toMatchObject( {
			status: StatisticsProjectionStatus.AVAILABLE,
			estimatedReclaimedMilliseconds: 6_120_000,
			focusedPauseMilliseconds: 42_000,
			reconsideredVisitCount: 21,
			completedWaitCount: 15,
			allowanceGrantedCount: 15,
		} );
		expect( restartedHarness.storage.savedDocuments.at( -1 )?.scopes ).toMatchObject( {
			scope_removed: {
				totals: { estimatedReclaimedMilliseconds: 6_120_000 },
			},
			scope_readded: {
				totals: { estimatedReclaimedMilliseconds: 0 },
				currentMeasurementRevision: 'revision_readded',
			},
		} );
	} );

	it( 'values a queued shared-scope fact after its measurement revision rotates', async () => {
		const historicalDocument = StatisticsDocumentSchema.parse( {
			...createStatisticsDocument( 'scope_default', 'revision_before_rotation' ),
			scopes: {
				scope_default: {
					totals: {
						estimatedReclaimedMilliseconds: 3_000_000,
						focusedPauseMilliseconds: 0,
						reconsideredVisitCount: 10,
						completedWaitCount: 0,
						allowanceGrantedCount: 0,
					},
					currentMeasurementRevision: 'revision_before_rotation',
					latestBaseline: {
						measurementRevision: 'revision_before_rotation',
						focusedUseMilliseconds: 180_000,
					},
				},
			},
		} );
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE, [
				createReconsideredBatch(
					'batch_before_rotation',
					'scope_default',
					'revision_before_rotation',
				),
			] ),
			historicalDocument,
		);

		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();

		expect( harness.runtime.getSnapshot().projection ).toMatchObject( {
			status: StatisticsProjectionStatus.AVAILABLE,
			estimatedReclaimedMilliseconds: 3_180_000,
			reconsideredVisitCount: 11,
		} );
		expect( harness.storage.savedDocuments.at( -1 )?.scopes.scope_default ).toMatchObject( {
			currentMeasurementRevision: 'revision_current',
			latestBaseline: {
				measurementRevision: 'revision_before_rotation',
				focusedUseMilliseconds: 180_000,
			},
		} );
	} );

	it( 'keeps focus measurement disabled before browser-session continuity exists', async () => {
		const harness = createRuntimeHarness();

		harness.coordinator.sessionContinuityId = null;
		await reconcileRuntime( harness.runtime );

		expect( harness.sessionStorage.loadCount ).toBe( 0 );
		expect( harness.runtime.getSnapshot().focusMeasurementEnabled ).toBe( false );
	} );

	it( 'preserves delivery and session state without rewriting an unchanged revision map', async () => {
		const anchor = createFocusSession( TEST_NOW_EPOCH_MILLISECONDS - 30_000 );
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE ),
			createActiveStatisticsDocument(),
			anchor,
		);

		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();
		const savesBeforeRepeat = harness.storage.savedDocuments.length;

		await reconcileRuntime( harness.runtime, ProtectionConfigurationDocumentSchema.parse( {
			...TEST_CONFIGURATION,
			sites: TEST_CONFIGURATION.sites.map( ( site ) => ( {
				...site,
				rule: { ...site.rule, includeSubdomains: false },
			} ) ),
		} ) );

		expect( harness.storage.loadCount ).toBe( 1 );
		expect( harness.storage.savedDocuments ).toHaveLength( savesBeforeRepeat );
		expect( harness.sessionStorage.loadCount ).toBe( 1 );
		expect( harness.runtime.getSnapshot() ).toMatchObject( {
			deliveryStatus: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
			focusMeasurementEnabled: true,
		} );
	} );

	it( 'retries only failed session initialization for an unchanged revision map', async () => {
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE ),
			createActiveStatisticsDocument(),
			createFocusSession( TEST_NOW_EPOCH_MILLISECONDS - 30_000 ),
		);

		harness.sessionStorage.loadFailure = new Error( 'session unavailable' );
		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();
		expect( harness.runtime.getSnapshot().focusMeasurementEnabled ).toBe( false );

		const savesBeforeRetry = harness.storage.savedDocuments.length;
		harness.sessionStorage.loadFailure = null;
		await reconcileRuntime( harness.runtime );

		expect( harness.storage.loadCount ).toBe( 1 );
		expect( harness.storage.savedDocuments ).toHaveLength( savesBeforeRetry );
		expect( harness.sessionStorage.loadCount ).toBe( 2 );
		expect( harness.runtime.getSnapshot().deliveryStatus ).toBeNull();

		await harness.runtime.drainProtectionFacts();
		expect( harness.runtime.getSnapshot() ).toMatchObject( {
			deliveryStatus: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
			focusMeasurementEnabled: true,
		} );
	} );

	it( 'contains reconciliation failures, gates consumers, and retries a later event', async () => {
		const harness = createRuntimeHarness();
		const saveFailure = new Error( 'local statistics write failed' );

		harness.storage.saveFailure = saveFailure;
		await expect( reconcileRuntime( harness.runtime ) ).resolves.toBeUndefined();
		await expect( harness.runtime.drainProtectionFacts() ).resolves.toBeUndefined();
		await expect( checkpointRuntime( harness ) ).resolves.toBeUndefined();
		expect( harness.coordinator.deliveryReadCount ).toBe( 0 );
		expect( harness.runtime.getSnapshot().deliveryStatus ).toBeNull();

		harness.storage.saveFailure = null;
		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();
		expect( harness.runtime.getSnapshot().deliveryStatus ).toBe(
			StoredProtectionStatisticsDeliveryStatus.COMPLETE,
		);
	} );

	it.each( [ 'read failure', 'unsafe local document' ] )(
		'contains a local statistics $label during reconciliation',
		async ( scenario ) => {
			const harness = createRuntimeHarness(
				undefined,
				scenario === 'unsafe local document' ? null : createStatisticsDocument(),
			);

			if ( scenario === 'read failure' ) {
				harness.storage.loadFailure = new Error( 'local statistics unavailable' );
			}

			await expect( reconcileRuntime( harness.runtime ) ).resolves.toBeUndefined();
			await harness.runtime.drainProtectionFacts();

			expect( harness.storage.savedDocuments ).toEqual( [] );
			expect( harness.coordinator.deliveryReadCount ).toBe( 0 );
			expect( harness.runtime.getSnapshot().projection ).toEqual( {
				status: StatisticsProjectionStatus.UNAVAILABLE,
			} );
		},
	);

	it( 'blocks facts when a corrupted session-service result leaves session state unknown', async () => {
		const harness = createRuntimeHarness();

		harness.sessionStorage.unsafeLoadResult = {
			schemaVersion: 1,
			unexpected: true,
		};

		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();

		expect( harness.runtime.getSnapshot() ).toMatchObject( {
			deliveryStatus: null,
			focusMeasurementEnabled: false,
		} );
		expect( harness.coordinator.deliveryReadCount ).toBe( 0 );
	} );

	it.each( [ 'failure', 'uninitialized' ] )(
		'contains an $scenario protection delivery read',
		async ( scenario ) => {
			const harness = createRuntimeHarness(
				scenario === 'uninitialized'
					? null
					: createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE ),
			);

			if ( scenario === 'failure' ) {
				harness.coordinator.deliveryReadFailure = new Error( 'delivery unavailable' );
			}

			await reconcileRuntime( harness.runtime );
			await expect( harness.runtime.drainProtectionFacts() ).resolves.toBeUndefined();
			expect( harness.runtime.getSnapshot().deliveryStatus ).toBeNull();
		},
	);

	it.each( [ null, { schemaVersion: 999 } ] )(
		'contains unsafe local/configuration initialization %# without replacing it',
		async ( unsafeInput ) => {
			const harness = unsafeInput === null
				? createRuntimeHarness( undefined, null )
				: createRuntimeHarness();

			await expect( reconcileRuntime( harness.runtime, unsafeInput ) ).resolves.toBeUndefined();
			await harness.runtime.drainProtectionFacts();
			expect( harness.storage.savedDocuments ).toEqual( [] );
			expect( harness.coordinator.deliveryReadCount ).toBe( 0 );
			expect( harness.runtime.getSnapshot() ).toEqual( {
				deliveryStatus: null,
				focusMeasurementEnabled: false,
				projection: { status: StatisticsProjectionStatus.UNAVAILABLE },
			} );
		},
	);

	it( 'keeps fact aggregation usable after a known session write failure', async () => {
		const batch = createReconsideredBatch( 'batch_1' );
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE ),
			createActiveStatisticsDocument(),
		);

		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();
		harness.coordinator.states = { scope_default: createMatchingAllowanceState() };
		harness.browser.focusedTabId = 7;
		harness.browser.tabs = [ {
			id: 7,
			incognito: false,
			url: 'https://example.com/',
		} ];
		harness.sessionStorage.saveFailure = new Error( 'session unavailable' );
		await checkpointRuntime( harness );
		harness.coordinator.replaceDelivery( createDelivery(
			StoredProtectionStatisticsDeliveryStatus.COMPLETE,
			[ batch ],
		) );
		await harness.runtime.drainProtectionFacts();

		expect( harness.coordinator.deliveryReadCount ).toBe( 2 );
		expect( harness.trace ).toEqual( [
			'local:reconcile',
			'local:batch_1',
			'ack:batch_1',
		] );
		expect( harness.runtime.getSnapshot() ).toMatchObject( {
			deliveryStatus: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
			focusMeasurementEnabled: false,
			projection: { reconsideredVisitCount: 1 },
		} );
	} );

	it( 'does not replace an active allowance until unknown persisted WAL is replayed', async () => {
		const oldStartedAt = TEST_NOW_EPOCH_MILLISECONDS - 600_000;
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE, [
				createAllowanceBatch(
					'batch_replacement',
					'allowance_replacement',
					TEST_NOW_EPOCH_MILLISECONDS,
				),
			] ),
			createActiveStatisticsDocument(
				'scope_default',
				'revision_current',
				'allowance_current',
				oldStartedAt,
			),
			createPendingSession(
				TEST_NOW_EPOCH_MILLISECONDS - 500_000,
				TEST_NOW_EPOCH_MILLISECONDS - 400_000,
				null,
			),
		);

		harness.sessionStorage.loadFailure = new Error( 'session temporarily unavailable' );
		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();

		expect( harness.trace ).toEqual( [ 'local:reconcile' ] );
		expect( harness.storage.savedDocuments ).toHaveLength( 1 );
		expect( harness.runtime.getSnapshot().deliveryStatus ).toBeNull();

		harness.sessionStorage.loadFailure = null;
		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();

		expect( harness.trace ).toEqual( [
			'local:reconcile',
			'local:reconcile',
			'session:remove',
			'local:batch_replacement',
			'ack:batch_replacement',
		] );
		expect( harness.storage.savedDocuments.at( -1 )?.scopes.scope_default ).toMatchObject( {
			latestBaseline: { focusedUseMilliseconds: 100_000 },
			activeAllowance: { allowanceId: 'allowance_replacement' },
		} );
	} );

	it( 'drains every durable batch strictly local-save before exact-head acknowledgement', async () => {
		const harness = createRuntimeHarness( createDelivery(
			StoredProtectionStatisticsDeliveryStatus.COMPLETE,
			[ createReconsideredBatch( 'batch_1' ), createReconsideredBatch( 'batch_2' ) ],
		) );

		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();

		expect( harness.trace ).toEqual( [
			'local:reconcile',
			'local:batch_1',
			'ack:batch_1',
			'local:batch_2',
			'ack:batch_2',
		] );
		expect( harness.runtime.getSnapshot().projection ).toMatchObject( {
			status: StatisticsProjectionStatus.AVAILABLE,
			reconsideredVisitCount: 2,
		} );
	} );

	it( 'does not drain batches beyond one captured protection-operation boundary', async () => {
		const firstBatch = createReconsideredBatch( 'batch_1' );
		const secondBatch = createReconsideredBatch( 'batch_2' );
		const harness = createRuntimeHarness( createDelivery(
			StoredProtectionStatisticsDeliveryStatus.COMPLETE,
			[ firstBatch, secondBatch ],
		) );

		await reconcileRuntime( harness.runtime );
		harness.trace.length = 0;
		await harness.runtime.drainProtectionFacts( {
			lastBatchId: firstBatch.batchId,
		} );

		expect( harness.trace ).toEqual( [ 'local:batch_1', 'ack:batch_1' ] );
		expect( await harness.coordinator.getStatisticsDelivery() ).toEqual( createDelivery(
			StoredProtectionStatisticsDeliveryStatus.COMPLETE,
			[ secondBatch ],
		) );
		expect( harness.runtime.getSnapshot().projection ).toMatchObject( {
			status: StatisticsProjectionStatus.AVAILABLE,
			reconsideredVisitCount: 1,
		} );

		await harness.runtime.drainProtectionFacts( {
			lastBatchId: secondBatch.batchId,
		} );
		expect( harness.runtime.getSnapshot().projection ).toMatchObject( {
			status: StatisticsProjectionStatus.AVAILABLE,
			reconsideredVisitCount: 2,
		} );
	} );

	it( 'does not inspect or drain delivery for an explicit unavailable boundary', async () => {
		const harness = createRuntimeHarness( createDelivery(
			StoredProtectionStatisticsDeliveryStatus.COMPLETE,
			[ createReconsideredBatch( 'batch_1' ) ],
		) );

		await reconcileRuntime( harness.runtime );
		harness.trace.length = 0;
		harness.storage.savedDocuments.length = 0;

		await expect( harness.runtime.drainProtectionFacts( null ) ).resolves.toBeUndefined();

		expect( harness.coordinator.deliveryReadCount ).toBe( 0 );
		expect( harness.trace ).toEqual( [] );
		expect( harness.storage.savedDocuments ).toEqual( [] );
		expect( harness.runtime.getSnapshot() ).toMatchObject( {
			deliveryStatus: null,
			focusMeasurementEnabled: false,
			projection: { status: StatisticsProjectionStatus.UNAVAILABLE },
		} );
	} );

	it( 'uses current delivery completeness after a previously captured empty boundary', async () => {
		const harness = createRuntimeHarness( createDelivery(
			StoredProtectionStatisticsDeliveryStatus.INCOMPLETE,
		) );

		await reconcileRuntime( harness.runtime );
		harness.coordinator.replaceDelivery( createDelivery(
			StoredProtectionStatisticsDeliveryStatus.COMPLETE,
		) );
		await harness.runtime.drainProtectionFacts( { lastBatchId: null } );

		expect( harness.runtime.getSnapshot() ).toMatchObject( {
			deliveryStatus: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
			focusMeasurementEnabled: true,
			projection: { status: StatisticsProjectionStatus.AVAILABLE },
		} );
	} );

	it( 'retries a failed local batch save without acknowledging or mutating memory', async () => {
		const batch = createReconsideredBatch( 'batch_1' );
		const harness = createRuntimeHarness( createDelivery(
			StoredProtectionStatisticsDeliveryStatus.COMPLETE,
			[ batch ],
		) );

		await reconcileRuntime( harness.runtime );
		harness.storage.saveFailure = new Error( 'batch save failed' );
		await harness.runtime.drainProtectionFacts();
		expect( harness.trace ).toEqual( [ 'local:reconcile' ] );
		expect( harness.runtime.getSnapshot().projection ).toEqual( {
			status: StatisticsProjectionStatus.UNAVAILABLE,
		} );
		expect( harness.storage.savedDocuments.at( -1 )?.scopes.scope_default?.totals )
			.toMatchObject( { reconsideredVisitCount: 0 } );

		harness.storage.saveFailure = null;
		await harness.runtime.drainProtectionFacts();
		expect( harness.runtime.getSnapshot().projection ).toMatchObject( {
			reconsideredVisitCount: 1,
		} );
		expect( harness.trace.slice( -2 ) ).toEqual( [ 'local:batch_1', 'ack:batch_1' ] );
	} );

	it( 'preserves known incomplete delivery when a retained batch save fails', async () => {
		const harness = createRuntimeHarness( createDelivery(
			StoredProtectionStatisticsDeliveryStatus.INCOMPLETE,
			[ createReconsideredBatch( 'batch_incomplete' ) ],
		) );

		await reconcileRuntime( harness.runtime );
		harness.storage.saveFailure = new Error( 'retained batch save failed' );
		await harness.runtime.drainProtectionFacts();

		expect( harness.runtime.getSnapshot() ).toEqual( {
			deliveryStatus: StoredProtectionStatisticsDeliveryStatus.INCOMPLETE,
			focusMeasurementEnabled: false,
			projection: { status: StatisticsProjectionStatus.UNAVAILABLE },
		} );
		expect( harness.trace ).toEqual( [ 'local:reconcile' ] );
	} );

	it( 'replays an applied head idempotently after acknowledgement failure and stops FIFO progress', async () => {
		const harness = createRuntimeHarness( createDelivery(
			StoredProtectionStatisticsDeliveryStatus.COMPLETE,
			[ createReconsideredBatch( 'batch_1' ), createReconsideredBatch( 'batch_2' ) ],
		) );

		await reconcileRuntime( harness.runtime );
		harness.coordinator.acknowledgementFailure = new Error( 'acknowledgement failed' );
		await harness.runtime.drainProtectionFacts();
		expect( harness.runtime.getSnapshot() ).toMatchObject( {
			deliveryStatus: null,
			projection: { status: StatisticsProjectionStatus.UNAVAILABLE },
		} );
		expect( harness.storage.savedDocuments.at( -1 )?.scopes.scope_default?.totals )
			.toMatchObject( { reconsideredVisitCount: 1 } );
		expect( harness.trace.slice( -2 ) ).toEqual( [ 'local:batch_1', 'ack:batch_1' ] );

		harness.coordinator.acknowledgementFailure = null;
		await harness.runtime.drainProtectionFacts();
		expect( harness.runtime.getSnapshot().projection ).toMatchObject( {
			reconsideredVisitCount: 2,
		} );
		expect( harness.trace.slice( -4 ) ).toEqual( [
			'local:batch_1',
			'ack:batch_1',
			'local:batch_2',
			'ack:batch_2',
		] );
	} );

	it( 'stops after a stale acknowledgement result without advancing another batch', async () => {
		const harness = createRuntimeHarness( createDelivery(
			StoredProtectionStatisticsDeliveryStatus.COMPLETE,
			[ createReconsideredBatch( 'batch_1' ), createReconsideredBatch( 'batch_2' ) ],
		) );

		await reconcileRuntime( harness.runtime );
		harness.coordinator.acknowledgementMatches = false;
		await harness.runtime.drainProtectionFacts();

		expect( harness.trace.slice( -2 ) ).toEqual( [ 'local:batch_1', 'ack:batch_1' ] );
		expect( harness.runtime.getSnapshot() ).toMatchObject( {
			deliveryStatus: null,
			projection: { status: StatisticsProjectionStatus.UNAVAILABLE },
		} );
		expect( harness.storage.savedDocuments.at( -1 )?.scopes.scope_default?.totals )
			.toMatchObject( { reconsideredVisitCount: 1 } );
	} );

	it( 'drains retained incomplete delivery while keeping focus measurement disabled', async () => {
		const harness = createRuntimeHarness( createDelivery(
			StoredProtectionStatisticsDeliveryStatus.INCOMPLETE,
			[ createReconsideredBatch( 'batch_1' ) ],
		) );

		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();
		await checkpointRuntime( harness );

		expect( harness.trace.slice( -2 ) ).toEqual( [ 'local:batch_1', 'ack:batch_1' ] );
		expect( harness.runtime.getSnapshot() ).toMatchObject( {
			deliveryStatus: StoredProtectionStatisticsDeliveryStatus.INCOMPLETE,
			focusMeasurementEnabled: false,
			projection: { status: StatisticsProjectionStatus.UNAVAILABLE },
		} );
		expect( harness.storage.savedDocuments.at( -1 )?.scopes.scope_default?.totals )
			.toMatchObject( { reconsideredVisitCount: 1 } );
	} );

	it.each( [
		StoredProtectionStatisticsDeliveryStatus.COMPLETE,
		StoredProtectionStatisticsDeliveryStatus.INCOMPLETE,
	] )( 'keeps focus disabled when %s delivery is blocked by failed pending replay', async ( status ) => {
		const harness = createRuntimeHarness(
			createDelivery( status ),
			createActiveStatisticsDocument(),
			createPendingSession(
				TEST_NOW_EPOCH_MILLISECONDS - 60_000,
				TEST_NOW_EPOCH_MILLISECONDS - 30_000,
			),
		);

		harness.sessionStorage.loadFailure = new Error( 'session temporarily unavailable' );
		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();

		harness.sessionStorage.loadFailure = null;
		harness.storage.saveFailure = new Error( 'pending replay unavailable' );
		await reconcileRuntime( harness.runtime );
		expect( harness.runtime.getSnapshot().focusMeasurementEnabled ).toBe( false );

		const deliveryReadsBeforeBlockedOperations = harness.coordinator.deliveryReadCount;
		await checkpointRuntime( harness );
		await harness.runtime.drainProtectionFacts();

		expect( harness.coordinator.deliveryReadCount ).toBe(
			deliveryReadsBeforeBlockedOperations,
		);
		expect( harness.runtime.getSnapshot().deliveryStatus ).toBeNull();
	} );

	it( 'blocks delivery while pending replay session cleanup is unavailable', async () => {
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE ),
			createActiveStatisticsDocument(),
			createPendingSession(
				TEST_NOW_EPOCH_MILLISECONDS - 60_000,
				TEST_NOW_EPOCH_MILLISECONDS - 30_000,
			),
		);

		harness.sessionStorage.loadFailure = new Error( 'session temporarily unavailable' );
		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();

		harness.sessionStorage.loadFailure = null;
		harness.sessionStorage.saveFailure = new Error( 'session cleanup unavailable' );
		await reconcileRuntime( harness.runtime );
		const deliveryReadsBeforeRetry = harness.coordinator.deliveryReadCount;
		await harness.runtime.drainProtectionFacts();

		expect( harness.coordinator.deliveryReadCount ).toBe( deliveryReadsBeforeRetry );
		expect( harness.runtime.getSnapshot() ).toMatchObject( {
			deliveryStatus: null,
			focusMeasurementEnabled: false,
		} );
	} );

	it( 'reconciles and drains a prototype-named scope through own properties', async () => {
		const scopeId = '__proto__';
		const configuration = ProtectionConfigurationDocumentSchema.parse( {
			...TEST_CONFIGURATION,
			sites: [ {
				identityHost: 'example.com',
				rule: { host: 'example.com', includeSubdomains: false, scopeId },
			} ],
			schedulesByScope: Object.fromEntries( [
				[ 'scope_default', TEST_CONFIGURATION.schedulesByScope.scope_default ],
				[ scopeId, TEST_CONFIGURATION.schedulesByScope.scope_default ],
			] ),
			measurementRevisionsByScope: Object.fromEntries( [
				[ 'scope_default', 'revision_current' ],
				[ scopeId, 'revision_prototype' ],
			] ),
		} );
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE, [
				createReconsideredBatch( 'batch_magic', scopeId, 'revision_prototype' ),
			] ),
			createStatisticsDocument( scopeId, 'revision_old' ),
		);

		await reconcileRuntime( harness.runtime, configuration );
		await harness.runtime.drainProtectionFacts();

		expect( harness.runtime.getSnapshot().projection ).toMatchObject( {
			status: StatisticsProjectionStatus.AVAILABLE,
			reconsideredVisitCount: 1,
		} );
	} );
} );
