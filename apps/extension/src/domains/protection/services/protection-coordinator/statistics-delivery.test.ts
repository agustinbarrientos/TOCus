import { describe, expect, it } from 'vitest';
import {
	createDeparture,
	createProgressCheckpoint,
	createVisitAttempt,
	TestInstant,
} from '../../types/__fixtures__/protection-event';
import { DepartureCause } from '../../types/protection-event';
import { ProtectionFactType } from '../../types/protection-fact';
import {
	StoredProtectionStatisticsDeliveryStatus,
} from '../../types/stored-protection-statistics-delivery';
import {
	DurableStoredProtectionStateVersion,
	StoredDurableProtectionStateSchema,
	StoredProtectionStateSchema,
	type StoredDurableProtectionState,
	type StoredProtectionState,
} from '../../types/stored-protection-state';
import {
	type LoadedProtectionState,
	type ProtectionStorageService,
} from '../protection-storage';
import {
	ProtectionCoordinatorDispatchStatus,
	ProtectionCoordinatorInitializationStatus,
	createProtectionCoordinator,
	type ProtectionCoordinator,
} from './index';

/**
 * In-memory persistence focused on coordinator statistics-delivery behavior.
 * @since 0.1.0 Initial implementation.
 */
class StatisticsDeliveryMemoryStorage implements ProtectionStorageService {
	/**
	 * Complete state snapshots written by the coordinator.
	 * @since 0.1.0 Initial implementation.
	 */
	readonly savedStates: StoredProtectionState[] = [];

	/**
	 * Durable acknowledgements written by the coordinator.
	 * @since 0.1.0 Initial implementation.
	 */
	readonly savedDurableAcknowledgements: StoredDurableProtectionState[] = [];

	saveFailure: Error | null = null;

	saveDurableFailure: Error | null = null;

	/**
	 * Creates in-memory storage with optional initial documents.
	 * @param loadedState - Initial durable and session values.
	 * @since 0.1.0 Initial implementation.
	 */
	constructor( private loadedState: LoadedProtectionState = {} ) {}

	/**
	 * Replaces the documents returned by the next coordinator initialization.
	 * @param loadedState - Durable and session values for the next load.
	 * @since 0.1.0 Initial implementation.
	 */
	setLoadedState( loadedState: LoadedProtectionState ): void {
		this.loadedState = loadedState;
	}

	/**
	 * Loads the current in-memory documents.
	 * @return Current loaded documents.
	 * @since 0.1.0 Initial implementation.
	 */
	load(): Promise<LoadedProtectionState> {
		return Promise.resolve( this.loadedState );
	}

	/**
	 * Stores a validated complete snapshot unless configured to reject.
	 * @param input - Unknown complete stored protection state.
	 * @return Promise resolved after persistence.
	 * @since 0.1.0 Initial implementation.
	 */
	save( input: unknown ): Promise<void> {
		if ( this.saveFailure !== null ) {
			return Promise.reject( this.saveFailure );
		}

		const state = StoredProtectionStateSchema.parse( input );

		this.savedStates.push( state );
		this.loadedState = {
			durable: state.durable,
			session: state.session,
		};

		return Promise.resolve();
	}

	/**
	 * Stores a validated durable acknowledgement unless configured to reject.
	 * @param input - Unknown current durable protection state.
	 * @return Promise resolved after durable persistence.
	 * @since 0.1.0 Initial implementation.
	 */
	saveDurableStatisticsDelivery( input: unknown ): Promise<void> {
		if ( this.saveDurableFailure !== null ) {
			return Promise.reject( this.saveDurableFailure );
		}

		const durable = StoredDurableProtectionStateSchema.parse( input );

		this.savedDurableAcknowledgements.push( durable );
		this.loadedState = { ...this.loadedState, durable };

		return Promise.resolve();
	}
}

/**
 * Supplies the deterministic coordinator session identifier.
 * @return Stable test session identifier.
 * @since 0.1.0 Initial implementation.
 */
function createTestSessionContinuityId(): string {
	return 'session_statistics_delivery';
}

/**
 * Creates a coordinator with one fact-batch identifier dependency.
 * @param storage - Focused in-memory protection storage.
 * @param createProtectionFactBatchId - Batch identifier factory.
 * @return Coordinator under test.
 * @since 0.1.0 Initial implementation.
 */
function createStatisticsDeliveryCoordinator(
	storage: ProtectionStorageService,
	createProtectionFactBatchId: () => unknown,
): ProtectionCoordinator {
	return createProtectionCoordinator( {
		storage,
		createSessionContinuityId: createTestSessionContinuityId,
		createProtectionFactBatchId,
	} );
}

/**
 * Creates one valid retained protection-fact batch.
 * @param index - Unique batch and fact identifier suffix.
 * @param scopeId - Exact scope associated with the batch.
 * @return Valid retained protection-fact batch.
 * @since 0.1.0 Initial implementation.
 */
function createStoredFactBatch( index: number, scopeId = 'scope-default' ) {
	return {
		batchId: `batch_${ String( index ) }`,
		scopeId,
		measurementRevision: `revision_${ String( index ) }`,
		observedAtEpochMilliseconds: TestInstant,
		facts: [ {
			type: ProtectionFactType.RECONSIDERED_VISIT,
			factId: `fact_${ String( index ) }`,
			scopeId,
			waitId: 'wait-a',
			participantId: 'participant-a',
			departureCause: DepartureCause.ACTIVE_SESSION_TAB_CLOSE,
			observedAtEpochMilliseconds: TestInstant,
		} ],
	};
}

/**
 * Creates current durable state carrying one explicit statistics-delivery value.
 * @param statisticsDelivery - Unknown delivery value retained in the durable document.
 * @param scopes - Durable protection scopes retained beside statistics delivery.
 * @return Valid current durable protection state.
 * @since 0.1.0 Initial implementation.
 */
function createDurableStateWithStatisticsDelivery(
	statisticsDelivery: unknown,
	scopes: StoredDurableProtectionState[ 'scopes' ] = {},
): StoredDurableProtectionState {
	return StoredDurableProtectionStateSchema.parse( {
		schemaVersion: DurableStoredProtectionStateVersion,
		statisticsDelivery,
		scopes,
	} );
}

/**
 * Initializes a coordinator with the standard observation fixture.
 * @param coordinator - Coordinator to initialize.
 * @return Promise resolved after initialization persistence.
 * @since 0.1.0 Initial implementation.
 */
async function initializeCoordinator( coordinator: ProtectionCoordinator ): Promise<void> {
	await coordinator.initialize( {
		nowEpochMilliseconds: TestInstant,
		readyObservations: [],
	} );
}

/**
 * Creates a Waiting state and emits one reconsidered-visit fact.
 * @param coordinator - Initialized coordinator under test.
 * @param measurementRevision - Optional revision supplied to the fact transition.
 * @return Applied departure dispatch result.
 * @since 0.1.0 Initial implementation.
 */
async function dispatchReconsideredVisit(
	coordinator: ProtectionCoordinator,
	measurementRevision?: unknown,
) {
	await coordinator.dispatch( () => createVisitAttempt() );

	return coordinator.dispatch(
		() => createDeparture( DepartureCause.ACTIVE_SESSION_TAB_CLOSE ),
		measurementRevision,
	);
}

describe( 'protection coordinator statistics delivery', () => {
	it( 'restores valid protection scopes while isolating malformed statistics delivery', async () => {
		const scopes = StoredDurableProtectionStateSchema.shape.scopes.parse( {
			'scope-default': {
				ladder: {
					completedWaits: 2,
					greatestObservedLocalDate: '2026-08-31',
				},
			},
		} );
		const storage = new StatisticsDeliveryMemoryStorage( {
			durable: {
				schemaVersion: DurableStoredProtectionStateVersion,
				scopes,
				statisticsDelivery: {
					status: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
					outbox: 'malformed',
				},
			},
		} );
		const coordinator = createStatisticsDeliveryCoordinator( storage, () => 'batch_new' );

		await expect( coordinator.initialize( {
			nowEpochMilliseconds: TestInstant,
			readyObservations: [],
		} ) ).resolves.toMatchObject( {
			status: ProtectionCoordinatorInitializationStatus.READY,
		} );
		expect( storage.savedStates.at( -1 )?.durable ).toEqual( {
			schemaVersion: DurableStoredProtectionStateVersion,
			scopes,
			statisticsDelivery: {
				status: StoredProtectionStatisticsDeliveryStatus.INCOMPLETE,
				outbox: [],
			},
		} );
		await expect( coordinator.getStatisticsDelivery() ).resolves.toEqual( {
			status: StoredProtectionStatisticsDeliveryStatus.INCOMPLETE,
			outbox: [],
		} );
	} );

	it( 'batches each fact transition before its full save and leaves dispatch facts unchanged', async () => {
		const storage = new StatisticsDeliveryMemoryStorage();
		let batchSequence = 0;
		const coordinator = createStatisticsDeliveryCoordinator( storage, () => {
			batchSequence += 1;

			return `batch_${ String( batchSequence ) }`;
		} );

		await initializeCoordinator( coordinator );
		const departureResult = await dispatchReconsideredVisit(
			coordinator,
			'revision_departure',
		);
		await coordinator.dispatch( () => createVisitAttempt(
			'participant-b',
			'page-b',
			true,
			{ waitId: 'wait-b' },
		) );
		const completionResult = await coordinator.dispatch(
			() => createProgressCheckpoint( 10_000, {
				waitId: 'wait-b',
				ownerParticipantId: 'participant-b',
			} ),
			'revision_completion',
		);
		const delivery = await coordinator.getStatisticsDelivery();

		expect( departureResult.facts ).toMatchObject( [ {
			type: ProtectionFactType.RECONSIDERED_VISIT,
		} ] );
		expect( completionResult.facts.map( ( fact ) => fact.type ) ).toEqual( [
			ProtectionFactType.PAUSE_TIME,
			ProtectionFactType.COMPLETED_WAIT,
			ProtectionFactType.ALLOWANCE_GRANTED,
		] );
		expect( delivery ).toEqual( {
			status: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
			outbox: [
				{
					batchId: 'batch_1',
					scopeId: 'scope-default',
					measurementRevision: 'revision_departure',
					observedAtEpochMilliseconds: TestInstant,
					facts: departureResult.facts,
				},
				{
					batchId: 'batch_2',
					scopeId: 'scope-default',
					measurementRevision: 'revision_completion',
					observedAtEpochMilliseconds: TestInstant,
					facts: completionResult.facts,
				},
			],
		} );
		expect( storage.savedStates.at( -1 )?.durable.statisticsDelivery ).toEqual( delivery );

		const secondDelivery = await coordinator.getStatisticsDelivery();

		expect( secondDelivery ).not.toBe( delivery );
		expect( secondDelivery?.outbox ).not.toBe( delivery?.outbox );
		expect( secondDelivery?.outbox[ 0 ] ).not.toBe( delivery?.outbox[ 0 ] );
	} );

	it( 'does not expose an appended batch when the full save rejects', async () => {
		const storage = new StatisticsDeliveryMemoryStorage();
		const coordinator = createStatisticsDeliveryCoordinator( storage, () => 'batch_new' );

		await initializeCoordinator( coordinator );
		await coordinator.dispatch( () => createVisitAttempt() );
		storage.saveFailure = new Error( 'full write failed' );

		const result = await coordinator.dispatch(
			() => createDeparture( DepartureCause.ACTIVE_SESSION_TAB_CLOSE ),
			'revision_current',
		);

		expect( result.status ).toBe( ProtectionCoordinatorDispatchStatus.REJECTED );
		expect( await coordinator.getStatisticsDelivery() ).toEqual( {
			status: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
			outbox: [],
		} );
	} );

	it.each( [
		StoredProtectionStatisticsDeliveryStatus.COMPLETE,
		StoredProtectionStatisticsDeliveryStatus.INCOMPLETE,
	] )( 'acknowledges only the exact head while preserving %s status', async ( status ) => {
		const firstBatch = createStoredFactBatch( 1 );
		const secondBatch = createStoredFactBatch( 2 );
		const scopes = StoredDurableProtectionStateSchema.shape.scopes.parse( {
			'scope-default': {
				ladder: {
					completedWaits: 2,
					greatestObservedLocalDate: '2026-08-31',
				},
				allowance: {
					allowanceId: 'allowance-retained',
					startedAtEpochMilliseconds: TestInstant,
					expiresAtEpochMilliseconds: TestInstant + 300_000,
				},
			},
		} );
		const storage = new StatisticsDeliveryMemoryStorage( {
			durable: createDurableStateWithStatisticsDelivery( {
				status,
				outbox: [ firstBatch, secondBatch ],
			}, scopes ),
		} );
		const coordinator = createStatisticsDeliveryCoordinator( storage, () => 'batch_new' );

		await initializeCoordinator( coordinator );
		await expect( coordinator.acknowledgeStatisticsDeliveryBatch( 'bad id' ) ).resolves.toBe( false );
		await expect( coordinator.acknowledgeStatisticsDeliveryBatch( secondBatch.batchId ) )
			.resolves.toBe( false );
		expect( storage.savedDurableAcknowledgements ).toEqual( [] );

		await expect( coordinator.acknowledgeStatisticsDeliveryBatch( firstBatch.batchId ) )
			.resolves.toBe( true );
		expect( storage.savedStates ).toHaveLength( 1 );
		expect( storage.savedDurableAcknowledgements[ 0 ]?.statisticsDelivery ).toEqual( {
			status,
			outbox: [ secondBatch ],
		} );
		expect( storage.savedDurableAcknowledgements[ 0 ]?.scopes ).toEqual( scopes );
		expect( await coordinator.getStatisticsDelivery() ).toEqual( {
			status,
			outbox: [ secondBatch ],
		} );
	} );

	it( 'retains the head when acknowledgement storage rejects and continues the queue', async () => {
		const firstBatch = createStoredFactBatch( 1 );
		const storage = new StatisticsDeliveryMemoryStorage( {
			durable: createDurableStateWithStatisticsDelivery( {
				status: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
				outbox: [ firstBatch ],
			} ),
		} );
		const coordinator = createStatisticsDeliveryCoordinator( storage, () => 'batch_new' );
		const writeFailure = new Error( 'durable acknowledgement failed' );

		await initializeCoordinator( coordinator );
		storage.saveDurableFailure = writeFailure;

		await expect( coordinator.acknowledgeStatisticsDeliveryBatch( firstBatch.batchId ) )
			.rejects.toBe( writeFailure );
		expect( await coordinator.getStatisticsDelivery() ).toEqual( {
			status: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
			outbox: [ firstBatch ],
		} );

		storage.saveDurableFailure = null;

		await expect( coordinator.acknowledgeStatisticsDeliveryBatch( firstBatch.batchId ) )
			.resolves.toBe( true );
		expect( await coordinator.getStatisticsDelivery() ).toEqual( {
			status: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
			outbox: [],
		} );
	} );

	it( 'marks a durable statistics delivery reset incomplete before completing it', async () => {
		const firstBatch = createStoredFactBatch( 1 );
		const scopes = StoredDurableProtectionStateSchema.shape.scopes.parse( {
			'scope-default': {
				ladder: {
					completedWaits: 2,
					greatestObservedLocalDate: '2026-08-31',
				},
			},
		} );
		const storage = new StatisticsDeliveryMemoryStorage( {
			durable: createDurableStateWithStatisticsDelivery( {
				status: StoredProtectionStatisticsDeliveryStatus.INCOMPLETE,
				outbox: [ firstBatch ],
			}, scopes ),
		} );
		const coordinator = createStatisticsDeliveryCoordinator( storage, () => 'batch_new' );

		await initializeCoordinator( coordinator );

		await expect( coordinator.resetStatisticsDelivery() ).resolves.toBe( true );
		expect( storage.savedDurableAcknowledgements.at( -1 ) ).toEqual( {
			schemaVersion: DurableStoredProtectionStateVersion,
			scopes,
			statisticsDelivery: {
				status: StoredProtectionStatisticsDeliveryStatus.INCOMPLETE,
				outbox: [],
			},
		} );
		expect( await coordinator.getStatisticsDelivery() ).toEqual( {
			status: StoredProtectionStatisticsDeliveryStatus.INCOMPLETE,
			outbox: [],
		} );

		await expect( coordinator.completeStatisticsDeliveryReset() ).resolves.toBe( true );
		expect( storage.savedDurableAcknowledgements.at( -1 ) ).toEqual( {
			schemaVersion: DurableStoredProtectionStateVersion,
			scopes,
			statisticsDelivery: {
				status: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
				outbox: [],
			},
		} );
		expect( await coordinator.getStatisticsDelivery() ).toEqual( {
			status: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
			outbox: [],
		} );
		await expect( coordinator.acknowledgeStatisticsDeliveryBatch( firstBatch.batchId ) )
			.resolves.toBe( false );
	} );

	it( 'does not expose a statistics delivery reset when durable persistence rejects', async () => {
		const firstBatch = createStoredFactBatch( 1 );
		const storage = new StatisticsDeliveryMemoryStorage( {
			durable: createDurableStateWithStatisticsDelivery( {
				status: StoredProtectionStatisticsDeliveryStatus.INCOMPLETE,
				outbox: [ firstBatch ],
			} ),
		} );
		const coordinator = createStatisticsDeliveryCoordinator( storage, () => 'batch_new' );
		const writeFailure = new Error( 'durable reset failed' );

		await initializeCoordinator( coordinator );
		storage.saveDurableFailure = writeFailure;

		await expect( coordinator.resetStatisticsDelivery() ).rejects.toBe( writeFailure );
		expect( await coordinator.getStatisticsDelivery() ).toEqual( {
			status: StoredProtectionStatisticsDeliveryStatus.INCOMPLETE,
			outbox: [ firstBatch ],
		} );
	} );

	it( 'rejects a statistics delivery reset before successful initialization', async () => {
		const storage = new StatisticsDeliveryMemoryStorage();
		const coordinator = createStatisticsDeliveryCoordinator( storage, () => 'batch_new' );

		await expect( coordinator.resetStatisticsDelivery() ).resolves.toBe( false );
		await expect( coordinator.completeStatisticsDeliveryReset() ).resolves.toBe( false );
		expect( storage.savedDurableAcknowledgements ).toEqual( [] );
	} );

	it( 'invalidates prior delivery authority before a failed reinitialization', async () => {
		const firstBatch = createStoredFactBatch( 1 );
		const storage = new StatisticsDeliveryMemoryStorage( {
			durable: createDurableStateWithStatisticsDelivery( {
				status: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
				outbox: [ firstBatch ],
			} ),
		} );
		const coordinator = createStatisticsDeliveryCoordinator( storage, () => 'batch_new' );

		await initializeCoordinator( coordinator );
		storage.setLoadedState( {
			durable: {
				schemaVersion: 999,
				scopes: {},
			},
		} );

		await expect( coordinator.initialize( {
			nowEpochMilliseconds: TestInstant,
			readyObservations: [],
		} ) ).resolves.toMatchObject( {
			status: ProtectionCoordinatorInitializationStatus.FAILED,
		} );
		expect( await coordinator.getStatisticsDelivery() ).toBeNull();
		await expect( coordinator.acknowledgeStatisticsDeliveryBatch( firstBatch.batchId ) )
			.resolves.toBe( false );
		expect( storage.savedDurableAcknowledgements ).toEqual( [] );
	} );

} );
