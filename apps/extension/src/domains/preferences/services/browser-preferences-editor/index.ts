import {
	createPreferencesEditor,
	type PreferencesMutation,
} from '../preferences-editor';
import {
	PreferencesStorageKey,
	createPreferencesStorageService,
} from '../preferences-storage';
import {
	type BrowserPreferencesEditor,
	type BrowserPreferencesEditorOptions,
} from './types';

/**
 * Creates browser-backed preferences editing with shared cross-context coordination.
 * @param options - Browser storage and lock dependencies.
 * @return Coordinated preferences editor and persistence boundary.
 * @since 0.1.0 Initial implementation.
 */
export function createBrowserPreferencesEditor(
	options: BrowserPreferencesEditorOptions,
): BrowserPreferencesEditor {
	const storage = createPreferencesStorageService( { area: options.area } );

	/**
	 * Runs one preferences mutation under its stable cross-context lock.
	 * @template Result Exact mutation result.
	 * @param mutation - Deferred preferences mutation.
	 * @return Exact mutation result after lock release.
	 * @since 0.1.0 Initial implementation.
	 */
	function coordinateMutation<Result>(
		mutation: PreferencesMutation<Result>,
	): Promise<Result> {
		return options.locks.request( PreferencesStorageKey.PREFERENCES, mutation );
	}

	const editor = createPreferencesEditor( {
		storage,
		coordinateMutation,
	} );

	return { editor, storage };
}

export * from './types';
