import { describe, expect, it, vi } from 'vitest';
import { createMockActiveStatisticsDocument } from '../../types/__fixtures__';
import {
	StatisticsSessionStorageKey,
	createStatisticsSessionStorageService,
	type StatisticsSessionStorageArea,
} from './index';

/**
 * Valid session statistics persistence fixture.
 * @since 0.1.0 Initial implementation.
 */
const VALID_SESSION_DOCUMENT = {
	schemaVersion: 1,
	focusAnchor: {
		sessionContinuityId: 'session_current',
		focusEpochId: 'focus_epoch_current',
		generationId: 'generation_1',
		scopeId: 'scope_default',
		measurementRevision: 'revision_1',
		allowanceId: 'allowance_1',
		focusedAtEpochMilliseconds: 200_000,
	},
};

/**
 * Stable browser-session continuity fixture.
 * @since 0.1.0 Initial implementation.
 */
const SESSION_CONTINUITY_ID = 'session_current';

/**
 * Stable focus epoch fixture.
 * @since 0.1.0 Initial implementation.
 */
const FOCUS_EPOCH_ID = 'focus_epoch_current';

/**
 * Creates statistics session persistence with one deterministic focus epoch factory.
 * @param area - In-memory browser session storage area.
 * @param focusEpochIds - Focus epoch identifiers returned in order.
 * @return Session statistics persistence under test.
 * @since 0.1.0 Initial implementation.
 */
function createTestStorage(
	area: StatisticsSessionStorageArea,
	focusEpochIds: readonly string[] = [ 'focus_epoch_created' ],
) {
	const createFocusEpochId = vi.fn();

	for ( const focusEpochId of focusEpochIds ) {
		createFocusEpochId.mockReturnValueOnce( focusEpochId );
	}

	return createStatisticsSessionStorageService( { area, createFocusEpochId } );
}

/**
 * In-memory browser storage used to verify session statistics persistence.
 * @since 0.1.0 Initial implementation.
 */
class MemoryStatisticsSessionStorageArea implements StatisticsSessionStorageArea {
	/**
	 * Storage keys requested by the service.
	 * @since 0.1.0 Initial implementation.
	 */
	readonly readKeys: string[] = [];

	/**
	 * Value records written by the service.
	 * @since 0.1.0 Initial implementation.
	 */
	readonly writtenValues: Record<string, unknown>[] = [];

	/**
	 * Storage keys removed by the service.
	 * @since 0.1.0 Initial implementation.
	 */
	readonly removedKeys: string[] = [];

	readError: Error | null = null;

	writeError: Error | null = null;

	removeError: Error | null = null;

	/**
	 * Creates one in-memory area with initial values.
	 * @param values - Values available before the first read.
	 * @since 0.1.0 Initial implementation.
	 */
	constructor( private readonly values: Record<string, unknown> = {} ) {}

	/**
	 * Reads one key or rejects with the configured error.
	 * @param key - Requested storage key.
	 * @return Matching record or an empty record.
	 * @since 0.1.0 Initial implementation.
	 */
	get( key: string ): Promise<Record<string, unknown>> {
		this.readKeys.push( key );

		if ( this.readError !== null ) {
			return Promise.reject( this.readError );
		}

		return Promise.resolve( Object.hasOwn( this.values, key ) ? { [ key ]: this.values[ key ] } : {} );
	}

	/**
	 * Writes one record or rejects with the configured error.
	 * @param values - Values to persist.
	 * @return Promise resolved after the write.
	 * @since 0.1.0 Initial implementation.
	 */
	set( values: Record<string, unknown> ): Promise<void> {
		if ( this.writeError !== null ) {
			return Promise.reject( this.writeError );
		}

		this.writtenValues.push( values );
		Object.assign( this.values, values );

		return Promise.resolve();
	}

	/**
	 * Removes one key or rejects with the configured error.
	 * @param key - Exact storage key to remove.
	 * @return Promise resolved after removal.
	 * @since 0.1.0 Initial implementation.
	 */
	remove( key: string ): Promise<void> {
		if ( this.removeError !== null ) {
			return Promise.reject( this.removeError );
		}

		this.removedKeys.push( key );
		Reflect.deleteProperty( this.values, key );

		return Promise.resolve();
	}
}

describe( 'createStatisticsSessionStorageService', () => {
	it( 'returns null without writing when session data is absent', async () => {
		const area = new MemoryStatisticsSessionStorageArea();
		const storage = createTestStorage( area );

		await expect( storage.load(
			createMockActiveStatisticsDocument(),
			SESSION_CONTINUITY_ID,
			FOCUS_EPOCH_ID,
		) ).resolves.toBeNull();
		expect( area.readKeys ).toEqual( [ 'tocus.statistics.session.v1' ] );
		expect( area.writtenValues ).toEqual( [] );
	} );

	it( 'loads session work compatible with the local document', async () => {
		const area = new MemoryStatisticsSessionStorageArea( {
			[ StatisticsSessionStorageKey.SESSION ]: VALID_SESSION_DOCUMENT,
		} );
		const storage = createTestStorage( area );

		await expect( storage.load(
			createMockActiveStatisticsDocument(),
			SESSION_CONTINUITY_ID,
			FOCUS_EPOCH_ID,
		) ).resolves.toEqual(
			VALID_SESSION_DOCUMENT,
		);
	} );

	it.each( [
		{ ...VALID_SESSION_DOCUMENT, schemaVersion: 2 },
		{
			...VALID_SESSION_DOCUMENT,
			focusAnchor: { ...VALID_SESSION_DOCUMENT.focusAnchor, generationId: 'generation_old' },
		},
	] )( 'returns null without writing for malformed, future, or incompatible session data', async ( session ) => {
		const area = new MemoryStatisticsSessionStorageArea( {
			[ StatisticsSessionStorageKey.SESSION ]: session,
		} );
		const storage = createTestStorage( area );

		await expect( storage.load(
			createMockActiveStatisticsDocument(),
			SESSION_CONTINUITY_ID,
			FOCUS_EPOCH_ID,
		) ).resolves.toBeNull();
		expect( area.writtenValues ).toEqual( [] );
	} );

	it( 'does not restore a live focus anchor from another browser session', async () => {
		const area = new MemoryStatisticsSessionStorageArea( {
			[ StatisticsSessionStorageKey.SESSION ]: {
				...VALID_SESSION_DOCUMENT,
				focusAnchor: {
					...VALID_SESSION_DOCUMENT.focusAnchor,
					sessionContinuityId: 'session_previous',
				},
			},
		} );
		const storage = createTestStorage( area );

		await expect( storage.load(
			createMockActiveStatisticsDocument(),
			SESSION_CONTINUITY_ID,
			FOCUS_EPOCH_ID,
		) ).resolves.toBeNull();
		expect( area.writtenValues ).toEqual( [] );
	} );

	it( 'does not restore a live focus anchor from another focus epoch', async () => {
		const area = new MemoryStatisticsSessionStorageArea( {
			[ StatisticsSessionStorageKey.SESSION ]: {
				...VALID_SESSION_DOCUMENT,
				focusAnchor: {
					...VALID_SESSION_DOCUMENT.focusAnchor,
					focusEpochId: 'focus_epoch_previous',
				},
			},
		} );
		const storage = createTestStorage( area );

		await expect( storage.load(
			createMockActiveStatisticsDocument(),
			SESSION_CONTINUITY_ID,
			FOCUS_EPOCH_ID,
		) ).resolves.toBeNull();
		expect( area.writtenValues ).toEqual( [] );
	} );

	it( 'validates before writing and saves a valid session document', async () => {
		const area = new MemoryStatisticsSessionStorageArea();
		const storage = createTestStorage( area );

		await expect( storage.save( {} ) ).rejects.toThrow();
		expect( area.writtenValues ).toEqual( [] );

		await storage.save( VALID_SESSION_DOCUMENT );
		expect( area.writtenValues ).toEqual( [ {
			[ StatisticsSessionStorageKey.SESSION ]: VALID_SESSION_DOCUMENT,
		} ] );
	} );

	it( 'omits explicitly undefined optional work before writing', async () => {
		const area = new MemoryStatisticsSessionStorageArea();
		const storage = createTestStorage( area );

		await storage.save( {
			...VALID_SESSION_DOCUMENT,
			pendingInterval: undefined,
		} );

		const writtenDocument = area.writtenValues[ 0 ]?.[ StatisticsSessionStorageKey.SESSION ];

		expect( Object.hasOwn( writtenDocument ?? {}, 'pendingInterval' ) ).toBe( false );
	} );

	it( 'preserves a frozen interval while discarding its live focus anchor', async () => {
		const pendingInterval = {
			generationId: 'generation_1',
			scopeId: 'scope_default',
			measurementRevision: 'revision_1',
			allowanceId: 'allowance_1',
			startedAtEpochMilliseconds: 150_000,
			endedAtEpochMilliseconds: 200_000,
		};
		const area = new MemoryStatisticsSessionStorageArea( {
			[ StatisticsSessionStorageKey.SESSION ]: {
				...VALID_SESSION_DOCUMENT,
				pendingInterval,
			},
		} );
		const storage = createTestStorage( area );

		await expect( storage.discardFocusAnchor() ).resolves.toEqual( {
			schemaVersion: 1,
			pendingInterval,
		} );
		expect( area.writtenValues ).toEqual( [ {
			[ StatisticsSessionStorageKey.SESSION ]: {
				schemaVersion: 1,
				pendingInterval,
			},
		} ] );
		expect( area.removedKeys ).toEqual( [] );
	} );

	it.each( [ 'absent', 'anchor only', 'malformed' ] as const )(
		'removes no frozen work for an %s session document',
		async ( scenario ) => {
			const initialValues = scenario === 'absent'
				? {}
				: {
					[ StatisticsSessionStorageKey.SESSION ]: scenario === 'anchor only'
						? VALID_SESSION_DOCUMENT
						: { malformed: true },
				};
			const area = new MemoryStatisticsSessionStorageArea( initialValues );
			const storage = createTestStorage( area );

			await expect( storage.discardFocusAnchor() ).resolves.toBeNull();
			expect( area.writtenValues ).toEqual( [] );
			expect( area.removedKeys ).toEqual(
				scenario === 'absent' ? [] : [ StatisticsSessionStorageKey.SESSION ],
			);
		},
	);

	it( 'removes only the session statistics key', async () => {
		const area = new MemoryStatisticsSessionStorageArea();
		const storage = createTestStorage( area );

		await storage.remove();

		expect( area.removedKeys ).toEqual( [ 'tocus.statistics.session.v1' ] );
	} );

	it.each( [ 'read', 'write', 'remove' ] as const )(
		'propagates browser storage %s failures',
		async ( operation ) => {
			const area = new MemoryStatisticsSessionStorageArea();
			const storage = createTestStorage( area );
			const error = new Error( `${ operation } unavailable.` );

			area[ `${ operation }Error` ] = error;

			if ( operation === 'read' ) {
				await expect( storage.load(
					createMockActiveStatisticsDocument(),
					SESSION_CONTINUITY_ID,
					FOCUS_EPOCH_ID,
				) ).rejects.toBe( error );
			} else if ( operation === 'write' ) {
				await expect( storage.save( VALID_SESSION_DOCUMENT ) ).rejects.toBe( error );
			} else {
				await expect( storage.remove() ).rejects.toBe( error );
			}
		},
	);

	it.each( [ 'read', 'write', 'remove' ] as const )(
		'propagates browser storage %s failures while discarding a focus anchor',
		async ( operation ) => {
			const session = operation === 'write'
				? {
					...VALID_SESSION_DOCUMENT,
					pendingInterval: {
						generationId: 'generation_1',
						scopeId: 'scope_default',
						measurementRevision: 'revision_1',
						allowanceId: 'allowance_1',
						startedAtEpochMilliseconds: 150_000,
						endedAtEpochMilliseconds: 200_000,
					},
				}
				: VALID_SESSION_DOCUMENT;
			const area = new MemoryStatisticsSessionStorageArea( {
				[ StatisticsSessionStorageKey.SESSION ]: session,
			} );
			const storage = createTestStorage( area );
			const error = new Error( `${ operation } unavailable.` );

			area[ `${ operation }Error` ] = error;

			await expect( storage.discardFocusAnchor() ).rejects.toBe( error );
		},
	);

	it( 'creates and persists a focus epoch when none exists', async () => {
		const area = new MemoryStatisticsSessionStorageArea();
		const storage = createTestStorage( area, [ 'focus_epoch_created' ] );

		await expect( storage.getOrCreateFocusEpoch() ).resolves.toBe( 'focus_epoch_created' );
		expect( area.readKeys ).toEqual( [ StatisticsSessionStorageKey.FOCUS_EPOCH ] );
		expect( area.writtenValues ).toEqual( [ {
			[ StatisticsSessionStorageKey.FOCUS_EPOCH ]: {
				schemaVersion: 1,
				focusEpochId: 'focus_epoch_created',
			},
		} ] );
	} );

	it( 'reuses one focus epoch already loaded by the same service', async () => {
		const area = new MemoryStatisticsSessionStorageArea( {
			[ StatisticsSessionStorageKey.FOCUS_EPOCH ]: {
				schemaVersion: 1,
				focusEpochId: FOCUS_EPOCH_ID,
			},
		} );
		const storage = createTestStorage( area );

		await expect( storage.getOrCreateFocusEpoch() ).resolves.toBe( FOCUS_EPOCH_ID );
		await expect( storage.getOrCreateFocusEpoch() ).resolves.toBe( FOCUS_EPOCH_ID );
		expect( area.readKeys ).toEqual( [ StatisticsSessionStorageKey.FOCUS_EPOCH ] );
		expect( area.writtenValues ).toEqual( [] );
	} );

	it( 'reuses one persisted focus epoch across service activations', async () => {
		const area = new MemoryStatisticsSessionStorageArea( {
			[ StatisticsSessionStorageKey.FOCUS_EPOCH ]: {
				schemaVersion: 1,
				focusEpochId: FOCUS_EPOCH_ID,
			},
		} );

		await expect( createTestStorage( area ).getOrCreateFocusEpoch() ).resolves.toBe(
			FOCUS_EPOCH_ID,
		);
		await expect( createTestStorage( area ).getOrCreateFocusEpoch() ).resolves.toBe(
			FOCUS_EPOCH_ID,
		);
		expect( area.writtenValues ).toEqual( [] );
	} );

	it.each( [
		{ malformed: true },
		{ schemaVersion: 2, focusEpochId: FOCUS_EPOCH_ID },
	] )( 'replaces malformed or unsupported focus epoch data', async ( focusEpochDocument ) => {
		const area = new MemoryStatisticsSessionStorageArea( {
			[ StatisticsSessionStorageKey.FOCUS_EPOCH ]: focusEpochDocument,
		} );
		const storage = createTestStorage( area, [ 'focus_epoch_replacement' ] );

		await expect( storage.getOrCreateFocusEpoch() ).resolves.toBe( 'focus_epoch_replacement' );
		expect( area.writtenValues ).toEqual( [ {
			[ StatisticsSessionStorageKey.FOCUS_EPOCH ]: {
				schemaVersion: 1,
				focusEpochId: 'focus_epoch_replacement',
			},
		} ] );
	} );

	it( 'rotates one existing focus epoch and reports both sides of the boundary', async () => {
		const area = new MemoryStatisticsSessionStorageArea( {
			[ StatisticsSessionStorageKey.FOCUS_EPOCH ]: {
				schemaVersion: 1,
				focusEpochId: FOCUS_EPOCH_ID,
			},
		} );
		const storage = createTestStorage( area, [ 'focus_epoch_next' ] );

		await expect( storage.rotateFocusEpoch() ).resolves.toEqual( {
			previousFocusEpochId: FOCUS_EPOCH_ID,
			currentFocusEpochId: 'focus_epoch_next',
		} );
		expect( area.writtenValues ).toEqual( [ {
			[ StatisticsSessionStorageKey.FOCUS_EPOCH ]: {
				schemaVersion: 1,
				focusEpochId: 'focus_epoch_next',
			},
		} ] );
	} );

	it( 'rotates an absent focus epoch without inventing a previous boundary', async () => {
		const area = new MemoryStatisticsSessionStorageArea();
		const storage = createTestStorage( area, [ 'focus_epoch_next' ] );

		await expect( storage.rotateFocusEpoch() ).resolves.toEqual( {
			previousFocusEpochId: null,
			currentFocusEpochId: 'focus_epoch_next',
		} );
	} );

	it.each( [ 'read', 'write' ] as const )(
		'propagates browser storage %s failures while managing the focus epoch',
		async ( operation ) => {
			const area = new MemoryStatisticsSessionStorageArea();
			const storage = createTestStorage( area );
			const error = new Error( `${ operation } unavailable.` );

			area[ `${ operation }Error` ] = error;

			await expect( storage.getOrCreateFocusEpoch() ).rejects.toBe( error );
		},
	);
} );
