import {
	type StatisticsFocusEpochRotation,
	type StatisticsSessionStorageService,
} from '../../../../../domains/statistics/services/statistics-session-storage';
import { type StatisticsStorageService } from '../../../../../domains/statistics/services/statistics-storage';
import {
	StatisticsDocumentSchema,
	type StatisticsDocument,
} from '../../../../../domains/statistics/types/statistics-document';
import {
	StatisticsSessionDocumentSchema,
	type StatisticsSessionDocument,
} from '../../../../../domains/statistics/types/statistics-session';
import {
	StatisticsFocusEpochIdSchema,
	type StatisticsFocusEpochId,
} from '../../../../../domains/statistics/types/statistics-value';
import { restoreStatisticsSession } from '../../../../../domains/statistics/utils/restore-statistics-session';
import { TEST_FOCUS_EPOCH_ID } from './documents';

/**
 * In-memory local statistics persistence used at the runtime boundary.
 * @since 0.1.0 Initial implementation.
 */
export class MemoryStatisticsStorage implements StatisticsStorageService {
	/**
	 * Documents accepted by local persistence.
	 * @since 0.1.0 Initial implementation.
	 */
	readonly savedDocuments: StatisticsDocument[] = [];

	/**
	 * Number of local persistence reads.
	 * @since 0.1.0 Initial implementation.
	 */
	loadCount = 0;

	/**
	 * Optional local persistence read failure.
	 * @since 0.1.0 Initial implementation.
	 */
	loadFailure: Error | null = null;

	/**
	 * Optional local persistence write failure.
	 * @since 0.1.0 Initial implementation.
	 */
	saveFailure: Error | null = null;

	/**
	 * Creates local persistence with one load result and optional shared trace.
	 * @param document - Initial valid document or unsafe-storage marker.
	 * @param trace - Ordered persistence and acknowledgement trace.
	 * @since 0.1.0 Initial implementation.
	 */
	constructor(
		private document: StatisticsDocument | null,
		private readonly trace: string[] = [],
	) {}

	/**
	 * Loads the current document or propagates the configured failure.
	 * @return Current valid document or null for unsafe persistence.
	 * @since 0.1.0 Initial implementation.
	 */
	load(): Promise<StatisticsDocument | null> {
		this.loadCount += 1;

		if ( this.loadFailure !== null ) {
			return Promise.reject( this.loadFailure );
		}

		return Promise.resolve(
			this.document === null ? null : StatisticsDocumentSchema.parse( this.document ),
		);
	}

	/**
	 * Validates and stores one local document or propagates the configured failure.
	 * @param input - Unknown local statistics input.
	 * @return Promise settled after the attempted write.
	 * @since 0.1.0 Initial implementation.
	 */
	save( input: unknown ): Promise<void> {
		if ( this.saveFailure !== null ) {
			return Promise.reject( this.saveFailure );
		}

		const document = StatisticsDocumentSchema.parse( input );
		const label = document.lastAppliedBatchId ?? 'reconcile';

		this.trace.push( `local:${ label }` );
		this.savedDocuments.push( document );
		this.document = document;

		return Promise.resolve();
	}
}

/**
 * In-memory session persistence used at the runtime boundary.
 * @since 0.1.0 Initial implementation.
 */
export class MemoryStatisticsSessionStorage implements StatisticsSessionStorageService {
	/**
	 * Session documents accepted by persistence.
	 * @since 0.1.0 Initial implementation.
	 */
	readonly savedDocuments: StatisticsSessionDocument[] = [];

	/**
	 * Successful whole-session removal markers.
	 * @since 0.1.0 Initial implementation.
	 */
	readonly removedDocuments: number[] = [];

	/**
	 * Number of session persistence reads.
	 * @since 0.1.0 Initial implementation.
	 */
	loadCount = 0;

	/**
	 * Number of attempted session writes.
	 * @since 0.1.0 Initial implementation.
	 */
	saveCount = 0;

	/**
	 * Optional write number that fails before persistence.
	 * @since 0.1.0 Initial implementation.
	 */
	failSaveAtCount: number | null = null;

	/**
	 * Optional write number that reports failure after persistence.
	 * @since 0.1.0 Initial implementation.
	 */
	failSaveAfterPersistAtCount: number | null = null;

	/**
	 * Optional session persistence read failure.
	 * @since 0.1.0 Initial implementation.
	 */
	loadFailure: Error | null = null;

	/**
	 * Optional session persistence write failure.
	 * @since 0.1.0 Initial implementation.
	 */
	saveFailure: Error | null = null;

	/**
	 * Optional session persistence removal failure.
	 * @since 0.1.0 Initial implementation.
	 */
	removeFailure: Error | null = null;

	/**
	 * Optional unsafe value returned instead of validated session work.
	 * @since 0.1.0 Initial implementation.
	 */
	unsafeLoadResult: unknown = undefined;

	/**
	 * Optional focus-epoch persistence failure.
	 * @since 0.1.0 Initial implementation.
	 */
	focusEpochFailure: Error | null = null;

	/**
	 * Current deterministic focus epoch.
	 * @since 0.1.0 Initial implementation.
	 */
	focusEpochId = TEST_FOCUS_EPOCH_ID;

	/**
	 * Number of deterministic focus-epoch rotations.
	 * @since 0.1.0 Initial implementation.
	 */
	focusEpochRotationCount = 0;

	/**
	 * Creates session persistence with one compatible load result.
	 * @param document - Initial compatible session work.
	 * @param trace - Ordered persistence and acknowledgement trace.
	 * @since 0.1.0 Initial implementation.
	 */
	constructor(
		private document: StatisticsSessionDocument | null = null,
		private readonly trace: string[] = [],
	) {}

	/**
	 * Removes live focus work while preserving one frozen interval.
	 * @return Remaining pending-only work, or null when no frozen work remains.
	 * @since 0.1.0 Initial implementation.
	 */
	async discardFocusAnchor(): Promise<StatisticsSessionDocument | null> {
		if ( this.loadFailure !== null ) {
			throw this.loadFailure;
		}

		const pendingInterval = this.document?.pendingInterval;

		if ( pendingInterval === undefined ) {
			await this.remove();
			return null;
		}

		const document = StatisticsSessionDocumentSchema.parse( {
			schemaVersion: 1,
			pendingInterval,
		} );

		await this.save( document );
		return document;
	}

	/**
	 * Returns the current focus epoch or propagates the configured failure.
	 * @return Current focus epoch identifier.
	 * @since 0.1.0 Initial implementation.
	 */
	getOrCreateFocusEpoch(): Promise<StatisticsFocusEpochId> {
		if ( this.focusEpochFailure !== null ) {
			return Promise.reject( this.focusEpochFailure );
		}

		return Promise.resolve( this.focusEpochId );
	}

	/**
	 * Loads current compatible session work or propagates the configured failure.
	 * @param statisticsDocument - Current local document used by compatibility checks.
	 * @param sessionContinuityId - Current browser-session identifier.
	 * @param focusEpochId - Current focus epoch identifier.
	 * @return Current session work or null.
	 * @since 0.1.0 Initial implementation.
	 */
	load(
		statisticsDocument: unknown,
		sessionContinuityId: unknown,
		focusEpochId: unknown,
	): Promise<StatisticsSessionDocument | null> {
		this.loadCount += 1;

		if ( this.loadFailure !== null ) {
			return Promise.reject( this.loadFailure );
		}

		if ( this.unsafeLoadResult !== undefined ) {
			return Promise.resolve(
				this.unsafeLoadResult as StatisticsSessionDocument,
			);
		}

		return Promise.resolve( this.document === null
			? null
			: restoreStatisticsSession(
				this.document,
				statisticsDocument,
				sessionContinuityId,
				focusEpochId,
			) );
	}

	/**
	 * Rotates the current focus epoch or propagates the configured failure.
	 * @return Focus epoch identifiers on both sides of the boundary.
	 * @since 0.1.0 Initial implementation.
	 */
	rotateFocusEpoch(): Promise<StatisticsFocusEpochRotation> {
		if ( this.focusEpochFailure !== null ) {
			return Promise.reject( this.focusEpochFailure );
		}

		const previousFocusEpochId = this.focusEpochId;

		this.focusEpochRotationCount += 1;
		this.focusEpochId = StatisticsFocusEpochIdSchema.parse(
			`focus_epoch_rotated_${ String( this.focusEpochRotationCount ) }`,
		);

		return Promise.resolve( {
			previousFocusEpochId,
			currentFocusEpochId: this.focusEpochId,
		} );
	}

	/**
	 * Validates and stores current session work or propagates the configured failure.
	 * @param input - Unknown session statistics input.
	 * @return Promise settled after the attempted write.
	 * @since 0.1.0 Initial implementation.
	 */
	save( input: unknown ): Promise<void> {
		this.saveCount += 1;

		if ( this.saveFailure !== null ) {
			return Promise.reject( this.saveFailure );
		}

		if ( this.failSaveAtCount === this.saveCount ) {
			return Promise.reject( new Error( 'selected session write failed' ) );
		}

		const document = StatisticsSessionDocumentSchema.parse( input );
		const label = document.pendingInterval === undefined ? 'anchor' : 'wal';

		this.trace.push( `session:${ label }` );
		this.savedDocuments.push( document );
		this.document = document;

		if ( this.failSaveAfterPersistAtCount === this.saveCount ) {
			return Promise.reject( new Error( 'persisted session write reported failure' ) );
		}

		return Promise.resolve();
	}

	/**
	 * Removes current session work or propagates the configured failure.
	 * @return Promise settled after the attempted removal.
	 * @since 0.1.0 Initial implementation.
	 */
	remove(): Promise<void> {
		if ( this.removeFailure !== null ) {
			return Promise.reject( this.removeFailure );
		}

		this.trace.push( 'session:remove' );
		this.removedDocuments.push( 1 );
		this.document = null;

		return Promise.resolve();
	}

}
