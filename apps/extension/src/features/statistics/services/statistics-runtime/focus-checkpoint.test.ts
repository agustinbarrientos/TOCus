import { describe, expect, it, vi } from 'vitest';
import { createWaitingState } from '../../../../domains/protection/types/__fixtures__';
import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { SessionContinuityIdSchema } from '../../../../domains/protection/types/protection-value';
import { StoredProtectionStatisticsDeliveryStatus } from '../../../../domains/protection/types/stored-protection-statistics-delivery';
import { StatisticsDocumentSchema } from '../../../../domains/statistics/types/statistics-document';
import { StatisticsProjectionStatus } from '../../../../domains/statistics/types/statistics-projection';
import * as checkpointPreparation from '../../../../domains/statistics/utils/prepare-statistics-checkpoint';
import { StatisticsFocusObservationMode } from '../../../../domains/statistics/utils/prepare-statistics-checkpoint';
import * as focusedAllowanceResolution from '../../utils/resolve-focused-allowance';
import { createStatisticsRuntime } from './index';
import {
	TEST_CONFIGURATION,
	TEST_FOCUS_EPOCH_ID,
	TEST_NOW_EPOCH_MILLISECONDS,
	TEST_SESSION_CONTINUITY_ID,
	checkpointRuntime,
	createActiveStatisticsDocument,
	createAllowanceBatch,
	createDelivery,
	createFocusSession,
	createMatchingAllowanceState,
	createPendingSession,
	createRuntimeHarness,
	createTestCheckpointObservation,
	createTwoScopeActiveStatisticsDocument,
	createTwoScopeConfiguration,
	reconcileRuntime,
} from './__fixtures__';

describe( 'statistics runtime focus checkpointing', () => {
	it.each( [
		StatisticsFocusObservationMode.STARTUP,
		StatisticsFocusObservationMode.SAMPLE,
	] )( 'reuses the current focus epoch for a %s observation', async ( mode ) => {
		const harness = createRuntimeHarness();

		await expect( harness.runtime.beginFocusObservation( mode ) ).resolves.toEqual( {
			mode,
			previousFocusEpochId: mode === StatisticsFocusObservationMode.STARTUP
				? null
				: TEST_FOCUS_EPOCH_ID,
			currentFocusEpochId: TEST_FOCUS_EPOCH_ID,
		} );
		expect( harness.sessionStorage.focusEpochRotationCount ).toBe( 0 );
	} );

	it( 'persists a new focus epoch before returning a browser boundary', async () => {
		const harness = createRuntimeHarness();

		await expect( harness.runtime.beginFocusObservation(
			StatisticsFocusObservationMode.BOUNDARY,
		) ).resolves.toEqual( {
			mode: StatisticsFocusObservationMode.BOUNDARY,
			previousFocusEpochId: TEST_FOCUS_EPOCH_ID,
			currentFocusEpochId: 'focus_epoch_rotated_1',
		} );
		expect( harness.sessionStorage.focusEpochRotationCount ).toBe( 1 );
	} );

	it( 'contains focus epoch persistence failures and refuses a checkpoint context', async () => {
		const harness = createRuntimeHarness();

		harness.sessionStorage.focusEpochFailure = new Error( 'Focus epoch unavailable.' );

		await expect( harness.runtime.beginFocusObservation(
			StatisticsFocusObservationMode.BOUNDARY,
		) ).resolves.toBeNull();
	} );

	it( 'discards persisted focus work even before aggregate initialization', async () => {
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE ),
			createActiveStatisticsDocument(),
			createFocusSession( TEST_NOW_EPOCH_MILLISECONDS - 60_000 ),
		);

		await expect( harness.runtime.discardFocusMeasurement() ).resolves.toBeUndefined();
		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();

		expect( harness.sessionStorage.removedDocuments ).toHaveLength( 1 );
		expect( harness.sessionStorage.loadCount ).toBe( 1 );
		expect( harness.runtime.getSnapshot().focusMeasurementEnabled ).toBe( true );
	} );

	it( 'does not reload an unsafe focus anchor while fail-open cleanup is retrying', async () => {
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE ),
			createActiveStatisticsDocument(),
			createFocusSession( TEST_NOW_EPOCH_MILLISECONDS - 60_000 ),
		);

		harness.sessionStorage.removeFailure = new Error( 'Session cleanup unavailable.' );
		await harness.runtime.discardFocusMeasurement();
		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();

		expect( harness.sessionStorage.loadCount ).toBe( 0 );
		expect( harness.runtime.getSnapshot().focusMeasurementEnabled ).toBe( false );

		harness.sessionStorage.removeFailure = null;
		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();
		harness.coordinator.states = { scope_default: createMatchingAllowanceState() };
		harness.browser.focusedTabId = 7;
		harness.browser.tabs = [ {
			id: 7,
			incognito: false,
			url: 'https://example.com/',
		} ];
		harness.clock.nowEpochMilliseconds += 60_000;

		await checkpointRuntime( harness );

		expect( harness.sessionStorage.loadCount ).toBe( 0 );
		expect( harness.runtime.getSnapshot().projection ).toMatchObject( {
			status: StatisticsProjectionStatus.AVAILABLE,
			focusedPauseMilliseconds: 0,
		} );
	} );

	it( 'preserves a focused allowance across a normal background runtime restart', async () => {
		const anchorTime = TEST_NOW_EPOCH_MILLISECONDS - 60_000;
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE ),
			createActiveStatisticsDocument(),
			createFocusSession( anchorTime ),
		);
		const restartedRuntime = createStatisticsRuntime( harness.options );

		harness.coordinator.states = { scope_default: createMatchingAllowanceState() };
		harness.browser.focusedTabId = 7;
		harness.browser.tabs = [ {
			id: 7,
			incognito: false,
			url: 'https://example.com/',
		} ];
		await reconcileRuntime( restartedRuntime );
		await restartedRuntime.drainProtectionFacts();
		const startupTransition = await restartedRuntime.beginFocusObservation(
			StatisticsFocusObservationMode.STARTUP,
		);
		await restartedRuntime.checkpoint(
			TEST_CONFIGURATION,
			createTestCheckpointObservation(
				harness,
				TEST_CONFIGURATION,
				undefined,
				startupTransition,
			),
		);

		expect( restartedRuntime.getSnapshot().projection ).toMatchObject( {
			focusedPauseMilliseconds: 0,
		} );

		const sampleTransition = await restartedRuntime.beginFocusObservation(
			StatisticsFocusObservationMode.SAMPLE,
		);
		await restartedRuntime.checkpoint(
			TEST_CONFIGURATION,
			createTestCheckpointObservation(
				harness,
				TEST_CONFIGURATION,
				undefined,
				sampleTransition,
			),
		);

		expect(
			harness.storage.savedDocuments.at( -1 )?.scopes.scope_default?.activeAllowance,
		).toMatchObject( { confirmedFocusedUseMilliseconds: 60_000 } );
		expect( harness.sessionStorage.savedDocuments.at( -1 )?.focusAnchor ).toMatchObject( {
			sessionContinuityId: TEST_SESSION_CONTINUITY_ID,
			focusEpochId: TEST_FOCUS_EPOCH_ID,
			focusedAtEpochMilliseconds: TEST_NOW_EPOCH_MILLISECONDS,
		} );
	} );

	it( 'does not bridge a focus anchor across a different browser session', async () => {
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE ),
			createActiveStatisticsDocument(),
			createFocusSession( TEST_NOW_EPOCH_MILLISECONDS - 60_000 ),
		);

		harness.coordinator.sessionContinuityId = SessionContinuityIdSchema.parse( 'session_next' );
		harness.coordinator.states = { scope_default: createMatchingAllowanceState() };
		harness.browser.focusedTabId = 7;
		harness.browser.tabs = [ { id: 7, incognito: false, url: 'https://example.com/' } ];
		const restartedRuntime = createStatisticsRuntime( harness.options );

		await reconcileRuntime( restartedRuntime );
		await restartedRuntime.drainProtectionFacts();
		const transition = await restartedRuntime.beginFocusObservation(
			StatisticsFocusObservationMode.SAMPLE,
		);
		await restartedRuntime.checkpoint(
			TEST_CONFIGURATION,
			createTestCheckpointObservation( harness, TEST_CONFIGURATION, undefined, transition ),
		);

		expect( restartedRuntime.getSnapshot().projection ).toMatchObject( {
			focusedPauseMilliseconds: 0,
		} );
		expect( harness.sessionStorage.savedDocuments.at( -1 )?.focusAnchor ).toMatchObject( {
			sessionContinuityId: 'session_next',
			focusedAtEpochMilliseconds: TEST_NOW_EPOCH_MILLISECONDS,
		} );
	} );

	it( 'discards the last focus anchor after statistics become unavailable', async () => {
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE ),
			createActiveStatisticsDocument(),
			createFocusSession( TEST_NOW_EPOCH_MILLISECONDS - 60_000 ),
		);

		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();
		expect( harness.sessionStorage.loadCount ).toBe( 1 );

		await reconcileRuntime( harness.runtime, null );
		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();

		expect( harness.sessionStorage.loadCount ).toBe( 1 );
		expect( harness.sessionStorage.removedDocuments ).toHaveLength( 1 );
	} );

	it( 'replays frozen work after unavailable initialization discards its live anchor', async () => {
		const intervalStartedAt = TEST_NOW_EPOCH_MILLISECONDS - 60_000;
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE ),
			createActiveStatisticsDocument(),
			createPendingSession(
				intervalStartedAt,
				TEST_NOW_EPOCH_MILLISECONDS,
			),
		);

		await reconcileRuntime( harness.runtime, null );
		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();

		expect( harness.sessionStorage.loadCount ).toBe( 0 );
		expect( harness.sessionStorage.savedDocuments[ 0 ] ).toEqual( {
			schemaVersion: 1,
			pendingInterval: {
				generationId: 'generation_test',
				scopeId: 'scope_default',
				measurementRevision: 'revision_current',
				allowanceId: 'allowance_current',
				startedAtEpochMilliseconds: intervalStartedAt,
				endedAtEpochMilliseconds: TEST_NOW_EPOCH_MILLISECONDS,
			},
		} );
		expect(
			harness.storage.savedDocuments.at( -1 )?.scopes.scope_default?.activeAllowance,
		).toMatchObject( {
			confirmedFocusedUseMilliseconds: 60_000,
			accountedThroughEpochMilliseconds: TEST_NOW_EPOCH_MILLISECONDS,
		} );
		expect( harness.sessionStorage.removedDocuments ).toHaveLength( 1 );
		expect( harness.runtime.getSnapshot().focusMeasurementEnabled ).toBe( true );
	} );

	it( 'persists a frozen old interval and next anchor before local aggregation', async () => {
		const anchorTime = TEST_NOW_EPOCH_MILLISECONDS - 60_000;
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE ),
			createActiveStatisticsDocument(),
			createFocusSession( anchorTime ),
		);

		harness.coordinator.states = {
			scope_default: createMatchingAllowanceState(),
		};
		harness.browser.focusedTabId = 7;
		harness.browser.tabs = [ {
			id: 7,
			incognito: false,
			url: 'https://example.com/private-path',
		} ];
		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();
		harness.trace.length = 0;
		harness.storage.savedDocuments.length = 0;
		harness.sessionStorage.savedDocuments.length = 0;

		await expect( checkpointRuntime( harness, TEST_CONFIGURATION, {
			frameId: 0,
			tabId: 7,
			url: 'https://example.com/navigating',
		} ) ).resolves.toBeUndefined();

		expect( harness.trace ).toEqual( [
			'session:wal',
			'local:reconcile',
			'session:anchor',
		] );
		expect( harness.sessionStorage.savedDocuments[ 0 ] ).toEqual( {
			schemaVersion: 1,
			focusAnchor: {
				generationId: 'generation_test',
				scopeId: 'scope_default',
				measurementRevision: 'revision_current',
				allowanceId: 'allowance_current',
				sessionContinuityId: TEST_SESSION_CONTINUITY_ID,
				focusEpochId: TEST_FOCUS_EPOCH_ID,
				focusedAtEpochMilliseconds: TEST_NOW_EPOCH_MILLISECONDS,
			},
			pendingInterval: {
				generationId: 'generation_test',
				scopeId: 'scope_default',
				measurementRevision: 'revision_current',
				allowanceId: 'allowance_current',
				startedAtEpochMilliseconds: anchorTime,
				endedAtEpochMilliseconds: TEST_NOW_EPOCH_MILLISECONDS,
			},
		} );
		expect(
			harness.storage.savedDocuments.at( -1 )?.scopes.scope_default?.activeAllowance,
		).toMatchObject( {
			confirmedFocusedUseMilliseconds: 60_000,
			accountedThroughEpochMilliseconds: TEST_NOW_EPOCH_MILLISECONDS,
		} );
		expect( harness.sessionStorage.savedDocuments.at( -1 ) ).toEqual( {
			schemaVersion: 1,
			focusAnchor: {
				generationId: 'generation_test',
				scopeId: 'scope_default',
				measurementRevision: 'revision_current',
				allowanceId: 'allowance_current',
				sessionContinuityId: TEST_SESSION_CONTINUITY_ID,
				focusEpochId: TEST_FOCUS_EPOCH_ID,
				focusedAtEpochMilliseconds: TEST_NOW_EPOCH_MILLISECONDS,
			},
		} );
		expect( JSON.stringify( {
			local: harness.storage.savedDocuments,
			session: harness.sessionStorage.savedDocuments,
		} ) ).not.toMatch( /private-path|"id":7/ );
	} );

	it( 'uses captured event times when checkpoint persistence is delayed', async () => {
		const initialTime = TEST_NOW_EPOCH_MILLISECONDS;
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE ),
			createActiveStatisticsDocument(),
			createFocusSession( initialTime ),
		);

		harness.coordinator.states = { scope_default: createMatchingAllowanceState() };
		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();
		harness.clock.nowEpochMilliseconds = initialTime + 10_000;
		harness.browser.focusedTabId = null;
		const blurTransition = await harness.runtime.beginFocusObservation(
			StatisticsFocusObservationMode.BOUNDARY,
		);
		const blurObservation = createTestCheckpointObservation(
			harness,
			TEST_CONFIGURATION,
			undefined,
			blurTransition,
		);
		harness.clock.nowEpochMilliseconds = initialTime + 20_000;
		harness.browser.focusedTabId = 7;
		harness.browser.tabs = [ {
			id: 7,
			incognito: false,
			url: 'https://example.com/',
		} ];
		const refocusTransition = await harness.runtime.beginFocusObservation(
			StatisticsFocusObservationMode.BOUNDARY,
		);
		const refocusObservation = createTestCheckpointObservation(
			harness,
			TEST_CONFIGURATION,
			undefined,
			refocusTransition,
		);
		harness.clock.nowEpochMilliseconds = initialTime + 50_000;

		await harness.runtime.checkpoint( TEST_CONFIGURATION, blurObservation );
		await harness.runtime.checkpoint( TEST_CONFIGURATION, refocusObservation );

		expect(
			harness.storage.savedDocuments.at( -1 )?.scopes.scope_default?.activeAllowance,
		).toMatchObject( { confirmedFocusedUseMilliseconds: 10_000 } );
		expect( harness.sessionStorage.savedDocuments.at( -1 )?.focusAnchor ).toMatchObject( {
			focusedAtEpochMilliseconds: initialTime + 20_000,
		} );
	} );

	it( 'closes a prior anchor at a focus boundary when asynchronous inspection is stale', async () => {
		const boundaryAtEpochMilliseconds = TEST_NOW_EPOCH_MILLISECONDS;
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE ),
			createActiveStatisticsDocument(),
			createFocusSession( boundaryAtEpochMilliseconds - 30_000 ),
		);

		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();
		const focusEpochTransition = await harness.runtime.beginFocusObservation(
			StatisticsFocusObservationMode.BOUNDARY,
		);
		await harness.runtime.checkpoint( TEST_CONFIGURATION, {
			observedAtEpochMilliseconds: boundaryAtEpochMilliseconds,
			focusEpochTransition,
			focusObservation: null,
		} );

		expect(
			harness.storage.savedDocuments.at( -1 )?.scopes.scope_default?.activeAllowance,
		).toMatchObject( { confirmedFocusedUseMilliseconds: 30_000 } );
		expect( harness.sessionStorage.removedDocuments ).toHaveLength( 1 );
	} );

	it( 'records final focused use when protection expires before checkpoint state is captured', async () => {
		const expiryAtEpochMilliseconds = TEST_NOW_EPOCH_MILLISECONDS + 180_000;
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE ),
			createActiveStatisticsDocument(),
			createFocusSession( expiryAtEpochMilliseconds - 60_000 ),
		);
		const expiredState = {
			...createWaitingState(),
			scopeId: createMatchingAllowanceState().scopeId,
		};

		harness.clock.nowEpochMilliseconds = expiryAtEpochMilliseconds;
		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();
		const focusEpochTransition = await harness.runtime.beginFocusObservation(
			StatisticsFocusObservationMode.BOUNDARY,
		);
		await harness.runtime.checkpoint( TEST_CONFIGURATION, {
			observedAtEpochMilliseconds: expiryAtEpochMilliseconds,
			focusEpochTransition,
			focusObservation: {
				focusedAtEpochMilliseconds: expiryAtEpochMilliseconds,
				focusedTabId: 7,
				statesByScope: { scope_default: expiredState },
				tabs: [ { id: 7, incognito: false, url: 'https://example.com/' } ],
			},
		} );

		expect(
			harness.storage.savedDocuments.at( -1 )?.scopes.scope_default?.latestBaseline,
		).toMatchObject( { focusedUseMilliseconds: 60_000 } );
		expect( harness.sessionStorage.removedDocuments ).toHaveLength( 1 );
	} );

	it.each( [
		[ 'unsafe', Number.NaN ],
		[ 'predating', TEST_NOW_EPOCH_MILLISECONDS - 1 ],
	] )( 'closes a prior anchor for a %s post-inspection focus time', async ( _, focusedAt ) => {
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE ),
			createActiveStatisticsDocument(),
			createFocusSession( TEST_NOW_EPOCH_MILLISECONDS - 30_000 ),
		);

		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();
		const focusEpochTransition = await harness.runtime.beginFocusObservation(
			StatisticsFocusObservationMode.BOUNDARY,
		);
		await harness.runtime.checkpoint( TEST_CONFIGURATION, {
			observedAtEpochMilliseconds: TEST_NOW_EPOCH_MILLISECONDS,
			focusEpochTransition,
			focusObservation: {
				focusedAtEpochMilliseconds: focusedAt,
				focusedTabId: 7,
				statesByScope: { scope_default: createMatchingAllowanceState() },
				tabs: [ { id: 7, incognito: false, url: 'https://example.com/' } ],
			},
		} );

		expect( harness.sessionStorage.removedDocuments ).toHaveLength( 1 );
	} );

	it( 'replays frozen work before a retained incomplete batch replaces its allowance', async () => {
		const oldStartedAt = TEST_NOW_EPOCH_MILLISECONDS - 600_000;
		const pendingStartedAt = TEST_NOW_EPOCH_MILLISECONDS - 500_000;
		const pendingEndedAt = TEST_NOW_EPOCH_MILLISECONDS - 400_000;
		const nextBatch = createAllowanceBatch(
			'batch_next',
			'allowance_next',
			TEST_NOW_EPOCH_MILLISECONDS,
		);
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.INCOMPLETE, [ nextBatch ] ),
			createActiveStatisticsDocument(
				'scope_default',
				'revision_current',
				'allowance_current',
				oldStartedAt,
			),
			createPendingSession( pendingStartedAt, pendingEndedAt, null ),
		);

		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();

		expect( harness.trace ).toEqual( [
			'local:reconcile',
			'local:reconcile',
			'session:remove',
			'local:batch_next',
			'ack:batch_next',
		] );
		expect( harness.storage.savedDocuments[ 1 ]?.scopes.scope_default?.activeAllowance )
			.toMatchObject( { confirmedFocusedUseMilliseconds: 100_000 } );
		expect( harness.storage.savedDocuments.at( -1 )?.scopes.scope_default ).toMatchObject( {
			latestBaseline: {
				measurementRevision: 'revision_current',
				focusedUseMilliseconds: 100_000,
			},
			activeAllowance: { allowanceId: 'allowance_next' },
		} );
		expect( harness.runtime.getSnapshot() ).toEqual( {
			deliveryStatus: StoredProtectionStatisticsDeliveryStatus.INCOMPLETE,
			focusMeasurementEnabled: false,
			projection: { status: StatisticsProjectionStatus.UNAVAILABLE },
		} );
	} );

	it( 'replays a WAL after local aggregation failed without double counting', async () => {
		const anchorTime = TEST_NOW_EPOCH_MILLISECONDS - 60_000;
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE ),
			createActiveStatisticsDocument(),
			createFocusSession( anchorTime ),
		);

		harness.coordinator.states = { scope_default: createMatchingAllowanceState() };
		harness.browser.focusedTabId = 7;
		harness.browser.tabs = [ {
			id: 7,
			incognito: false,
			url: 'https://example.com/',
		} ];
		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();
		harness.storage.saveFailure = new Error( 'local aggregation unavailable' );

		await checkpointRuntime( harness );
		expect( harness.sessionStorage.savedDocuments.at( -1 )?.pendingInterval )
			.toMatchObject( { startedAtEpochMilliseconds: anchorTime } );

		harness.storage.saveFailure = null;
		await checkpointRuntime( harness );
		expect(
			harness.storage.savedDocuments.at( -1 )?.scopes.scope_default?.activeAllowance,
		).toMatchObject( { confirmedFocusedUseMilliseconds: 60_000 } );
		expect( harness.sessionStorage.savedDocuments.at( -1 )?.pendingInterval ).toBeUndefined();
	} );

	it( 'preserves frozen work while discarding its unsafe live anchor', async () => {
		const anchorTime = TEST_NOW_EPOCH_MILLISECONDS - 60_000;
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE ),
			createActiveStatisticsDocument(),
			createFocusSession( anchorTime ),
		);

		harness.coordinator.states = { scope_default: createMatchingAllowanceState() };
		harness.browser.focusedTabId = 7;
		harness.browser.tabs = [ {
			id: 7,
			incognito: false,
			url: 'https://example.com/',
		} ];
		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();
		harness.storage.saveFailure = new Error( 'local aggregation unavailable' );
		await checkpointRuntime( harness );
		harness.storage.saveFailure = null;

		await harness.runtime.discardFocusMeasurement();
		expect( harness.sessionStorage.savedDocuments.at( -1 ) ).toMatchObject( {
			pendingInterval: {
				startedAtEpochMilliseconds: anchorTime,
				endedAtEpochMilliseconds: TEST_NOW_EPOCH_MILLISECONDS,
			},
		} );
		expect( harness.sessionStorage.savedDocuments.at( -1 )?.focusAnchor ).toBeUndefined();

		const restartedRuntime = createStatisticsRuntime( harness.options );

		await reconcileRuntime( restartedRuntime );
		await restartedRuntime.drainProtectionFacts();
		expect(
			harness.storage.savedDocuments.at( -1 )?.scopes.scope_default?.activeAllowance,
		).toMatchObject( { confirmedFocusedUseMilliseconds: 60_000 } );
		expect( harness.sessionStorage.removedDocuments ).toHaveLength( 1 );
	} );

	it( 'does not aggregate when the first write-ahead save fails and starts fresh on retry', async () => {
		const anchorTime = TEST_NOW_EPOCH_MILLISECONDS - 60_000;
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE ),
			createActiveStatisticsDocument(),
			createFocusSession( anchorTime ),
		);

		harness.coordinator.states = { scope_default: createMatchingAllowanceState() };
		harness.browser.focusedTabId = 7;
		harness.browser.tabs = [ {
			id: 7,
			incognito: false,
			url: 'https://example.com/',
		} ];
		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();
		harness.storage.savedDocuments.length = 0;
		harness.sessionStorage.failSaveAtCount = harness.sessionStorage.saveCount + 1;

		await checkpointRuntime( harness );
		expect( harness.storage.savedDocuments ).toEqual( [] );
		expect( harness.runtime.getSnapshot().focusMeasurementEnabled ).toBe( false );

		harness.sessionStorage.failSaveAtCount = null;
		await checkpointRuntime( harness );
		expect( harness.storage.savedDocuments ).toEqual( [] );
		expect( harness.sessionStorage.savedDocuments.at( -1 )?.focusAnchor )
			.toMatchObject( { focusedAtEpochMilliseconds: TEST_NOW_EPOCH_MILLISECONDS } );
		expect( harness.runtime.getSnapshot().focusMeasurementEnabled ).toBe( true );
	} );

	it( 'replays a durably written interval when its write reports failure', async () => {
		const anchorTime = TEST_NOW_EPOCH_MILLISECONDS - 60_000;
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE ),
			createActiveStatisticsDocument(),
			createFocusSession( anchorTime ),
		);

		harness.coordinator.states = { scope_default: createMatchingAllowanceState() };
		harness.browser.focusedTabId = 7;
		harness.browser.tabs = [ {
			id: 7,
			incognito: false,
			url: 'https://example.com/',
		} ];
		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();
		harness.storage.savedDocuments.length = 0;
		harness.sessionStorage.failSaveAfterPersistAtCount =
			harness.sessionStorage.saveCount + 1;

		await checkpointRuntime( harness );
		expect( harness.storage.savedDocuments ).toEqual( [] );
		expect( harness.sessionStorage.savedDocuments.at( -1 )?.pendingInterval )
			.toMatchObject( { startedAtEpochMilliseconds: anchorTime } );
		expect( harness.runtime.getSnapshot().focusMeasurementEnabled ).toBe( false );

		harness.sessionStorage.failSaveAfterPersistAtCount = null;
		await checkpointRuntime( harness );

		expect(
			harness.storage.savedDocuments.at( -1 )?.scopes.scope_default?.activeAllowance,
		).toMatchObject( {
			confirmedFocusedUseMilliseconds: 60_000,
			accountedThroughEpochMilliseconds: TEST_NOW_EPOCH_MILLISECONDS,
		} );
		expect( harness.sessionStorage.removedDocuments ).toHaveLength( 1 );
		expect( harness.sessionStorage.savedDocuments.at( -1 )?.focusAnchor ).toMatchObject( {
			focusedAtEpochMilliseconds: TEST_NOW_EPOCH_MILLISECONDS,
		} );
		expect( harness.sessionStorage.savedDocuments.at( -1 )?.pendingInterval ).toBeUndefined();
		expect( harness.runtime.getSnapshot().focusMeasurementEnabled ).toBe( true );
	} );

	it( 'replays a committed interval when final session cleanup failed without double counting', async () => {
		const anchorTime = TEST_NOW_EPOCH_MILLISECONDS - 60_000;
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE ),
			createActiveStatisticsDocument(),
			createFocusSession( anchorTime ),
		);

		harness.coordinator.states = { scope_default: createMatchingAllowanceState() };
		harness.browser.focusedTabId = 7;
		harness.browser.tabs = [ {
			id: 7,
			incognito: false,
			url: 'https://example.com/',
		} ];
		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();
		harness.sessionStorage.failSaveAtCount = harness.sessionStorage.saveCount + 2;

		await checkpointRuntime( harness );
		expect(
			harness.storage.savedDocuments.at( -1 )?.scopes.scope_default?.activeAllowance,
		).toMatchObject( { confirmedFocusedUseMilliseconds: 60_000 } );
		expect( harness.sessionStorage.savedDocuments.at( -1 )?.pendingInterval )
			.toMatchObject( { startedAtEpochMilliseconds: anchorTime } );

		harness.sessionStorage.failSaveAtCount = null;
		await checkpointRuntime( harness );
		expect(
			harness.storage.savedDocuments.at( -1 )?.scopes.scope_default?.activeAllowance,
		).toMatchObject( { confirmedFocusedUseMilliseconds: 60_000 } );
		expect( harness.sessionStorage.savedDocuments.at( -1 )?.pendingInterval ).toBeUndefined();
	} );

	it( 'discards a backward interval and reanchors at the current wall clock', async () => {
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE ),
			createActiveStatisticsDocument(),
			createFocusSession( TEST_NOW_EPOCH_MILLISECONDS + 60_000 ),
		);

		harness.coordinator.states = { scope_default: createMatchingAllowanceState() };
		harness.browser.focusedTabId = 7;
		harness.browser.tabs = [ {
			id: 7,
			incognito: false,
			url: 'https://example.com/',
		} ];
		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();
		harness.storage.savedDocuments.length = 0;

		await checkpointRuntime( harness );

		expect( harness.storage.savedDocuments ).toEqual( [] );
		expect( harness.sessionStorage.savedDocuments.at( -1 )?.focusAnchor )
			.toMatchObject( { focusedAtEpochMilliseconds: TEST_NOW_EPOCH_MILLISECONDS } );
		expect( harness.sessionStorage.savedDocuments.at( -1 )?.pendingInterval ).toBeUndefined();
	} );

	it( 'closes an old anchor on observation failure and never bridges the lost interval', async () => {
		const anchorTime = TEST_NOW_EPOCH_MILLISECONDS - 60_000;
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE ),
			createActiveStatisticsDocument(),
			createFocusSession( anchorTime ),
		);

		harness.coordinator.states = { scope_default: createMatchingAllowanceState() };
		harness.browser.focusedTabFailure = new Error( 'focused window unavailable' );
		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();
		harness.storage.savedDocuments.length = 0;

		await checkpointRuntime( harness );
		expect( harness.sessionStorage.removedDocuments ).toHaveLength( 1 );
		expect( harness.storage.savedDocuments ).toEqual( [] );

		harness.browser.focusedTabFailure = null;
		harness.browser.focusedTabId = 7;
		harness.browser.tabs = [ {
			id: 7,
			incognito: false,
			url: 'https://example.com/',
		} ];
		harness.clock.nowEpochMilliseconds += 60_000;
		await checkpointRuntime( harness );

		expect( harness.storage.savedDocuments ).toEqual( [] );
		expect( harness.sessionStorage.savedDocuments.at( -1 )?.focusAnchor )
			.toMatchObject( { focusedAtEpochMilliseconds: TEST_NOW_EPOCH_MILLISECONDS + 60_000 } );
	} );

	it( 'contains failed anchor closure and retries cleanup before the next checkpoint', async () => {
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE ),
			createActiveStatisticsDocument(),
			createFocusSession( TEST_NOW_EPOCH_MILLISECONDS - 60_000 ),
		);

		harness.browser.focusedTabFailure = new Error( 'focused window unavailable' );
		harness.sessionStorage.removeFailure = new Error( 'session removal unavailable' );
		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();

		await checkpointRuntime( harness );
		expect( harness.runtime.getSnapshot().focusMeasurementEnabled ).toBe( false );

		harness.browser.focusedTabFailure = null;
		await checkpointRuntime( harness );

		expect( harness.sessionStorage.removedDocuments ).toEqual( [] );
	} );

	it.each( [
		'missing filtered configuration',
		'clock failure',
		'non-integer clock',
		'negative clock',
		'uninitialized protection state',
	] )( 'closes an old anchor for %s', async ( scenario ) => {
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE ),
			createActiveStatisticsDocument(),
			createFocusSession( TEST_NOW_EPOCH_MILLISECONDS - 60_000 ),
		);
		let filteredConfiguration: ProtectionConfigurationDocument | null = TEST_CONFIGURATION;

		if ( scenario === 'missing filtered configuration' ) {
			filteredConfiguration = null;
		} else if ( scenario === 'clock failure' ) {
			harness.clock.failure = new Error( 'clock unavailable' );
		} else if ( scenario === 'non-integer clock' ) {
			harness.clock.nowEpochMilliseconds = Number.NaN;
		} else if ( scenario === 'negative clock' ) {
			harness.clock.nowEpochMilliseconds = -1;
		} else {
			harness.coordinator.states = null;
		}

		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();
		harness.storage.savedDocuments.length = 0;

		await expect(
			checkpointRuntime( harness, filteredConfiguration ),
		).resolves.toBeUndefined();
		expect( harness.sessionStorage.removedDocuments ).toHaveLength( 1 );
		expect( harness.storage.savedDocuments ).toEqual( [] );
	} );

	it( 'contains an unexpected pure checkpoint preparation failure', async () => {
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE ),
			createActiveStatisticsDocument(),
		);

		harness.coordinator.states = { scope_default: createMatchingAllowanceState() };
		harness.browser.focusedTabId = 7;
		harness.browser.tabs = [ {
			id: 7,
			incognito: false,
			url: 'https://example.com/',
		} ];
		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();
		harness.storage.savedDocuments.length = 0;
		const preparation = vi.spyOn(
			checkpointPreparation,
			'prepareStatisticsCheckpoint',
		).mockImplementationOnce( () => {
			throw new Error( 'unexpected checkpoint preparation failure' );
		} );

		await expect( checkpointRuntime( harness ) ).resolves.toBeUndefined();
		preparation.mockRestore();

		expect( harness.storage.savedDocuments ).toEqual( [] );
		expect( harness.sessionStorage.savedDocuments ).toEqual( [] );
	} );

	it( 'closes the focus anchor when focused allowance resolution fails unexpectedly', async () => {
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE ),
			createActiveStatisticsDocument(),
			createFocusSession( TEST_NOW_EPOCH_MILLISECONDS - 60_000 ),
		);

		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();
		harness.trace.length = 0;
		harness.storage.savedDocuments.length = 0;
		const resolution = vi.spyOn(
			focusedAllowanceResolution,
			'resolveFocusedAllowance',
		).mockImplementationOnce( () => {
			throw new Error( 'unexpected focused allowance resolution failure' );
		} );

		await expect( checkpointRuntime( harness ) ).resolves.toBeUndefined();
		resolution.mockRestore();

		expect( harness.trace ).toEqual( [ 'session:remove' ] );
		expect( harness.sessionStorage.removedDocuments ).toHaveLength( 1 );
		expect( harness.storage.savedDocuments ).toEqual( [] );
	} );

	it( 'charges the old allowance before switching the persisted anchor to another scope', async () => {
		const configuration = createTwoScopeConfiguration();
		const anchorTime = TEST_NOW_EPOCH_MILLISECONDS - 30_000;
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE ),
			createTwoScopeActiveStatisticsDocument(),
			createFocusSession( anchorTime ),
		);

		harness.coordinator.states = {
			scope_default: createMatchingAllowanceState(),
			scope_other: createMatchingAllowanceState(
				'scope_other',
				'allowance_other',
			),
		};
		harness.browser.focusedTabId = 8;
		harness.browser.tabs = [ {
			id: 8,
			incognito: false,
			url: 'https://other.example/',
		} ];
		await reconcileRuntime( harness.runtime, configuration );
		await harness.runtime.drainProtectionFacts();

		await checkpointRuntime(
			harness,
			configuration,
			undefined,
			StatisticsFocusObservationMode.BOUNDARY,
		);

		expect(
			harness.storage.savedDocuments.at( -1 )?.scopes.scope_default?.activeAllowance,
		).toMatchObject( { confirmedFocusedUseMilliseconds: 30_000 } );
		expect( harness.sessionStorage.savedDocuments.at( -1 )?.focusAnchor ).toMatchObject( {
			scopeId: 'scope_other',
			allowanceId: 'allowance_other',
		} );
	} );

	it( 'closes focus on loss and refuses to create private or unknown-private anchors', async () => {
		const anchorTime = TEST_NOW_EPOCH_MILLISECONDS - 30_000;
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE ),
			createActiveStatisticsDocument(),
			createFocusSession( anchorTime ),
		);

		harness.coordinator.states = { scope_default: createMatchingAllowanceState() };
		await reconcileRuntime( harness.runtime );
		await harness.runtime.drainProtectionFacts();

		await checkpointRuntime(
			harness,
			TEST_CONFIGURATION,
			undefined,
			StatisticsFocusObservationMode.BOUNDARY,
		);
		expect(
			harness.storage.savedDocuments.at( -1 )?.scopes.scope_default?.activeAllowance,
		).toMatchObject( { confirmedFocusedUseMilliseconds: 30_000 } );
		expect( harness.sessionStorage.removedDocuments ).toHaveLength( 1 );

		for ( const incognito of [ true, undefined ] ) {
			harness.browser.focusedTabId = 9;
			harness.browser.tabs = [ {
				id: 9,
				...( incognito === undefined ? {} : { incognito } ),
				url: 'https://example.com/secret',
			} ];
			harness.clock.nowEpochMilliseconds += 30_000;
			await checkpointRuntime( harness );
			expect( harness.sessionStorage.savedDocuments.at( -1 )?.focusAnchor ).toBeUndefined();
		}
	} );

	it( 'finalizes every expired active allowance in one checkpoint', async () => {
		const configuration = createTwoScopeConfiguration();
		const startedAt = TEST_NOW_EPOCH_MILLISECONDS - 300_000;
		const first = createActiveStatisticsDocument(
			'scope_default',
			'revision_current',
			'allowance_current',
			startedAt,
			40_000,
			startedAt + 40_000,
		);
		const second = createActiveStatisticsDocument(
			'scope_other',
			'revision_other',
			'allowance_other',
			startedAt,
			50_000,
			startedAt + 50_000,
		);
		const document = StatisticsDocumentSchema.parse( {
			...first,
			scopes: { ...first.scopes, ...second.scopes },
		} );
		const harness = createRuntimeHarness(
			createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE ),
			document,
		);

		await reconcileRuntime( harness.runtime, configuration );
		await harness.runtime.drainProtectionFacts();
		harness.storage.savedDocuments.length = 0;

		await checkpointRuntime( harness, configuration );

		expect( harness.storage.savedDocuments ).toHaveLength( 1 );
		expect( harness.storage.savedDocuments[ 0 ]?.scopes ).toMatchObject( {
			scope_default: {
				latestBaseline: { focusedUseMilliseconds: 40_000 },
			},
			scope_other: {
				latestBaseline: { focusedUseMilliseconds: 50_000 },
			},
		} );
		expect( harness.storage.savedDocuments[ 0 ]?.scopes.scope_default?.activeAllowance )
			.toBeUndefined();
		expect( harness.storage.savedDocuments[ 0 ]?.scopes.scope_other?.activeAllowance )
			.toBeUndefined();
	} );
} );
