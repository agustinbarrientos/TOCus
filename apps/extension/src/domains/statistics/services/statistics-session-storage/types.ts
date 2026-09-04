import { type StatisticsSessionDocument } from '../../types/statistics-session';
import { type StatisticsFocusEpochId } from '../../types/statistics-value';

/**
 * Stable key for the current session statistics document.
 * @since 0.1.0 Initial implementation.
 */
export const StatisticsSessionStorageKey = Object.freeze( {
	FOCUS_EPOCH: 'tocus.statistics.focus-epoch.v1',
	SESSION: 'tocus.statistics.session.v1',
} as const );

/**
 * Focus epoch identifiers on both sides of one observed browser boundary.
 * @since 0.1.0 Initial implementation.
 */
export interface StatisticsFocusEpochRotation {
	previousFocusEpochId: StatisticsFocusEpochId | null;
	currentFocusEpochId: StatisticsFocusEpochId;
}

/**
 * Session browser storage operations used by statistics persistence.
 * @since 0.1.0 Initial implementation.
 */
export interface StatisticsSessionStorageArea {
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

	/**
	 * Removes one exact storage key.
	 * @param key - Exact storage key to remove.
	 * @return Promise resolved after removal completes.
	 * @since 0.1.0 Initial implementation.
	 */
	remove( key: string ): Promise<void>;
}

/**
 * Dependencies used by session statistics persistence.
 * @since 0.1.0 Initial implementation.
 */
export interface StatisticsSessionStorageServiceOptions {
	area: StatisticsSessionStorageArea;

	/**
	 * Creates one candidate identifier for a new focus epoch.
	 * @return Unknown identifier candidate validated before persistence.
	 * @since 0.1.0 Initial implementation.
	 */
	createFocusEpochId(): unknown;
}

/**
 * Session statistics persistence operations.
 * @since 0.1.0 Initial implementation.
 */
export interface StatisticsSessionStorageService {
	/**
	 * Removes only live focus work while preserving any validated frozen interval.
	 * @return Remaining pending-only document, or null when no frozen work remains.
	 * @throws {Error} When the browser storage read, write, or removal rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	discardFocusAnchor(): Promise<StatisticsSessionDocument | null>;

	/**
	 * Returns the current browser-session focus epoch, creating it when absent or invalid.
	 * @return Validated current focus epoch identifier.
	 * @throws {import('zod').ZodError} When the identifier factory returns invalid data.
	 * @throws {Error} When the browser storage read or write rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	getOrCreateFocusEpoch(): Promise<StatisticsFocusEpochId>;

	/**
	 * Loads session work compatible with one local statistics document.
	 * @param statisticsDocument - Unknown current local statistics document input.
	 * @param sessionContinuityId - Unknown current browser-session identifier.
	 * @param focusEpochId - Unknown current focus epoch identifier.
	 * @return Compatible session work, or null when absent or unsafe.
	 * @throws {Error} When the browser storage read rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	load(
		statisticsDocument: unknown,
		sessionContinuityId: unknown,
		focusEpochId: unknown,
	): Promise<StatisticsSessionDocument | null>;

	/**
	 * Persists a fresh focus epoch before one focus-affecting browser boundary is inspected.
	 * @return Validated focus epoch identifiers on both sides of the boundary.
	 * @throws {import('zod').ZodError} When the identifier factory returns invalid data.
	 * @throws {Error} When the browser storage read or write rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	rotateFocusEpoch(): Promise<StatisticsFocusEpochRotation>;

	/**
	 * Validates and stores one complete session statistics document.
	 * @param input - Unknown session statistics document input.
	 * @return Promise resolved after the write completes.
	 * @throws {import('zod').ZodError} When the document violates its storage contract.
	 * @throws {Error} When the browser storage write rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	save( input: unknown ): Promise<void>;

	/**
	 * Removes only the session statistics document.
	 * @return Promise resolved after removal completes.
	 * @throws {Error} When the browser storage removal rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	remove(): Promise<void>;

}
