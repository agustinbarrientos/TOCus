import type { z } from 'zod';
import { PreferencesDocumentSchema, type PreferencesDocument } from '../../types';
import { type PreferencesStorageService } from '../preferences-storage';

/**
 * Validates one nonempty update to editable preference fields.
 * @since 0.1.0 Initial implementation.
 */
export const PreferencesUpdateSchema = PreferencesDocumentSchema
	.omit( { schemaVersion: true } )
	.partial()
	.strict()
	.refine( ( update ) => Object.values( update ).every( ( value ) => value !== undefined ) &&
		Object.keys( update ).length > 0, {
		message: 'At least one defined preference must be updated.',
	} );

/**
 * Validated update to one or more editable preference fields.
 * @since 0.1.0 Initial implementation.
 */
export type PreferencesUpdate = z.infer<typeof PreferencesUpdateSchema>;

/**
 * One deferred local preferences mutation.
 * @template Result Mutation result returned after coordination.
 * @since 0.1.0 Initial implementation.
 */
export type PreferencesMutation<Result> = () => Promise<Result>;

/**
 * Coordinates one preferences mutation with every editor context that shares the same authority.
 * @template Result Mutation result returned after coordination.
 * @since 0.1.0 Initial implementation.
 */
export type PreferencesMutationCoordinator = <Result>(
	mutation: PreferencesMutation<Result>,
) => Promise<Result>;

/**
 * Dependencies used by local preferences editing.
 * @since 0.1.0 Initial implementation.
 */
export interface PreferencesEditorOptions {
	coordinateMutation: PreferencesMutationCoordinator;
	storage: PreferencesStorageService;
}

/**
 * Validated and coordinated local preferences editing operations.
 * @since 0.1.0 Initial implementation.
 */
export interface PreferencesEditor {
	/**
	 * Loads current preferences without replacing malformed data.
	 * @return Current preferences, safe defaults, or null for malformed stored data.
	 * @since 0.1.0 Initial implementation.
	 */
	load(): Promise<PreferencesDocument | null>;

	/**
	 * Merges one validated update into the latest stored preferences document.
	 * @param input - Unknown preference update input.
	 * @return Updated preferences, or null when current stored data is malformed.
	 * @since 0.1.0 Initial implementation.
	 */
	update( input: unknown ): Promise<PreferencesDocument | null>;

	/**
	 * Restores defaults only while current data remains malformed.
	 * @return Restored defaults or an authoritative valid document repaired by another context.
	 * @since 0.1.0 Initial implementation.
	 */
	restoreDefaults(): Promise<PreferencesDocument>;
}
