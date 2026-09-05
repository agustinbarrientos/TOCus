import { type PreferencesEditor } from '../preferences-editor';
import {
	type PreferencesStorageArea,
	type PreferencesStorageService,
} from '../preferences-storage';

/**
 * Browser lock boundary used to coordinate preferences mutations across extension contexts.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserPreferencesMutationLock {
	/**
	 * Runs one preferences mutation while holding an exclusive named lock.
	 * @template Result Exact mutation result.
	 * @param name - Stable lock name.
	 * @param mutation - Deferred preferences mutation.
	 * @return Exact result after the lock is released.
	 * @since 0.1.0 Initial implementation.
	 */
	request<Result>( name: string, mutation: () => Promise<Result> ): Promise<Result>;
}

/**
 * Browser dependencies required by coordinated local preferences editing.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserPreferencesEditorOptions {
	/** Extension-local storage area. */
	area: PreferencesStorageArea;
	/** Extension-origin lock manager. */
	locks: BrowserPreferencesMutationLock;
}

/**
 * Coordinated preferences editor and its shared persistence boundary.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserPreferencesEditor {
	/** Validated preferences editing operations. */
	editor: PreferencesEditor;
	/** Persistence used by both editing and live preference projection. */
	storage: PreferencesStorageService;
}
