import { describe, expect, it } from 'vitest';
import {
	Mock_StoredProtectionState_Durable,
	Mock_StoredProtectionState_Session,
} from '../../types/__fixtures__/stored-protection-state';
import { StoredProtectionStateSchema } from '../../types/stored-protection-state';
import {
	ProtectionStorageKey,
	createProtectionStorageService,
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
 * In-memory browser storage area used to observe storage-service behavior.
 */
class MemoryProtectionStorageArea {
	readonly readKeys: string[] = [];

	readonly writtenValues: Record<string, unknown>[] = [];

	readBarrier: Promise<void> | null = null;

	/**
	 * Creates an in-memory storage area with optional failures and write tracing.
	 * @param values - Initial stored values.
	 * @param writeOrder - Shared write-order trace.
	 * @param label - Area label recorded for each write.
	 * @param readFailure - Optional read failure.
	 * @param writeFailure - Optional write failure.
	 */
	constructor(
		private readonly values: Record<string, unknown> = {},
		private readonly writeOrder: string[] = [],
		private readonly label = 'storage',
		private readonly readFailure: Error | null = null,
		private readonly writeFailure: Error | null = null,
	) {}

	/**
	 * Reads one key from the in-memory storage area.
	 * @param key - Requested storage key.
	 * @return Matching record or an empty record.
	 */
	async get( key: string ): Promise<Record<string, unknown>> {
		if ( this.readFailure !== null ) {
			throw this.readFailure;
		}

		this.readKeys.push( key );

		if ( this.readBarrier !== null ) {
			await this.readBarrier;
		}

		return Object.hasOwn( this.values, key ) ? { [ key ]: this.values[ key ] } : {};
	}

	/**
	 * Writes values to the in-memory storage area.
	 * @param values - Values to store.
	 * @return Promise resolved after the values are stored.
	 */
	set( values: Record<string, unknown> ): Promise<void> {
		this.writeOrder.push( this.label );

		if ( this.writeFailure !== null ) {
			return Promise.reject( this.writeFailure );
		}

		this.writtenValues.push( values );
		Object.assign( this.values, values );

		return Promise.resolve();
	}
}

const STORED_PROTECTION_STATE = StoredProtectionStateSchema.parse( {
	durable: Mock_StoredProtectionState_Durable,
	session: Mock_StoredProtectionState_Session,
} );

const TEST_SNAPSHOT_ID = '00000000-0000-4000-8000-000000000001';

/**
 * Supplies a deterministic storage snapshot identifier.
 * @return Stable snapshot identifier.
 */
function createTestSnapshotId(): string {
	return TEST_SNAPSHOT_ID;
}

/**
 * Wraps one stored document in its storage snapshot envelope.
 * @param snapshotId - Shared storage snapshot identifier.
 * @param document - Domain persistence document.
 * @return Storage snapshot envelope.
 */
function createStoredEnvelope( snapshotId: string, document: unknown ): Record<string, unknown> {
	return { snapshotId, document };
}

describe( 'protection storage service', () => {
	it( 'loads durable and session documents from their exact independent keys', async () => {
		const durableArea = new MemoryProtectionStorageArea( {
			'tocus.protection.durable.v1': createStoredEnvelope(
				TEST_SNAPSHOT_ID,
				STORED_PROTECTION_STATE.durable,
			),
		} );
		const sessionArea = new MemoryProtectionStorageArea( {
			'tocus.protection.session.v1': createStoredEnvelope(
				TEST_SNAPSHOT_ID,
				STORED_PROTECTION_STATE.session,
			),
		} );
		const storage = createProtectionStorageService( {
			durableArea,
			sessionArea,
			createSnapshotId: createTestSnapshotId,
		} );

		await expect( storage.load() ).resolves.toEqual( STORED_PROTECTION_STATE );
		expect( durableArea.readKeys ).toEqual( [ 'tocus.protection.durable.v1' ] );
		expect( sessionArea.readKeys ).toEqual( [ 'tocus.protection.session.v1' ] );
	} );

	it( 'starts both independent reads before either one resolves', async () => {
		const readBarrier = new DeferredPromise();
		const durableArea = new MemoryProtectionStorageArea();
		const sessionArea = new MemoryProtectionStorageArea();

		durableArea.readBarrier = readBarrier.promise;
		sessionArea.readBarrier = readBarrier.promise;

		const storage = createProtectionStorageService( {
			durableArea,
			sessionArea,
			createSnapshotId: createTestSnapshotId,
		} );
		const loadedState = storage.load();

		expect( durableArea.readKeys ).toEqual( [ ProtectionStorageKey.DURABLE ] );
		expect( sessionArea.readKeys ).toEqual( [ ProtectionStorageKey.SESSION ] );

		readBarrier.resolve();

		await expect( loadedState ).resolves.toEqual( {} );
	} );

	it( 'does not recover a session document from a different storage snapshot', async () => {
		const durableArea = new MemoryProtectionStorageArea( {
			[ ProtectionStorageKey.DURABLE ]: createStoredEnvelope(
				'00000000-0000-4000-8000-000000000002',
				STORED_PROTECTION_STATE.durable,
			),
		} );
		const sessionArea = new MemoryProtectionStorageArea( {
			[ ProtectionStorageKey.SESSION ]: createStoredEnvelope(
				'00000000-0000-4000-8000-000000000003',
				STORED_PROTECTION_STATE.session,
			),
		} );
		const storage = createProtectionStorageService( {
			durableArea,
			sessionArea,
			createSnapshotId: createTestSnapshotId,
		} );

		await expect( storage.load() ).resolves.toEqual( {
			durable: STORED_PROTECTION_STATE.durable,
		} );
	} );

	it( 'does not recover an orphaned session document without durable proof', async () => {
		const storage = createProtectionStorageService( {
			durableArea: new MemoryProtectionStorageArea(),
			sessionArea: new MemoryProtectionStorageArea( {
				[ ProtectionStorageKey.SESSION ]: createStoredEnvelope(
					TEST_SNAPSHOT_ID,
					STORED_PROTECTION_STATE.session,
				),
			} ),
			createSnapshotId: createTestSnapshotId,
		} );

		await expect( storage.load() ).resolves.toEqual( {} );
	} );

	it( 'loads a committed durable document without session continuity', async () => {
		const storage = createProtectionStorageService( {
			durableArea: new MemoryProtectionStorageArea( {
				[ ProtectionStorageKey.DURABLE ]: createStoredEnvelope(
					TEST_SNAPSHOT_ID,
					STORED_PROTECTION_STATE.durable,
				),
			} ),
			sessionArea: new MemoryProtectionStorageArea(),
			createSnapshotId: createTestSnapshotId,
		} );

		await expect( storage.load() ).resolves.toEqual( {
			durable: STORED_PROTECTION_STATE.durable,
		} );
	} );

	it( 'ignores a malformed session envelope beside valid durable state', async () => {
		const storage = createProtectionStorageService( {
			durableArea: new MemoryProtectionStorageArea( {
				[ ProtectionStorageKey.DURABLE ]: createStoredEnvelope(
					TEST_SNAPSHOT_ID,
					STORED_PROTECTION_STATE.durable,
				),
			} ),
			sessionArea: new MemoryProtectionStorageArea( {
				[ ProtectionStorageKey.SESSION ]: STORED_PROTECTION_STATE.session,
			} ),
			createSnapshotId: createTestSnapshotId,
		} );

		await expect( storage.load() ).resolves.toEqual( {
			durable: STORED_PROTECTION_STATE.durable,
		} );
	} );

	it( 'reports a malformed durable envelope as invalid stored state', async () => {
		const storage = createProtectionStorageService( {
			durableArea: new MemoryProtectionStorageArea( {
				[ ProtectionStorageKey.DURABLE ]: STORED_PROTECTION_STATE.durable,
			} ),
			sessionArea: new MemoryProtectionStorageArea( {
				[ ProtectionStorageKey.SESSION ]: createStoredEnvelope(
					TEST_SNAPSHOT_ID,
					STORED_PROTECTION_STATE.session,
				),
			} ),
			createSnapshotId: createTestSnapshotId,
		} );

		await expect( storage.load() ).resolves.toEqual( { durable: null } );
	} );

	it( 'keeps missing durable and session documents absent', async () => {
		const storage = createProtectionStorageService( {
			durableArea: new MemoryProtectionStorageArea(),
			sessionArea: new MemoryProtectionStorageArea(),
			createSnapshotId: createTestSnapshotId,
		} );

		await expect( storage.load() ).resolves.toEqual( {} );
	} );

	it( 'writes the session document before the durable document', async () => {
		const writeOrder: string[] = [];
		const durableArea = new MemoryProtectionStorageArea( {}, writeOrder, 'durable' );
		const sessionArea = new MemoryProtectionStorageArea( {}, writeOrder, 'session' );
		const storage = createProtectionStorageService( {
			durableArea,
			sessionArea,
			createSnapshotId: createTestSnapshotId,
		} );

		await storage.save( STORED_PROTECTION_STATE );

		expect( writeOrder ).toEqual( [ 'session', 'durable' ] );
		expect( sessionArea.writtenValues ).toEqual( [ {
			[ ProtectionStorageKey.SESSION ]: createStoredEnvelope(
				TEST_SNAPSHOT_ID,
				STORED_PROTECTION_STATE.session,
			),
		} ] );
		expect( durableArea.writtenValues ).toEqual( [ {
			[ ProtectionStorageKey.DURABLE ]: createStoredEnvelope(
				TEST_SNAPSHOT_ID,
				STORED_PROTECTION_STATE.durable,
			),
		} ] );
	} );

	it( 'exposes immutable exact storage keys', () => {
		expect( Object.isFrozen( ProtectionStorageKey ) ).toBe( true );
		expect( ProtectionStorageKey ).toEqual( {
			DURABLE: 'tocus.protection.durable.v1',
			SESSION: 'tocus.protection.session.v1',
		} );
	} );

	it( 'rejects invalid state before either area is written', async () => {
		const writeOrder: string[] = [];
		const storage = createProtectionStorageService( {
			durableArea: new MemoryProtectionStorageArea( {}, writeOrder, 'durable' ),
			sessionArea: new MemoryProtectionStorageArea( {}, writeOrder, 'session' ),
			createSnapshotId: createTestSnapshotId,
		} );

		await expect( storage.save( { durable: {}, session: {} } ) ).rejects.toThrow();
		expect( writeOrder ).toEqual( [] );
	} );

	it( 'propagates a browser read failure', async () => {
		const readFailure = new Error( 'read failed' );
		const storage = createProtectionStorageService( {
			durableArea: new MemoryProtectionStorageArea( {}, [], 'durable', readFailure ),
			sessionArea: new MemoryProtectionStorageArea(),
			createSnapshotId: createTestSnapshotId,
		} );

		await expect( storage.load() ).rejects.toBe( readFailure );
	} );

	it( 'does not write durable state when the session write fails', async () => {
		const writeOrder: string[] = [];
		const writeFailure = new Error( 'session write failed' );
		const storage = createProtectionStorageService( {
			durableArea: new MemoryProtectionStorageArea( {}, writeOrder, 'durable' ),
			sessionArea: new MemoryProtectionStorageArea( {}, writeOrder, 'session', null, writeFailure ),
			createSnapshotId: createTestSnapshotId,
		} );

		await expect( storage.save( STORED_PROTECTION_STATE ) ).rejects.toBe( writeFailure );
		expect( writeOrder ).toEqual( [ 'session' ] );
	} );

	it( 'propagates a durable write failure after writing session state', async () => {
		const writeOrder: string[] = [];
		const writeFailure = new Error( 'durable write failed' );
		const storage = createProtectionStorageService( {
			durableArea: new MemoryProtectionStorageArea( {}, writeOrder, 'durable', null, writeFailure ),
			sessionArea: new MemoryProtectionStorageArea( {}, writeOrder, 'session' ),
			createSnapshotId: createTestSnapshotId,
		} );

		await expect( storage.save( STORED_PROTECTION_STATE ) ).rejects.toBe( writeFailure );
		expect( writeOrder ).toEqual( [ 'session', 'durable' ] );
	} );
} );
