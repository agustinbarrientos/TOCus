import { describe, expect, it } from 'vitest';
import {
	DefaultPreferencesDocument,
	Language,
	Palette,
	PauseMode,
	PreferencesDocumentSchema,
	ThemeMode,
	type PreferencesDocument,
} from '../../types';
import { type PreferencesStorageService } from '../preferences-storage';
import {
	createPreferencesEditor,
	type PreferencesMutation,
	type PreferencesMutationCoordinator,
} from './index';

/**
 * In-memory local preferences persistence used by editor tests.
 * @since 0.1.0 Initial implementation.
 */
class MemoryPreferencesEditorStorage implements PreferencesStorageService {
	loads = 0;

	rejectSaves = false;

	readonly writes: PreferencesDocument[] = [];

	/**
	 * Creates persistence with one initial preferences result.
	 * @param preferences - Preferences returned before the first successful write.
	 * @since 0.1.0 Initial implementation.
	 */
	constructor( public preferences: PreferencesDocument | null ) {}

	/**
	 * Loads the latest in-memory preferences result.
	 * @return Current preferences or malformed-data marker.
	 * @since 0.1.0 Initial implementation.
	 */
	load(): Promise<PreferencesDocument | null> {
		this.loads += 1;

		return Promise.resolve( this.preferences );
	}

	/**
	 * Persists one complete preferences document.
	 * @param input - Complete preferences candidate.
	 * @return Promise resolved after persistence.
	 * @since 0.1.0 Initial implementation.
	 */
	save( input: unknown ): Promise<void> {
		if ( this.rejectSaves ) {
			return Promise.reject( new Error( 'Local write unavailable.' ) );
		}

		const preferences = PreferencesDocumentSchema.parse( input );

		this.preferences = preferences;
		this.writes.push( preferences );

		return Promise.resolve();
	}
}

/**
 * Runs one mutation immediately when cross-context coordination is irrelevant.
 * @template Result Mutation result returned after coordination.
 * @param mutation - Deferred preferences mutation.
 * @return Exact mutation result.
 * @since 0.1.0 Initial implementation.
 */
function coordinateMutationDirectly<Result>(
	mutation: PreferencesMutation<Result>,
): Promise<Result> {
	return mutation();
}

/**
 * Resolves one shared mutation queue after either outcome.
 * @return Undefined queue settlement value.
 * @since 0.1.0 Initial implementation.
 */
function releaseSharedMutationQueue(): undefined {
	return undefined;
}

/**
 * Creates one coordinator shared by multiple preferences editor contexts.
 * @return Shared mutation coordinator.
 * @since 0.1.0 Initial implementation.
 */
function createSharedMutationCoordinator(): PreferencesMutationCoordinator {
	let mutationQueue: Promise<void> = Promise.resolve();

	/**
	 * Runs one mutation after all earlier shared mutations settle.
	 * @template Result Mutation result returned after coordination.
	 * @param mutation - Deferred preferences mutation.
	 * @return Exact mutation result.
	 * @since 0.1.0 Initial implementation.
	 */
	function coordinateMutation<Result>(
		mutation: PreferencesMutation<Result>,
	): Promise<Result> {
		const result = mutationQueue.then( mutation );

		mutationQueue = result.then( releaseSharedMutationQueue, releaseSharedMutationQueue );

		return result;
	}

	return coordinateMutation;
}

describe( 'createPreferencesEditor', () => {
	it( 'loads preferences without writing them', async () => {
		const storage = new MemoryPreferencesEditorStorage( DefaultPreferencesDocument );
		const editor = createPreferencesEditor( {
			coordinateMutation: coordinateMutationDirectly,
			storage,
		} );

		await expect( editor.load() ).resolves.toEqual( DefaultPreferencesDocument );
		expect( storage.writes ).toEqual( [] );
	} );

	it( 'merges a validated update into the latest stored preferences', async () => {
		const storage = new MemoryPreferencesEditorStorage( {
			...DefaultPreferencesDocument,
			palette: Palette.GREEN,
		} );
		const editor = createPreferencesEditor( {
			coordinateMutation: coordinateMutationDirectly,
			storage,
		} );

		await expect( editor.update( { theme: ThemeMode.DARK } ) ).resolves.toEqual( {
			...DefaultPreferencesDocument,
			palette: Palette.GREEN,
			theme: ThemeMode.DARK,
		} );
		expect( storage.writes ).toHaveLength( 1 );
	} );

	it( 'stores explicit and automatic language selections as ordinary preference updates', async () => {
		const storage = new MemoryPreferencesEditorStorage( DefaultPreferencesDocument );
		const editor = createPreferencesEditor( {
			coordinateMutation: coordinateMutationDirectly,
			storage,
		} );

		await expect( editor.update( { language: Language.JAPANESE } ) ).resolves.toMatchObject( {
			language: Language.JAPANESE,
		} );
		await expect( editor.update( { language: null } ) ).resolves.toMatchObject( {
			language: null,
		} );
	} );

	it( 'rejects invalid or empty updates before reading storage', async () => {
		const storage = new MemoryPreferencesEditorStorage( DefaultPreferencesDocument );
		const editor = createPreferencesEditor( {
			coordinateMutation: coordinateMutationDirectly,
			storage,
		} );

		await expect( editor.update( {} ) ).rejects.toThrow();
		await expect( editor.update( { theme: undefined } ) ).rejects.toThrow();
		await expect( editor.update( { palette: 'teal' } ) ).rejects.toThrow();
		await expect( editor.update( { language: 'es-MX' } ) ).rejects.toThrow();
		expect( storage.loads ).toBe( 0 );
		expect( storage.writes ).toEqual( [] );
	} );

	it( 'preserves malformed stored preferences during a normal update', async () => {
		const storage = new MemoryPreferencesEditorStorage( null );
		const editor = createPreferencesEditor( {
			coordinateMutation: coordinateMutationDirectly,
			storage,
		} );

		await expect( editor.update( { pauseMode: PauseMode.QUIET } ) ).resolves.toBeNull();
		expect( storage.writes ).toEqual( [] );
	} );

	it( 'restores only the preferences document after an explicit recovery action', async () => {
		const storage = new MemoryPreferencesEditorStorage( null );
		const editor = createPreferencesEditor( {
			coordinateMutation: coordinateMutationDirectly,
			storage,
		} );

		await expect( editor.restoreDefaults() ).resolves.toEqual( DefaultPreferencesDocument );
		expect( storage.writes ).toEqual( [ DefaultPreferencesDocument ] );
	} );

	it( 'preserves preferences repaired by another context before recovery begins', async () => {
		const storage = new MemoryPreferencesEditorStorage( null );
		const editor = createPreferencesEditor( {
			coordinateMutation: coordinateMutationDirectly,
			storage,
		} );
		const repairedPreferences = {
			...DefaultPreferencesDocument,
			palette: Palette.PINK,
		};

		storage.preferences = repairedPreferences;
		await expect( editor.restoreDefaults() ).resolves.toEqual( repairedPreferences );
		expect( storage.writes ).toEqual( [] );
	} );

	it( 'merges concurrent edits from separate contexts without clobbering fields', async () => {
		const storage = new MemoryPreferencesEditorStorage( { ...DefaultPreferencesDocument } );
		const coordinateMutation = createSharedMutationCoordinator();
		const firstEditor = createPreferencesEditor( { coordinateMutation, storage } );
		const secondEditor = createPreferencesEditor( { coordinateMutation, storage } );

		await Promise.all( [
			firstEditor.update( { palette: Palette.PURPLE } ),
			secondEditor.update( { language: Language.PORTUGUESE_PORTUGAL } ),
		] );

		expect( storage.preferences ).toEqual( {
			...DefaultPreferencesDocument,
			palette: Palette.PURPLE,
			language: Language.PORTUGUESE_PORTUGAL,
		} );
	} );

	it( 'releases the local mutation queue after a failed write', async () => {
		const storage = new MemoryPreferencesEditorStorage( { ...DefaultPreferencesDocument } );
		const editor = createPreferencesEditor( {
			coordinateMutation: coordinateMutationDirectly,
			storage,
		} );

		storage.rejectSaves = true;
		await expect( editor.update( { palette: Palette.ORANGE } ) ).rejects.toThrow(
			'Local write unavailable.',
		);
		storage.rejectSaves = false;
		await expect( editor.update( { palette: Palette.BLUE } ) ).resolves.toMatchObject( {
			palette: Palette.BLUE,
		} );
	} );
} );
