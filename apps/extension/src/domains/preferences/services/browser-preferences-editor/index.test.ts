import { describe, expect, it, vi } from 'vitest';
import {
	DefaultPreferencesDocument,
	Palette,
} from '../../types';
import {
	PreferencesStorageKey,
} from '../preferences-storage';
import { createBrowserPreferencesEditor } from './index';
import { type BrowserPreferencesMutationLock } from './types';

/**
 * Records browser-lock requests while executing their protected mutations.
 * @since 0.1.0 Initial implementation.
 */
class MemoryPreferencesMutationLock implements BrowserPreferencesMutationLock {
	/** Requested lock names in execution order. */
	readonly names: string[] = [];

	/**
	 * Executes one mutation while recording its requested lock name.
	 * @template Result Exact mutation result.
	 * @param name - Requested browser lock name.
	 * @param mutation - Deferred preferences mutation.
	 * @return Exact mutation result.
	 * @since 0.1.0 Initial implementation.
	 */
	request<Result>( name: string, mutation: () => Promise<Result> ): Promise<Result> {
		this.names.push( name );

		return mutation();
	}
}

describe( 'createBrowserPreferencesEditor', () => {
	it( 'coordinates preference writes with the preferences storage key', async () => {
		const set = vi.fn().mockResolvedValue( undefined );
		const area = {
			get: vi.fn().mockResolvedValue( {
				[ PreferencesStorageKey.PREFERENCES ]: DefaultPreferencesDocument,
			} ),
			set,
		};
		const locks = new MemoryPreferencesMutationLock();
		const services = createBrowserPreferencesEditor( { area, locks } );

		const result = await services.editor.update( { palette: Palette.GREEN } );

		expect( locks.names ).toEqual( [ PreferencesStorageKey.PREFERENCES ] );
		expect( result?.palette ).toBe( Palette.GREEN );
		expect( set ).toHaveBeenCalledWith( {
			[ PreferencesStorageKey.PREFERENCES ]: {
				...DefaultPreferencesDocument,
				palette: Palette.GREEN,
			},
		} );
	} );

	it( 'exposes the same persistence boundary used by the editor', async () => {
		const area = {
			get: vi.fn().mockResolvedValue( {} ),
			set: vi.fn().mockResolvedValue( undefined ),
		};
		const services = createBrowserPreferencesEditor( {
			area,
			locks: new MemoryPreferencesMutationLock(),
		} );

		await expect( services.storage.load() ).resolves.toEqual( DefaultPreferencesDocument );
		await expect( services.editor.load() ).resolves.toEqual( DefaultPreferencesDocument );
		expect( area.get ).toHaveBeenCalledTimes( 2 );
	} );
} );
