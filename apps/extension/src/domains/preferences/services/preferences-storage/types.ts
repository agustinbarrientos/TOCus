import { z } from 'zod';
import {
	PaletteSchema,
	PauseModeSchema,
	ThemeModeSchema,
	type PreferencesDocument,
} from '../../types';

/**
 * Preferences document version used before language selection was persisted.
 * @since 0.1.0 Initial implementation.
 */
export const VersionOnePreferencesDocumentVersion = 1;

/**
 * Validates the preferences document version used before language selection was persisted.
 * @since 0.1.0 Initial implementation.
 */
const VersionOnePreferencesDocumentVersionSchema = z.number().int().nonnegative().refine(
	( version ) => version === VersionOnePreferencesDocumentVersion,
	{ message: 'Version-one preferences document version is not supported.' },
);

/**
 * Validates the preferences document used before language selection was persisted.
 * @since 0.1.0 Initial implementation.
 */
export const VersionOnePreferencesDocumentSchema = z.object( {
	schemaVersion: VersionOnePreferencesDocumentVersionSchema,
	theme: ThemeModeSchema,
	palette: PaletteSchema,
	pauseMode: PauseModeSchema,
	reducedMotion: z.boolean(),
} ).strict();

/**
 * Stable key for the current local preferences document.
 * @since 0.1.0 Initial implementation.
 */
export const PreferencesStorageKey = Object.freeze( {
	PREFERENCES: 'tocus.preferences.v1',
} as const );

/**
 * Local browser storage operations used by preferences persistence.
 * @since 0.1.0 Initial implementation.
 */
export interface PreferencesStorageArea {
	/**
	 * Reads one storage key.
	 * @param key - Requested storage key.
	 * @return Stored values indexed by key.
	 * @since 0.1.0 Initial implementation.
	 */
	get( key: string ): Promise<Record<string, unknown>>;

	/**
	 * Writes values indexed by storage key.
	 * @param values - Values to store.
	 * @return Promise resolved after the write completes.
	 * @since 0.1.0 Initial implementation.
	 */
	set( values: Record<string, unknown> ): Promise<void>;
}

/**
 * Dependencies used by local preferences persistence.
 * @since 0.1.0 Initial implementation.
 */
export interface PreferencesStorageServiceOptions {
	area: PreferencesStorageArea;
}

/**
 * Local preferences persistence operations.
 * @since 0.1.0 Initial implementation.
 */
export interface PreferencesStorageService {
	/**
	 * Loads the current local preferences document.
	 * @return Current preferences, safe defaults, or null for malformed stored data.
	 * @throws {Error} When the browser storage read rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	load(): Promise<PreferencesDocument | null>;

	/**
	 * Validates and stores one complete local preferences document.
	 * @param input - Unknown preferences document input.
	 * @return Promise resolved after the write completes.
	 * @throws {import('zod').ZodError} When the preferences violate their storage contract.
	 * @throws {Error} When the browser storage write rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	save( input: unknown ): Promise<void>;
}
