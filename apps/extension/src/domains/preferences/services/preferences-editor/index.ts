import {
	DefaultPreferencesDocument,
	PreferencesDocumentSchema,
	type PreferencesDocument,
} from '../../types';
import {
	PreferencesUpdateSchema,
	type PreferencesEditor,
	type PreferencesEditorOptions,
	type PreferencesMutation,
	type PreferencesUpdate,
} from './types';

/**
 * Creates validated preference editing with local and cross-context mutation coordination.
 * @param options - Persistence and mutation coordination dependencies.
 * @return Local preferences editor.
 * @since 0.1.0 Initial implementation.
 */
export function createPreferencesEditor( options: PreferencesEditorOptions ): PreferencesEditor {
	let mutationQueue: Promise<void> = Promise.resolve();

	/**
	 * Resolves the internal mutation queue after one edit settles.
	 * @return Undefined queue settlement value.
	 * @since 0.1.0 Initial implementation.
	 */
	function releaseMutationQueue(): undefined {
		return undefined;
	}

	/**
	 * Runs one mutation after every earlier local mutation has settled.
	 * @template Result Mutation result returned after coordination.
	 * @param mutation - Deferred preferences mutation.
	 * @return Exact coordinated mutation result.
	 * @since 0.1.0 Initial implementation.
	 */
	function serializeMutation<Result>(
		mutation: PreferencesMutation<Result>,
	): Promise<Result> {
		const result = mutationQueue.then( () => options.coordinateMutation( mutation ) );

		mutationQueue = result.then( releaseMutationQueue, releaseMutationQueue );

		return result;
	}

	/**
	 * Loads current preferences without replacing malformed data.
	 * @return Current preferences, safe defaults, or null for malformed stored data.
	 * @since 0.1.0 Initial implementation.
	 */
	function load(): Promise<PreferencesDocument | null> {
		return options.storage.load();
	}

	/**
	 * Merges one validated update into the latest stored document while coordination is held.
	 * @param update - Validated fields to update.
	 * @return Updated preferences, or null when current stored data is malformed.
	 * @since 0.1.0 Initial implementation.
	 */
	async function performUpdate(
		update: PreferencesUpdate,
	): Promise<PreferencesDocument | null> {
		const preferences = await options.storage.load();

		if ( preferences === null ) {
			return null;
		}

		const updatedPreferences = PreferencesDocumentSchema.parse( {
			...preferences,
			...update,
		} );

		await options.storage.save( updatedPreferences );

		return updatedPreferences;
	}

	/**
	 * Validates and serializes one local preferences update.
	 * @param input - Unknown preference update input.
	 * @return Updated preferences, or null when current stored data is malformed.
	 * @since 0.1.0 Initial implementation.
	 */
	async function update( input: unknown ): Promise<PreferencesDocument | null> {
		const preferencesUpdate = PreferencesUpdateSchema.parse( input );

		return serializeMutation( () => performUpdate( preferencesUpdate ) );
	}

	/**
	 * Restores defaults only while current data remains malformed and coordination is held.
	 * @return Restored defaults or an authoritative valid document repaired by another context.
	 * @since 0.1.0 Initial implementation.
	 */
	function restoreDefaults(): Promise<PreferencesDocument> {
		return serializeMutation( async () => {
			const preferences = await options.storage.load();

			if ( preferences !== null ) {
				return preferences;
			}

			await options.storage.save( DefaultPreferencesDocument );

			return DefaultPreferencesDocument;
		} );
	}

	return { load, restoreDefaults, update };
}

export * from './types';
