import {
	StatisticsFocusEpochDocumentSchema,
	StatisticsFocusEpochDocumentVersion,
	StatisticsSessionDocumentSchema,
	type StatisticsSessionDocument,
} from '../../types/statistics-session';
import {
	StatisticsFocusEpochIdSchema,
	type StatisticsFocusEpochId,
} from '../../types/statistics-value';
import { restoreStatisticsSession } from '../../utils/restore-statistics-session';
import {
	StatisticsSessionStorageKey,
	type StatisticsFocusEpochRotation,
	type StatisticsSessionStorageService,
	type StatisticsSessionStorageServiceOptions,
} from './types';

/**
 * Creates session persistence for focused allowance measurement.
 * @param options - Session browser storage dependency.
 * @return Session statistics persistence operations.
 * @since 0.1.0 Initial implementation.
 */
export function createStatisticsSessionStorageService(
	options: StatisticsSessionStorageServiceOptions,
): StatisticsSessionStorageService {
	let focusEpochId: StatisticsFocusEpochId | null = null;
	let focusEpochQueue: Promise<void> = Promise.resolve();

	/**
	 * Serializes one focus epoch operation without poisoning the queue after rejection.
	 * @param operation - Deferred focus epoch operation.
	 * @return Promise for the operation result.
	 * @since 0.1.0 Initial implementation.
	 */
	function enqueueFocusEpoch<T>( operation: () => Promise<T> ): Promise<T> {
		const result = focusEpochQueue.then( operation, operation );

		focusEpochQueue = result.then(
			() => undefined,
			() => undefined,
		);

		return result;
	}

	/**
	 * Reads the current validated focus epoch from browser session storage.
	 * @return Stored focus epoch identifier, or null when absent or invalid.
	 * @throws {Error} When the browser storage read rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	async function readFocusEpoch(): Promise<StatisticsFocusEpochId | null> {
		const values = await options.area.get( StatisticsSessionStorageKey.FOCUS_EPOCH );

		if ( ! Object.hasOwn( values, StatisticsSessionStorageKey.FOCUS_EPOCH ) ) {
			return null;
		}

		const result = StatisticsFocusEpochDocumentSchema.safeParse(
			values[ StatisticsSessionStorageKey.FOCUS_EPOCH ],
		);

		return result.success ? result.data.focusEpochId : null;
	}

	/**
	 * Creates and persists one validated focus epoch identifier.
	 * @return Newly persisted focus epoch identifier.
	 * @throws {import('zod').ZodError} When the identifier factory returns invalid data.
	 * @throws {Error} When the browser storage write rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	async function createAndPersistFocusEpoch(): Promise<StatisticsFocusEpochId> {
		const nextFocusEpochId = StatisticsFocusEpochIdSchema.parse( options.createFocusEpochId() );
		const document = StatisticsFocusEpochDocumentSchema.parse( {
			schemaVersion: StatisticsFocusEpochDocumentVersion,
			focusEpochId: nextFocusEpochId,
		} );

		await options.area.set( { [ StatisticsSessionStorageKey.FOCUS_EPOCH ]: document } );
		focusEpochId = nextFocusEpochId;

		return nextFocusEpochId;
	}

	/**
	 * Returns the current focus epoch inside the serialized operation queue.
	 * @return Current or newly persisted focus epoch identifier.
	 * @since 0.1.0 Initial implementation.
	 */
	async function getOrCreateFocusEpochOperation(): Promise<StatisticsFocusEpochId> {
		if ( focusEpochId !== null ) {
			return focusEpochId;
		}

		focusEpochId = await readFocusEpoch();

		return focusEpochId ?? createAndPersistFocusEpoch();
	}

	/**
	 * Returns the current browser-session focus epoch, creating it when necessary.
	 * @return Validated current focus epoch identifier.
	 * @throws {import('zod').ZodError} When the identifier factory returns invalid data.
	 * @throws {Error} When the browser storage read or write rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	function getOrCreateFocusEpoch(): Promise<StatisticsFocusEpochId> {
		return enqueueFocusEpoch( getOrCreateFocusEpochOperation );
	}

	/**
	 * Rotates the focus epoch inside the serialized operation queue.
	 * @return Focus epoch identifiers on both sides of the boundary.
	 * @since 0.1.0 Initial implementation.
	 */
	async function rotateFocusEpochOperation(): Promise<StatisticsFocusEpochRotation> {
		const previousFocusEpochId = focusEpochId ?? await readFocusEpoch();
		const currentFocusEpochId = await createAndPersistFocusEpoch();

		return { previousFocusEpochId, currentFocusEpochId };
	}

	/**
	 * Persists a fresh focus epoch before one focus-affecting browser boundary is inspected.
	 * @return Validated focus epoch identifiers on both sides of the boundary.
	 * @throws {import('zod').ZodError} When the identifier factory returns invalid data.
	 * @throws {Error} When the browser storage read or write rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	function rotateFocusEpoch(): Promise<StatisticsFocusEpochRotation> {
		return enqueueFocusEpoch( rotateFocusEpochOperation );
	}

	/**
	 * Removes only live focus work while preserving any validated frozen interval.
	 * @return Remaining pending-only document, or null when no frozen work remains.
	 * @throws {Error} When the browser storage read, write, or removal rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	async function discardFocusAnchor(): Promise<StatisticsSessionDocument | null> {
		const values = await options.area.get( StatisticsSessionStorageKey.SESSION );

		if ( ! Object.hasOwn( values, StatisticsSessionStorageKey.SESSION ) ) {
			return null;
		}

		const result = StatisticsSessionDocumentSchema.safeParse(
			values[ StatisticsSessionStorageKey.SESSION ],
		);

		if ( ! result.success || result.data.pendingInterval === undefined ) {
			await options.area.remove( StatisticsSessionStorageKey.SESSION );
			return null;
		}

		const document = StatisticsSessionDocumentSchema.parse( {
			schemaVersion: result.data.schemaVersion,
			pendingInterval: result.data.pendingInterval,
		} );

		await options.area.set( { [ StatisticsSessionStorageKey.SESSION ]: document } );

		return document;
	}

	/**
	 * Loads compatible session work without replacing unsafe stored data.
	 * @param statisticsDocument - Unknown current local statistics document input.
	 * @param sessionContinuityId - Unknown current browser-session identifier.
	 * @param currentFocusEpochId - Unknown current focus epoch identifier.
	 * @return Compatible session work, or null when absent or unsafe.
	 * @throws {Error} When the browser storage read rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	async function load(
		statisticsDocument: unknown,
		sessionContinuityId: unknown,
		currentFocusEpochId: unknown,
	): Promise<StatisticsSessionDocument | null> {
		const values = await options.area.get( StatisticsSessionStorageKey.SESSION );

		if ( ! Object.hasOwn( values, StatisticsSessionStorageKey.SESSION ) ) {
			return null;
		}

		return restoreStatisticsSession(
			values[ StatisticsSessionStorageKey.SESSION ],
			statisticsDocument,
			sessionContinuityId,
			currentFocusEpochId,
		);
	}

	/**
	 * Validates and stores one complete session statistics document.
	 * @param input - Unknown session statistics document input.
	 * @return Promise resolved after the write completes.
	 * @throws {import('zod').ZodError} When the document violates its storage contract.
	 * @throws {Error} When the browser storage write rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	async function save( input: unknown ): Promise<void> {
		const document = StatisticsSessionDocumentSchema.parse( input );

		await options.area.set( {
			[ StatisticsSessionStorageKey.SESSION ]: document,
		} );
	}

	/**
	 * Removes only the session statistics document.
	 * @return Promise resolved after removal completes.
	 * @throws {Error} When the browser storage removal rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	async function remove(): Promise<void> {
		await options.area.remove( StatisticsSessionStorageKey.SESSION );
	}

	return {
		discardFocusAnchor,
		getOrCreateFocusEpoch,
		load,
		remove,
		rotateFocusEpoch,
		save,
	};
}

export * from './types';
