import { describe, expect, it } from 'vitest';
import {
	createAllowanceExpiry,
	createDeparture,
	createFocusChange,
	createVisitAttempt,
	TestInstant,
} from '../../types/__fixtures__/protection-event';
import {
	Mock_StoredProtectionParticipant_Navigation,
	Mock_StoredProtectionState_Durable,
	Mock_StoredProtectionState_Session,
} from '../../types/__fixtures__/stored-protection-state';
import { ProtectionDecisionType } from '../../types/protection-decision';
import { DepartureCause } from '../../types/protection-event';
import { ProtectionFactType } from '../../types/protection-fact';
import { ProtectionStateType } from '../../types/protection-state';
import {
	DurableStoredProtectionStateVersion,
	SessionStoredProtectionStateVersion,
	StoredDurableProtectionStateSchema,
	StoredProtectionScopeStateType,
	StoredProtectionStateSchema,
	StoredSessionProtectionStateSchema,
	type StoredProtectionState,
} from '../../types/stored-protection-state';
import {
	createProtectionStorageService,
	type LoadedProtectionState,
	type ProtectionStorageArea,
	type ProtectionStorageService,
} from '../protection-storage';
import {
	ProtectionCoordinatorDispatchStatus,
	ProtectionCoordinatorFailureReason,
	ProtectionCoordinatorInitializationStatus,
	createProtectionCoordinator,
	type ProtectionCoordinator,
} from './index';

/**
 * Promise whose completion is controlled by a test.
 */
class DeferredPromise {
	readonly promise: Promise<void>;

	private resolver: ( () => void ) | null = null;

	/**
	 * Creates an unresolved promise.
	 */
	constructor() {
		this.promise = new Promise( ( resolve ) => {
			this.resolver = resolve;
		} );
	}

	/**
	 * Resolves the controlled promise once.
	 */
	resolve(): void {
		this.resolver?.();
		this.resolver = null;
	}
}

/**
 * In-memory protection storage used to exercise coordinator behavior.
 */
class MemoryProtectionStorage implements ProtectionStorageService {
	readonly savedStates: StoredProtectionState[] = [];

	loadFailure: Error | null = null;

	saveFailure: Error | null = null;

	saveBarrier: Promise<void> | null = null;

	saveStarted: DeferredPromise | null = null;

	/**
	 * Creates in-memory storage with optional initial documents.
	 * @param loadedState - Initial durable and session values.
	 */
	constructor( private loadedState: LoadedProtectionState = {} ) {}

	/**
	 * Loads the current in-memory documents.
	 * @return Loaded documents or a configured rejection.
	 */
	load(): Promise<LoadedProtectionState> {
		return this.loadFailure === null
			? Promise.resolve( this.loadedState )
			: Promise.reject( this.loadFailure );
	}

	/**
	 * Stores validated documents after any configured barrier.
	 * @param input - Unknown complete stored-state input.
	 * @return Promise resolved after the state is stored.
	 */
	async save( input: unknown ): Promise<void> {
		this.saveStarted?.resolve();

		if ( this.saveBarrier !== null ) {
			await this.saveBarrier;
		}

		if ( this.saveFailure !== null ) {
			throw this.saveFailure;
		}

		const state = StoredProtectionStateSchema.parse( input );

		this.savedStates.push( state );
		this.loadedState = {
			durable: state.durable,
			session: state.session,
		};
	}
}

/**
 * Independent in-memory browser storage area used for restart recovery tests.
 */
class MemoryBrowserStorageArea implements ProtectionStorageArea {
	writeFailure: Error | null = null;

	/**
	 * Creates an in-memory browser storage area.
	 * @param values - Mutable values retained across storage-service instances.
	 */
	constructor( private readonly values: Record<string, unknown> = {} ) {}

	/**
	 * Reads one key from the in-memory area.
	 * @param key - Requested storage key.
	 * @return Matching record or an empty record.
	 */
	get( key: string ): Promise<Record<string, unknown>> {
		return Promise.resolve( Object.hasOwn( this.values, key ) ? { [ key ]: this.values[ key ] } : {} );
	}

	/**
	 * Writes values unless a failure is configured.
	 * @param values - Values to retain.
	 * @return Promise resolved after the values are retained.
	 */
	set( values: Record<string, unknown> ): Promise<void> {
		if ( this.writeFailure !== null ) {
			return Promise.reject( this.writeFailure );
		}

		Object.assign( this.values, values );

		return Promise.resolve();
	}
}

const DURABLE_ALLOWANCE = StoredDurableProtectionStateSchema.parse( {
	schemaVersion: DurableStoredProtectionStateVersion,
	scopes: {
		'scope-a': {
			ladder: {
				completedWaits: 2,
				greatestObservedLocalDate: '2026-08-31',
			},
			allowance: {
				allowanceId: 'allowance-a',
				startedAtEpochMilliseconds: TestInstant - 1_000,
				expiresAtEpochMilliseconds: TestInstant + 299_000,
			},
		},
	},
} );

const SESSION_WAITING = StoredSessionProtectionStateSchema.parse( {
	schemaVersion: SessionStoredProtectionStateVersion,
	sessionContinuityId: 'session-current',
	scopes: {
		'scope-a': {
			type: StoredProtectionScopeStateType.WAITING,
			waitId: 'wait-a',
			capturedWaitDurationMilliseconds: 10_000,
			confirmedFocusedDurationMilliseconds: 2_000,
			participants: [ Mock_StoredProtectionParticipant_Navigation ],
			ownerParticipantId: 'participant-a',
			ownerEpoch: 1,
			checkpointHighWaterMilliseconds: 2_000,
		},
	},
} );

/**
 * Supplies a deterministic new-session continuity identifier.
 * @return Stable continuity identifier.
 */
function createTestSessionContinuityId(): string {
	return 'session-new';
}

/**
 * Creates a deterministic sequence of valid storage snapshot identifiers.
 * @param initialSequence - Sequence value before the first identifier.
 * @return Snapshot identifier factory.
 */
function createSnapshotIdSequence( initialSequence = 0 ): () => string {
	let sequence = initialSequence;

	return () => {
		sequence += 1;

		return `00000000-0000-4000-8000-${ String( sequence ).padStart( 12, '0' ) }`;
	};
}

/**
 * Creates a coordinator with deterministic test dependencies.
 * @param storage - In-memory protection storage.
 * @param sessionContinuityId - New-session continuity identifier.
 * @return Protection coordinator under test.
 */
function createTestCoordinator(
	storage: ProtectionStorageService,
	sessionContinuityId = createTestSessionContinuityId(),
): ProtectionCoordinator {
	/**
	 * Supplies this coordinator's deterministic continuity identifier.
	 * @return Stable continuity identifier.
	 */
	function createSessionContinuityId(): string {
		return sessionContinuityId;
	}

	return createProtectionCoordinator( {
		storage,
		createSessionContinuityId,
	} );
}

/**
 * Returns the most recently persisted complete state.
 * @param storage - In-memory protection storage.
 * @return Latest persisted state.
 */
function getLatestSavedState( storage: MemoryProtectionStorage ): StoredProtectionState {
	const state = storage.savedStates.at( -1 );

	if ( state === undefined ) {
		throw new Error( 'Expected protection state to be persisted.' );
	}

	return state;
}

describe( 'protection coordinator initialization', () => {
	it( 'returns no state snapshot before successful initialization', async () => {
		const coordinator = createTestCoordinator( new MemoryProtectionStorage() );

		await expect( coordinator.getStates() ).resolves.toBeNull();
	} );

	it( 'creates and persists a continuity identifier for empty storage', async () => {
		const storage = new MemoryProtectionStorage();
		const coordinator = createTestCoordinator( storage );

		await expect( coordinator.initialize( {
			nowEpochMilliseconds: TestInstant,
			readyObservations: [],
		} ) ).resolves.toEqual( {
			status: ProtectionCoordinatorInitializationStatus.READY,
			decisions: [],
			facts: [],
			requirements: [],
		} );
		expect( getLatestSavedState( storage ).session.sessionContinuityId ).toBe( 'session-new' );
	} );

	it( 'reuses a valid continued-session continuity identifier', async () => {
		const storage = new MemoryProtectionStorage( {
			durable: Mock_StoredProtectionState_Durable,
			session: Mock_StoredProtectionState_Session,
		} );
		const coordinator = createTestCoordinator( storage );

		const result = await coordinator.initialize( {
			nowEpochMilliseconds: TestInstant,
			readyObservations: [],
		} );

		expect( result.status ).toBe( ProtectionCoordinatorInitializationStatus.READY );
		expect( getLatestSavedState( storage ).session.sessionContinuityId ).toBe( 'session-current' );
	} );

	it( 'restores a continued wait without focus ownership or lost progress', async () => {
		const storage = new MemoryProtectionStorage( {
			durable: Mock_StoredProtectionState_Durable,
			session: SESSION_WAITING,
		} );
		const coordinator = createTestCoordinator( storage );

		const result = await coordinator.initialize( {
			nowEpochMilliseconds: TestInstant,
			readyObservations: [],
		} );
		const storedWaiting = getLatestSavedState( storage ).session.scopes[ 'scope-a' ];

		expect( result.status ).toBe( ProtectionCoordinatorInitializationStatus.READY );
		expect( storedWaiting ).toMatchObject( {
			type: StoredProtectionScopeStateType.WAITING,
			confirmedFocusedDurationMilliseconds: 2_000,
			ownerParticipantId: null,
			ownerEpoch: 2,
			checkpointHighWaterMilliseconds: 0,
		} );
	} );

	it( 'starts a new session after corrupt session state without losing durable state', async () => {
		const storage = new MemoryProtectionStorage( {
			durable: Mock_StoredProtectionState_Durable,
			session: { schemaVersion: 1, scopes: 'invalid' },
		} );
		const coordinator = createTestCoordinator( storage );

		const result = await coordinator.initialize( {
			nowEpochMilliseconds: TestInstant,
			readyObservations: [],
		} );
		const savedState = getLatestSavedState( storage );

		expect( result.status ).toBe( ProtectionCoordinatorInitializationStatus.READY );
		expect( savedState.durable ).toEqual( Mock_StoredProtectionState_Durable );
		expect( savedState.session.sessionContinuityId ).toBe( 'session-new' );
	} );

	it( 'does not overwrite corrupt durable state', async () => {
		const storage = new MemoryProtectionStorage( {
			durable: {
				schemaVersion: DurableStoredProtectionStateVersion,
				scopes: {
					'scope-a': {
						ladder: {
							completedWaits: -1,
							greatestObservedLocalDate: '2026-08-31',
						},
					},
				},
			},
		} );
		const coordinator = createTestCoordinator( storage );

		await expect( coordinator.initialize( {
			nowEpochMilliseconds: TestInstant,
			readyObservations: [],
		} ) ).resolves.toEqual( {
			status: ProtectionCoordinatorInitializationStatus.FAILED,
			reason: ProtectionCoordinatorFailureReason.INVALID_DURABLE_STATE,
			decisions: [],
			facts: [],
			requirements: [],
		} );
		expect( storage.savedStates ).toEqual( [] );
	} );

	it( 'restores an unexpired durable allowance in a new session', async () => {
		const storage = new MemoryProtectionStorage( { durable: DURABLE_ALLOWANCE } );
		const coordinator = createTestCoordinator( storage );

		const result = await coordinator.initialize( {
			nowEpochMilliseconds: TestInstant,
			readyObservations: [],
		} );

		expect( result.status ).toBe( ProtectionCoordinatorInitializationStatus.READY );
		expect( getLatestSavedState( storage ).durable ).toEqual( DURABLE_ALLOWANCE );
	} );

	it( 'returns unresolved Ready reconciliation requirements', async () => {
		const storage = new MemoryProtectionStorage( {
			durable: DURABLE_ALLOWANCE,
			session: Mock_StoredProtectionState_Session,
		} );
		const coordinator = createTestCoordinator( storage );

		const result = await coordinator.initialize( {
			nowEpochMilliseconds: TestInstant,
			readyObservations: [],
		} );

		expect( result.status ).toBe( ProtectionCoordinatorInitializationStatus.RECONCILIATION_REQUIRED );
		expect( result.requirements ).toEqual( [ {
			scopeId: 'scope-a',
			allowanceId: 'allowance-a',
			participantId: 'participant-a',
			pageId: 'page-a',
			reason: 'observation-unavailable',
		} ] );
	} );

	it( 'reports a storage read failure without persisting state', async () => {
		const storage = new MemoryProtectionStorage();
		const readFailure = new Error( 'read failed' );

		storage.loadFailure = readFailure;

		const result = await createTestCoordinator( storage ).initialize( {
			nowEpochMilliseconds: TestInstant,
			readyObservations: [],
		} );

		expect( result ).toEqual( {
			status: ProtectionCoordinatorInitializationStatus.FAILED,
			reason: ProtectionCoordinatorFailureReason.STORAGE_READ_FAILED,
			decisions: [],
			facts: [],
			requirements: [],
		} );
		expect( storage.savedStates ).toEqual( [] );
	} );

	it( 'reports a storage write failure without becoming initialized', async () => {
		const storage = new MemoryProtectionStorage();

		storage.saveFailure = new Error( 'write failed' );

		const coordinator = createTestCoordinator( storage );
		const initialization = await coordinator.initialize( {
			nowEpochMilliseconds: TestInstant,
			readyObservations: [],
		} );
		const dispatch = await coordinator.dispatch( () => createVisitAttempt() );

		expect( initialization ).toEqual( {
			status: ProtectionCoordinatorInitializationStatus.FAILED,
			reason: ProtectionCoordinatorFailureReason.STORAGE_WRITE_FAILED,
			decisions: [],
			facts: [],
			requirements: [],
		} );
		expect( dispatch ).toEqual( {
			status: ProtectionCoordinatorDispatchStatus.REJECTED,
			reason: ProtectionCoordinatorFailureReason.NOT_INITIALIZED,
			decisions: [],
			facts: [],
		} );
	} );

	it( 'does not expose restored state before persistence completes', async () => {
		const storage = new MemoryProtectionStorage();
		const saveStarted = new DeferredPromise();
		const saveBarrier = new DeferredPromise();

		storage.saveStarted = saveStarted;
		storage.saveBarrier = saveBarrier.promise;

		const initialization = createTestCoordinator( storage ).initialize( {
			nowEpochMilliseconds: TestInstant,
			readyObservations: [],
		} );
		let settled = false;

		void initialization.then( () => {
			settled = true;
		} );
		await saveStarted.promise;

		expect( settled ).toBe( false );
		expect( storage.savedStates ).toEqual( [] );

		saveBarrier.resolve();

		await expect( initialization ).resolves.toMatchObject( {
			status: ProtectionCoordinatorInitializationStatus.READY,
		} );
	} );

	it( 'serializes dispatch behind initialization persistence', async () => {
		const storage = new MemoryProtectionStorage();
		const saveStarted = new DeferredPromise();
		const saveBarrier = new DeferredPromise();
		const coordinator = createTestCoordinator( storage );
		let eventPrepared = false;

		storage.saveStarted = saveStarted;
		storage.saveBarrier = saveBarrier.promise;

		const initialization = coordinator.initialize( {
			nowEpochMilliseconds: TestInstant,
			readyObservations: [],
		} );
		const dispatch = coordinator.dispatch( () => {
			eventPrepared = true;
			return createVisitAttempt();
		} );

		await saveStarted.promise;

		expect( eventPrepared ).toBe( false );

		saveBarrier.resolve();

		await expect( initialization ).resolves.toMatchObject( {
			status: ProtectionCoordinatorInitializationStatus.READY,
		} );
		await expect( dispatch ).resolves.toMatchObject( {
			status: ProtectionCoordinatorDispatchStatus.APPLIED,
		} );
	} );
} );

describe( 'protection coordinator dispatch', () => {
	it( 'returns a detached snapshot of the latest persisted runtime states', async () => {
		const storage = new MemoryProtectionStorage();
		const coordinator = createTestCoordinator( storage );

		await coordinator.initialize( { nowEpochMilliseconds: TestInstant, readyObservations: [] } );
		await coordinator.dispatch( () => createVisitAttempt() );

		const snapshot = await coordinator.getStates();

		expect( snapshot ).toMatchObject( {
			'scope-default': {
				type: 'waiting',
				waitId: 'wait-a',
				participants: [ { participantId: 'participant-a', pageId: 'page-a' } ],
			},
		} );

		if ( snapshot === null ) {
			throw new Error( 'Expected an initialized coordinator snapshot.' );
		}

		const secondSnapshot = await coordinator.getStates();

		expect( secondSnapshot ).not.toBe( snapshot );
		expect( secondSnapshot?.[ 'scope-default' ] ).not.toBe( snapshot[ 'scope-default' ] );
	} );

	it( 'rejects dispatch before successful initialization', async () => {
		const result = await createTestCoordinator( new MemoryProtectionStorage() ).dispatch(
			() => createVisitAttempt(),
		);

		expect( result ).toEqual( {
			status: ProtectionCoordinatorDispatchStatus.REJECTED,
			reason: ProtectionCoordinatorFailureReason.NOT_INITIALIZED,
			decisions: [],
			facts: [],
		} );
	} );

	it( 'rejects invalid events with a typed empty-effects result', async () => {
		const storage = new MemoryProtectionStorage();
		const coordinator = createTestCoordinator( storage );

		await coordinator.initialize( { nowEpochMilliseconds: TestInstant, readyObservations: [] } );

		await expect( coordinator.dispatch( () => ( { type: 'invalid' } ) ) ).resolves.toEqual( {
			status: ProtectionCoordinatorDispatchStatus.REJECTED,
			reason: ProtectionCoordinatorFailureReason.INVALID_EVENT,
			decisions: [],
			facts: [],
		} );
	} );

	it( 'continues serializing after event preparation rejects', async () => {
		const storage = new MemoryProtectionStorage();
		const coordinator = createTestCoordinator( storage );
		const preparationFailure = new Error( 'preparation failed' );

		await coordinator.initialize( { nowEpochMilliseconds: TestInstant, readyObservations: [] } );
		await expect( coordinator.dispatch( () => Promise.reject( preparationFailure ) ) ).rejects.toBe(
			preparationFailure,
		);
		await expect( coordinator.dispatch( () => createVisitAttempt() ) ).resolves.toMatchObject( {
			status: ProtectionCoordinatorDispatchStatus.APPLIED,
		} );
	} );

	it( 'creates the minimum Idle scope for a first visit attempt', async () => {
		const storage = new MemoryProtectionStorage();
		const coordinator = createTestCoordinator( storage );

		await coordinator.initialize( { nowEpochMilliseconds: TestInstant, readyObservations: [] } );

		const result = await coordinator.dispatch( () => createVisitAttempt() );
		const storedWaiting = getLatestSavedState( storage ).session.scopes[ 'scope-default' ];

		expect( result.status ).toBe( ProtectionCoordinatorDispatchStatus.APPLIED );
		expect( result.decisions ).toMatchObject( [ { type: ProtectionDecisionType.PRESENT_WAITING } ] );
		expect( storedWaiting ).toMatchObject( {
			type: StoredProtectionScopeStateType.WAITING,
			waitId: 'wait-a',
			participants: [ { participantId: 'participant-a', pageId: 'page-a' } ],
		} );
		expect( getLatestSavedState( storage ).durable.scopes[ 'scope-default' ]?.ladder ).toEqual( {
			completedWaits: 0,
			greatestObservedLocalDate: '2026-08-31',
		} );
	} );

	it.each( [ 'toString', 'constructor', 'hasOwnProperty', '__proto__' ] )(
		'creates a first-visit scope for the prototype key %s',
		async ( scopeId ) => {
			const storage = new MemoryProtectionStorage();
			const coordinator = createTestCoordinator( storage );

			await coordinator.initialize( { nowEpochMilliseconds: TestInstant, readyObservations: [] } );

			const result = await coordinator.dispatch( () => createVisitAttempt(
				'participant-a',
				'page-a',
				true,
				{ scopeId },
			) );

			expect( result.status ).toBe( ProtectionCoordinatorDispatchStatus.APPLIED );
			expect( getLatestSavedState( storage ).session.scopes[ scopeId ] ).toMatchObject( {
				type: StoredProtectionScopeStateType.WAITING,
			} );
		},
	);

	it( 'rejects a non-visit event for an unknown scope without writing', async () => {
		const storage = new MemoryProtectionStorage();
		const coordinator = createTestCoordinator( storage );

		await coordinator.initialize( { nowEpochMilliseconds: TestInstant, readyObservations: [] } );

		const savedStateCount = storage.savedStates.length;
		const result = await coordinator.dispatch( () => createFocusChange(
			'participant-a',
			false,
			1,
			{ scopeId: 'scope-unknown' },
		) );

		expect( result ).toEqual( {
			status: ProtectionCoordinatorDispatchStatus.REJECTED,
			reason: ProtectionCoordinatorFailureReason.UNKNOWN_SCOPE,
			decisions: [],
			facts: [],
		} );
		expect( storage.savedStates ).toHaveLength( savedStateCount );
	} );

	it.each( [ 'toString', 'constructor', 'hasOwnProperty', '__proto__' ] )(
		'rejects a non-visit event for the unknown prototype key %s',
		async ( scopeId ) => {
			const storage = new MemoryProtectionStorage();
			const coordinator = createTestCoordinator( storage );

			await coordinator.initialize( { nowEpochMilliseconds: TestInstant, readyObservations: [] } );

			const savedStateCount = storage.savedStates.length;
			const result = await coordinator.dispatch( () => createFocusChange(
				'participant-a',
				false,
				1,
				{ scopeId },
			) );

			expect( result ).toEqual( {
				status: ProtectionCoordinatorDispatchStatus.REJECTED,
				reason: ProtectionCoordinatorFailureReason.UNKNOWN_SCOPE,
				decisions: [],
				facts: [],
			} );
			expect( storage.savedStates ).toHaveLength( savedStateCount );
		},
	);

	it( 'does not expose transition effects before persistence completes', async () => {
		const storage = new MemoryProtectionStorage();
		const coordinator = createTestCoordinator( storage );

		await coordinator.initialize( { nowEpochMilliseconds: TestInstant, readyObservations: [] } );

		const saveStarted = new DeferredPromise();
		const saveBarrier = new DeferredPromise();

		storage.saveStarted = saveStarted;
		storage.saveBarrier = saveBarrier.promise;

		const dispatch = coordinator.dispatch( () => createVisitAttempt() );
		let settled = false;

		void dispatch.then( () => {
			settled = true;
		} );
		await saveStarted.promise;

		expect( settled ).toBe( false );

		saveBarrier.resolve();

		await expect( dispatch ).resolves.toMatchObject( {
			status: ProtectionCoordinatorDispatchStatus.APPLIED,
		} );
	} );

	it( 'returns no unpersisted effects and retains the last confirmed state after write failure', async () => {
		const storage = new MemoryProtectionStorage();
		const coordinator = createTestCoordinator( storage );

		await coordinator.initialize( { nowEpochMilliseconds: TestInstant, readyObservations: [] } );

		storage.saveFailure = new Error( 'write failed' );

		const failed = await coordinator.dispatch( () => createVisitAttempt() );

		expect( failed ).toEqual( {
			status: ProtectionCoordinatorDispatchStatus.REJECTED,
			reason: ProtectionCoordinatorFailureReason.STORAGE_WRITE_FAILED,
			decisions: [],
			facts: [],
		} );

		storage.saveFailure = null;

		const applied = await coordinator.dispatch( () => createVisitAttempt( 'participant-b', 'page-b' ) );
		const storedWaiting = getLatestSavedState( storage ).session.scopes[ 'scope-default' ];

		expect( applied.status ).toBe( ProtectionCoordinatorDispatchStatus.APPLIED );
		expect( storedWaiting ).toMatchObject( {
			participants: [ { participantId: 'participant-b', pageId: 'page-b' } ],
		} );
	} );

	it( 'does not recover a session-only partial write after a worker restart', async () => {
		const durableArea = new MemoryBrowserStorageArea();
		const sessionArea = new MemoryBrowserStorageArea();
		const initialStorage = createProtectionStorageService( {
			durableArea,
			sessionArea,
			createSnapshotId: createSnapshotIdSequence(),
		} );
		const initialCoordinator = createTestCoordinator( initialStorage, 'session-initial' );

		await initialCoordinator.initialize( {
			nowEpochMilliseconds: TestInstant,
			readyObservations: [],
		} );

		durableArea.writeFailure = new Error( 'durable write failed' );

		await expect( initialCoordinator.dispatch( () => createVisitAttempt() ) ).resolves.toEqual( {
			status: ProtectionCoordinatorDispatchStatus.REJECTED,
			reason: ProtectionCoordinatorFailureReason.STORAGE_WRITE_FAILED,
			decisions: [],
			facts: [],
		} );

		durableArea.writeFailure = null;

		const recoveredStorage = createProtectionStorageService( {
			durableArea,
			sessionArea,
			createSnapshotId: createSnapshotIdSequence( 100 ),
		} );
		const recoveredCoordinator = createTestCoordinator( recoveredStorage, 'session-recovered' );

		await expect( recoveredCoordinator.initialize( {
			nowEpochMilliseconds: TestInstant,
			readyObservations: [],
		} ) ).resolves.toMatchObject( {
			status: ProtectionCoordinatorInitializationStatus.READY,
		} );

		const recoveredState = StoredProtectionStateSchema.parse( await recoveredStorage.load() );

		expect( recoveredState.session.sessionContinuityId ).toBe( 'session-recovered' );
		expect( recoveredState.session.scopes ).toEqual( {} );
	} );

	it( 'serializes concurrent same-scope visits without losing a participant', async () => {
		const storage = new MemoryProtectionStorage();
		const coordinator = createTestCoordinator( storage );

		await coordinator.initialize( { nowEpochMilliseconds: TestInstant, readyObservations: [] } );

		const saveStarted = new DeferredPromise();
		const saveBarrier = new DeferredPromise();

		storage.saveStarted = saveStarted;
		storage.saveBarrier = saveBarrier.promise;

		const first = coordinator.dispatch( () => createVisitAttempt() );
		const second = coordinator.dispatch( () => createVisitAttempt( 'participant-b', 'page-b' ) );

		await saveStarted.promise;
		saveBarrier.resolve();

		await expect( Promise.all( [ first, second ] ) ).resolves.toMatchObject( [
			{ status: ProtectionCoordinatorDispatchStatus.APPLIED },
			{ status: ProtectionCoordinatorDispatchStatus.APPLIED },
		] );

		const storedWaiting = getLatestSavedState( storage ).session.scopes[ 'scope-default' ];

		expect( storedWaiting ).toMatchObject( {
			participants: [
				{ participantId: 'participant-a', pageId: 'page-a' },
				{ participantId: 'participant-b', pageId: 'page-b' },
			],
		} );
	} );

	it( 'preserves domain idempotence when a departure is replayed', async () => {
		const storage = new MemoryProtectionStorage();
		const coordinator = createTestCoordinator( storage );

		await coordinator.initialize( { nowEpochMilliseconds: TestInstant, readyObservations: [] } );
		await coordinator.dispatch( () => createVisitAttempt() );

		const departure = createDeparture( DepartureCause.ACTIVE_SESSION_TAB_CLOSE );
		const first = await coordinator.dispatch( () => departure );
		const replay = await coordinator.dispatch( () => departure );

		expect( first.facts ).toMatchObject( [ { type: ProtectionFactType.RECONSIDERED_VISIT } ] );
		expect( replay.facts ).toEqual( [] );
	} );

	it( 'holds allowance-expiry candidate collection inside the shared queue', async () => {
		const storage = new MemoryProtectionStorage( { durable: DURABLE_ALLOWANCE } );
		const coordinator = createTestCoordinator( storage );
		const preparationStarted = new DeferredPromise();
		const preparationBarrier = new DeferredPromise();
		const preparationOrder: string[] = [];
		let preparedStateType = '';

		await coordinator.initialize( { nowEpochMilliseconds: TestInstant, readyObservations: [] } );

		const expiry = coordinator.dispatch( async ( statesByScope ) => {
			preparationOrder.push( 'expiry-started' );
			preparedStateType = statesByScope[ 'scope-a' ]?.type ?? '';
			preparationStarted.resolve();
			await preparationBarrier.promise;
			preparationOrder.push( 'expiry-completed' );

			return createAllowanceExpiry( [], undefined, { scopeId: 'scope-a' } );
		} );

		await preparationStarted.promise;

		const visit = coordinator.dispatch( () => {
			preparationOrder.push( 'visit-prepared' );

			return createVisitAttempt(
				'participant-b',
				'page-b',
				true,
				{ scopeId: 'scope-a', waitId: 'wait-after-expiry' },
			);
		} );

		expect( preparationOrder ).toEqual( [ 'expiry-started' ] );
		expect( preparedStateType ).toBe( ProtectionStateType.ALLOWANCE );

		preparationBarrier.resolve();

		await expect( Promise.all( [ expiry, visit ] ) ).resolves.toMatchObject( [
			{ status: ProtectionCoordinatorDispatchStatus.APPLIED },
			{ status: ProtectionCoordinatorDispatchStatus.APPLIED },
		] );
		expect( preparationOrder ).toEqual( [
			'expiry-started',
			'expiry-completed',
			'visit-prepared',
		] );
	} );
} );
