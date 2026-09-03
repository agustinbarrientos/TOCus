import {
	DefaultPreferencesDocument,
	PreferencesDocumentSchema,
	type PreferencesDocument,
} from '../../types';
import {
	PreferencesStorageKey,
	type PreferencesStorageService,
	type PreferencesStorageServiceOptions,
} from './types';

/**
 * Creates local persistence for appearance and accessibility preferences.
 * @param options - Local browser storage dependency.
 * @return Local preferences persistence operations.
 * @since 0.1.0 Initial implementation.
 */
export function createPreferencesStorageService(
	options: PreferencesStorageServiceOptions,
): PreferencesStorageService {
	/**
	 * Loads current preferences without replacing malformed stored data.
	 * @return Current preferences, safe defaults, or null for malformed stored data.
	 * @throws {Error} When the browser storage read rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	async function load(): Promise<PreferencesDocument | null> {
		const values = await options.area.get( PreferencesStorageKey.PREFERENCES );

		if ( ! Object.hasOwn( values, PreferencesStorageKey.PREFERENCES ) ) {
			return DefaultPreferencesDocument;
		}

		const preferences = PreferencesDocumentSchema.safeParse(
			values[ PreferencesStorageKey.PREFERENCES ],
		);

		return preferences.success ? preferences.data : null;
	}

	/**
	 * Validates and stores one complete preferences document.
	 * @param input - Unknown preferences document input.
	 * @return Promise resolved after the write completes.
	 * @throws {import('zod').ZodError} When the preferences violate their storage contract.
	 * @throws {Error} When the browser storage write rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	async function save( input: unknown ): Promise<void> {
		const preferences = PreferencesDocumentSchema.parse( input );

		await options.area.set( {
			[ PreferencesStorageKey.PREFERENCES ]: preferences,
		} );
	}

	return { load, save };
}

export * from './types';
