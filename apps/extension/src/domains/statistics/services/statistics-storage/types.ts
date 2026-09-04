import { type StatisticsDocument } from '../../types/statistics-document';

/**
 * Stable key for the current local statistics document.
 * @since 0.1.0 Initial implementation.
 */
export const StatisticsStorageKey = Object.freeze( {
	STATISTICS: 'tocus.statistics.v1',
} as const );

/**
 * Local browser storage operations used by statistics persistence.
 * @since 0.1.0 Initial implementation.
 */
export interface StatisticsStorageArea {
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
 * Dependencies used by local statistics persistence.
 * @since 0.1.0 Initial implementation.
 */
export interface StatisticsStorageServiceOptions {
	area: StatisticsStorageArea;

	/**
	 * Creates a fresh statistics generation identifier.
	 * @return Unknown identifier validated before use.
	 * @since 0.1.0 Initial implementation.
	 */
	createGenerationId(): unknown;
}

/**
 * Local statistics persistence operations.
 * @since 0.1.0 Initial implementation.
 */
export interface StatisticsStorageService {
	/**
	 * Loads the current local statistics document.
	 * @return Current statistics, an in-memory empty document, or null for unsafe persistence.
	 * @throws {Error} When the browser storage read rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	load(): Promise<StatisticsDocument | null>;

	/**
	 * Validates and stores one complete local statistics document.
	 * @param input - Unknown statistics document input.
	 * @return Promise resolved after the write completes.
	 * @throws {import('zod').ZodError} When the document violates its storage contract.
	 * @throws {Error} When the browser storage write rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	save( input: unknown ): Promise<void>;
}
