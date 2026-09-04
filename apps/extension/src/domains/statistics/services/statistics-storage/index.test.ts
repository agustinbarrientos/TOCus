import { describe, expect, it } from 'vitest';
import { createMockStatisticsDocument } from '../../types/__fixtures__';
import {
	StatisticsStorageKey,
	createStatisticsStorageService,
	type StatisticsStorageArea,
} from './index';

/**
 * In-memory browser storage used to verify local statistics persistence.
 * @since 0.1.0 Initial implementation.
 */
class MemoryStatisticsStorageArea implements StatisticsStorageArea {
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

	readError: Error | null = null;

	writeError: Error | null = null;

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

}

/**
 * Creates the deterministic generation used by storage tests.
 * @return Stable test generation identifier.
 * @since 0.1.0 Initial implementation.
 */
function createTestGenerationId(): string {
	return 'generation_created';
}

describe( 'createStatisticsStorageService', () => {
	it( 'creates an in-memory empty document without writing when data is absent', async () => {
		const area = new MemoryStatisticsStorageArea();
		const storage = createStatisticsStorageService( {
			area,
			createGenerationId: createTestGenerationId,
		} );

		await expect( storage.load() ).resolves.toEqual( {
			schemaVersion: 1,
			generationId: 'generation_created',
			lastAppliedBatchId: null,
			scopes: {},
		} );
		expect( area.readKeys ).toEqual( [ 'tocus.statistics.v1' ] );
		expect( area.writtenValues ).toEqual( [] );
	} );

	it( 'saves and reloads one valid document', async () => {
		const area = new MemoryStatisticsStorageArea();
		const storage = createStatisticsStorageService( {
			area,
			createGenerationId: createTestGenerationId,
		} );
		const document = createMockStatisticsDocument();

		await storage.save( document );

		expect( area.writtenValues ).toEqual( [ {
			[ StatisticsStorageKey.STATISTICS ]: document,
		} ] );
		await expect( storage.load() ).resolves.toEqual( document );
	} );

	it( 'omits explicitly undefined optional fields before writing', async () => {
		const area = new MemoryStatisticsStorageArea();
		const storage = createStatisticsStorageService( {
			area,
			createGenerationId: createTestGenerationId,
		} );
		const document = createMockStatisticsDocument();
		const scope = document.scopes.scope_default;

		await storage.save( {
			...document,
			scopes: {
				scope_default: {
					...scope,
					latestBaseline: undefined,
					activeAllowance: undefined,
				},
			},
		} );

		const writtenDocument = area.writtenValues[ 0 ]?.[ StatisticsStorageKey.STATISTICS ];
		const writtenScope = typeof writtenDocument === 'object' && writtenDocument !== null &&
			'scopes' in writtenDocument && typeof writtenDocument.scopes === 'object' &&
			writtenDocument.scopes !== null && 'scope_default' in writtenDocument.scopes
			? writtenDocument.scopes.scope_default
			: null;

		expect( Object.hasOwn( writtenScope ?? {}, 'latestBaseline' ) ).toBe( false );
		expect( Object.hasOwn( writtenScope ?? {}, 'activeAllowance' ) ).toBe( false );
	} );

	it.each( [
		{ ...createMockStatisticsDocument(), schemaVersion: 2 },
		{ ...createMockStatisticsDocument(), generationId: 'invalid generation' },
	] )( 'returns null without writing for malformed or future persistence', async ( document ) => {
		const area = new MemoryStatisticsStorageArea( {
			[ StatisticsStorageKey.STATISTICS ]: document,
		} );
		const storage = createStatisticsStorageService( {
			area,
			createGenerationId: createTestGenerationId,
		} );

		await expect( storage.load() ).resolves.toBeNull();
		expect( area.writtenValues ).toEqual( [] );
	} );

	it( 'validates before writing', async () => {
		const area = new MemoryStatisticsStorageArea();
		const storage = createStatisticsStorageService( {
			area,
			createGenerationId: createTestGenerationId,
		} );

		await expect( storage.save( { schemaVersion: 1 } ) ).rejects.toThrow();
		expect( area.writtenValues ).toEqual( [] );
	} );

	it.each( [ 'read', 'write' ] as const )(
		'propagates browser storage %s failures',
		async ( operation ) => {
			const area = new MemoryStatisticsStorageArea();
			const storage = createStatisticsStorageService( {
				area,
				createGenerationId: createTestGenerationId,
			} );
			const error = new Error( `${ operation } unavailable.` );

			area[ `${ operation }Error` ] = error;

			if ( operation === 'read' ) {
				await expect( storage.load() ).rejects.toBe( error );
			} else {
				await expect( storage.save( createMockStatisticsDocument() ) ).rejects.toBe( error );
			}
		},
	);
} );
