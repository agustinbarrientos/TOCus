import { describe, expect, it } from 'vitest';
import { DefaultPreferencesDocument, Language, PreferencesDocumentVersion } from '../../types';
import {
	PreferencesStorageKey,
	createPreferencesStorageService,
	type PreferencesStorageArea,
} from './index';

/**
 * In-memory browser storage used to verify preferences persistence.
 * @since 0.1.0 Initial implementation.
 */
class MemoryPreferencesStorageArea implements PreferencesStorageArea {
	readonly readKeys: string[] = [];

	readonly writtenValues: Record<string, unknown>[] = [];

	readError: Error | null = null;

	writeError: Error | null = null;

	/**
	 * Creates an in-memory storage area with initial values.
	 * @param values - Values available before the first read.
	 * @since 0.1.0 Initial implementation.
	 */
	constructor( private readonly values: Record<string, unknown> = {} ) {}

	/**
	 * Reads one stored value or rejects with the configured error.
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
	 * Writes one record into memory or rejects with the configured error.
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

describe( 'createPreferencesStorageService', () => {
	it( 'returns defaults without writing when preferences do not exist', async () => {
		const area = new MemoryPreferencesStorageArea();
		const storage = createPreferencesStorageService( { area } );

		await expect( storage.load() ).resolves.toEqual( DefaultPreferencesDocument );
		expect( area.readKeys ).toEqual( [ 'tocus.preferences.v1' ] );
		expect( area.writtenValues ).toEqual( [] );
	} );

	it( 'saves and reloads one valid preferences document', async () => {
		const preferences = {
			...DefaultPreferencesDocument,
			theme: 'dark',
			palette: 'purple',
			pauseMode: 'quiet',
			reducedMotion: true,
			language: Language.SPANISH_VOS,
		};
		const area = new MemoryPreferencesStorageArea();
		const storage = createPreferencesStorageService( { area } );

		await storage.save( preferences );

		expect( area.writtenValues ).toEqual( [ {
			[ PreferencesStorageKey.PREFERENCES ]: preferences,
		} ] );
		await expect( storage.load() ).resolves.toEqual( preferences );
	} );

	it( 'migrates version-one preferences to automatic language selection without writing', async () => {
		const area = new MemoryPreferencesStorageArea( {
			[ PreferencesStorageKey.PREFERENCES ]: {
				schemaVersion: 1,
				theme: 'dark',
				palette: 'purple',
				pauseMode: 'quiet',
				reducedMotion: true,
			},
		} );
		const storage = createPreferencesStorageService( { area } );

		await expect( storage.load() ).resolves.toEqual( {
			schemaVersion: 2,
			theme: 'dark',
			palette: 'purple',
			pauseMode: 'quiet',
			reducedMotion: true,
			language: null,
		} );
		expect( area.writtenValues ).toEqual( [] );
	} );

	it.each( [
		{ ...DefaultPreferencesDocument, schemaVersion: PreferencesDocumentVersion + 1 },
		{ ...DefaultPreferencesDocument, palette: 'teal' },
		{ ...DefaultPreferencesDocument, language: 'es-MX' },
		{ ...DefaultPreferencesDocument, remoteSync: true },
	] )( 'preserves unsupported or malformed stored preferences', async ( preferences ) => {
		const area = new MemoryPreferencesStorageArea( {
			[ PreferencesStorageKey.PREFERENCES ]: preferences,
		} );
		const storage = createPreferencesStorageService( { area } );

		await expect( storage.load() ).resolves.toBeNull();
		expect( area.writtenValues ).toEqual( [] );
	} );

	it( 'validates preferences before writing', async () => {
		const area = new MemoryPreferencesStorageArea();
		const storage = createPreferencesStorageService( { area } );

		await expect( storage.save( {
			...DefaultPreferencesDocument,
			pauseMode: 'skip',
		} ) ).rejects.toThrow();
		expect( area.writtenValues ).toEqual( [] );
	} );

	it( 'propagates browser storage read failures', async () => {
		const area = new MemoryPreferencesStorageArea();
		const storage = createPreferencesStorageService( { area } );
		const error = new Error( 'Local read unavailable.' );

		area.readError = error;

		await expect( storage.load() ).rejects.toBe( error );
	} );

	it( 'propagates browser storage write failures', async () => {
		const area = new MemoryPreferencesStorageArea();
		const storage = createPreferencesStorageService( { area } );
		const error = new Error( 'Local write unavailable.' );

		area.writeError = error;

		await expect( storage.save( DefaultPreferencesDocument ) ).rejects.toBe( error );
		expect( area.writtenValues ).toEqual( [] );
	} );
} );
