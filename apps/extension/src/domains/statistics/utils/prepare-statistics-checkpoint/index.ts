import {
	StatisticsDocumentSchema,
	type StatisticsDocument,
} from '../../types/statistics-document';
import { StatisticsOperationType } from '../../types/statistics-operation';
import {
	StatisticsSessionDocumentVersion,
	StatisticsSessionDocumentSchema,
	type StatisticsFocusAnchor,
	type StatisticsPendingFocusInterval,
	type StatisticsSessionDocument,
} from '../../types/statistics-session';
import { StatisticsNonNegativeSafeIntegerSchema } from '../../types/statistics-value';
import { reduceStatistics } from '../reduce-statistics';
import {
	type PrepareStatisticsCheckpointInput,
	type PreparedStatisticsCheckpoint,
	type PrepareStatisticsPendingReplayInput,
	type PreparedStatisticsPendingReplay,
	MaximumFocusedObservationGapMilliseconds,
	StatisticsFocusObservationMode,
} from './types';

/**
 * Tests whether one focus anchor identifies the currently observed allowance.
 * @param anchor - Prior compatible focus anchor.
 * @param input - Current checkpoint inputs.
 * @param statisticsDocument - Validated current local statistics.
 * @return True when both sides identify the same active allowance and generation.
 * @since 0.1.0 Initial implementation.
 */
function focusAnchorMatchesCurrentAllowance(
	anchor: StatisticsFocusAnchor,
	input: PrepareStatisticsCheckpointInput,
	statisticsDocument: StatisticsDocument,
): boolean {
	return input.focusedAllowance !== null &&
		anchor.generationId === statisticsDocument.generationId &&
		anchor.scopeId === input.focusedAllowance.scopeId &&
		anchor.measurementRevision === input.focusedAllowance.measurementRevision &&
		anchor.allowanceId === input.focusedAllowance.allowanceId;
}

/**
 * Tests whether one prior anchor can be charged through the current checkpoint.
 * @param anchor - Prior compatible focus anchor.
 * @param input - Current checkpoint inputs.
 * @param statisticsDocument - Validated current local statistics.
 * @return True when browser-session, focus-epoch, and observation rules preserve continuity.
 * @since 0.1.0 Initial implementation.
 */
function focusAnchorCanReachCheckpoint(
	anchor: StatisticsFocusAnchor,
	input: PrepareStatisticsCheckpointInput,
	statisticsDocument: StatisticsDocument,
): boolean {
	const expectedFocusEpochId = input.focusEpochTransition.mode === StatisticsFocusObservationMode.BOUNDARY
		? input.focusEpochTransition.previousFocusEpochId
		: input.focusEpochTransition.currentFocusEpochId;

	if (
		input.focusEpochTransition.mode === StatisticsFocusObservationMode.STARTUP ||
		expectedFocusEpochId === null ||
		anchor.sessionContinuityId !== input.sessionContinuityId ||
		anchor.focusEpochId !== expectedFocusEpochId ||
		anchor.generationId !== statisticsDocument.generationId
	) {
		return false;
	}

	return input.focusEpochTransition.mode === StatisticsFocusObservationMode.BOUNDARY ||
		focusAnchorMatchesCurrentAllowance( anchor, input, statisticsDocument );
}

/**
 * Creates a validated next focus anchor without retaining browser identity or URL data.
 * @param input - Current checkpoint inputs.
 * @param statisticsDocument - Validated current local statistics.
 * @param focusedAtEpochMilliseconds - Validated time captured after focus inspection.
 * @param previousAnchor - Prior compatible focus anchor.
 * @return Next privacy-safe focus anchor, or undefined when focus is ineligible.
 * @since 0.1.0 Initial implementation.
 */
function createNextFocusAnchor(
	input: PrepareStatisticsCheckpointInput,
	statisticsDocument: StatisticsDocument,
	focusedAtEpochMilliseconds: number,
	previousAnchor?: StatisticsFocusAnchor,
): StatisticsFocusAnchor | undefined {
	if ( input.focusedAllowance === null ) {
		return undefined;
	}

	if (
		input.focusEpochTransition.mode === StatisticsFocusObservationMode.STARTUP &&
		previousAnchor !== undefined &&
		previousAnchor.sessionContinuityId === input.sessionContinuityId &&
		previousAnchor.focusEpochId === input.focusEpochTransition.currentFocusEpochId &&
		focusAnchorMatchesCurrentAllowance( previousAnchor, input, statisticsDocument )
	) {
		return previousAnchor;
	}

	return {
		generationId: statisticsDocument.generationId,
		...input.focusedAllowance,
		sessionContinuityId: input.sessionContinuityId,
		focusEpochId: input.focusEpochTransition.currentFocusEpochId,
		focusedAtEpochMilliseconds,
	};
}

/**
 * Creates a canonical compact session document from optional focus work.
 * @param focusAnchor - Optional next focus anchor.
 * @return Canonical session work, or null when empty.
 * @since 0.1.0 Initial implementation.
 */
function createSessionDocument(
	focusAnchor?: StatisticsFocusAnchor,
): StatisticsSessionDocument | null {
	return focusAnchor === undefined
		? null
		: StatisticsSessionDocumentSchema.parse( {
			schemaVersion: StatisticsSessionDocumentVersion,
			focusAnchor,
		} );
}

/**
 * Creates a write-ahead session containing a frozen interval and optional next anchor.
 * @param focusAnchor - Optional next focus anchor.
 * @param pendingInterval - Frozen prior interval that must be replayed.
 * @return Canonical non-empty write-ahead session document.
 * @since 0.1.0 Initial implementation.
 */
function createWriteAheadSessionDocument(
	focusAnchor: StatisticsFocusAnchor | undefined,
	pendingInterval: StatisticsPendingFocusInterval,
): StatisticsSessionDocument {
	return StatisticsSessionDocumentSchema.parse( {
		schemaVersion: StatisticsSessionDocumentVersion,
		...( focusAnchor === undefined ? {} : { focusAnchor } ),
		pendingInterval,
	} );
}

/**
 * Creates a frozen interval from the prior anchor when wall-clock order is safe.
 * @param focusAnchor - Prior compatible focus anchor.
 * @param nowEpochMilliseconds - Validated checkpoint time.
 * @return Frozen prior interval, or undefined after a backward clock movement.
 * @since 0.1.0 Initial implementation.
 */
function createPendingInterval(
	focusAnchor: StatisticsFocusAnchor | undefined,
	nowEpochMilliseconds: number,
): StatisticsPendingFocusInterval | undefined {
	return focusAnchor === undefined ||
		nowEpochMilliseconds < focusAnchor.focusedAtEpochMilliseconds ||
		nowEpochMilliseconds - focusAnchor.focusedAtEpochMilliseconds >
			MaximumFocusedObservationGapMilliseconds
		? undefined
		: {
			generationId: focusAnchor.generationId,
			scopeId: focusAnchor.scopeId,
			measurementRevision: focusAnchor.measurementRevision,
			allowanceId: focusAnchor.allowanceId,
			startedAtEpochMilliseconds: focusAnchor.focusedAtEpochMilliseconds,
			endedAtEpochMilliseconds: nowEpochMilliseconds,
		};
}

/**
 * Finalizes every active allowance expired at one validated checkpoint time.
 * @param document - Statistics after applying any prior focused interval.
 * @param nowEpochMilliseconds - Validated checkpoint time.
 * @return Next statistics and whether at least one allowance was finalized.
 * @since 0.1.0 Initial implementation.
 */
function finalizeExpiredAllowances(
	document: StatisticsDocument,
	nowEpochMilliseconds: number,
): readonly [ StatisticsDocument, boolean ] {
	let nextDocument = document;
	let finalized = false;

	for ( const [ scopeId, scope ] of Object.entries( document.scopes ) ) {
		const activeAllowance = scope.activeAllowance;

		if (
			activeAllowance === undefined ||
			nowEpochMilliseconds < activeAllowance.expiresAtEpochMilliseconds
		) {
			continue;
		}

		nextDocument = reduceStatistics( nextDocument, {
			type: StatisticsOperationType.FINALIZE_ACTIVE_ALLOWANCE,
			generationId: document.generationId,
			scopeId,
			measurementRevision: activeAllowance.measurementRevision,
			allowanceId: activeAllowance.allowanceId,
			finalizedAtEpochMilliseconds: nowEpochMilliseconds,
		} );
		finalized = true;
	}

	return [ nextDocument, finalized ];
}

/**
 * Applies one already-frozen interval and clears only that WAL field.
 * @param input - Valid local statistics and session WAL state.
 * @return Prepared local statistics and captured next anchor state.
 * @throws {RangeError} When the supplied session has no pending interval.
 * @since 0.1.0 Initial implementation.
 */
export function prepareStatisticsPendingReplay(
	input: PrepareStatisticsPendingReplayInput,
): PreparedStatisticsPendingReplay {
	const statisticsDocument = StatisticsDocumentSchema.parse( input.statisticsDocument );
	const statisticsSession = StatisticsSessionDocumentSchema.parse( input.statisticsSession );
	const pendingInterval = statisticsSession.pendingInterval;

	if ( pendingInterval === undefined ) {
		throw new RangeError( 'Statistics pending replay requires a frozen interval.' );
	}

	return {
		statisticsDocument: reduceStatistics( statisticsDocument, {
			type: StatisticsOperationType.RECORD_FOCUSED_INTERVAL,
			...pendingInterval,
		} ),
		statisticsSession: createSessionDocument( statisticsSession.focusAnchor ),
	};
}

/**
 * Prepares crash-safe session and aggregate state for one focused checkpoint.
 * @param input - Valid current local/session state, resolved focus, and wall clock.
 * @return Pure write-ahead, aggregate, and final-session transition.
 * @throws {RangeError} When prior frozen work was not replayed first.
 * @since 0.1.0 Initial implementation.
 */
export function prepareStatisticsCheckpoint(
	input: PrepareStatisticsCheckpointInput,
): PreparedStatisticsCheckpoint {
	const statisticsDocument = StatisticsDocumentSchema.parse( input.statisticsDocument );
	const statisticsSession = input.statisticsSession === null
		? null
		: StatisticsSessionDocumentSchema.parse( input.statisticsSession );
	const nowEpochMilliseconds = StatisticsNonNegativeSafeIntegerSchema.parse(
		input.nowEpochMilliseconds,
	);
	const focusedAtEpochMilliseconds = StatisticsNonNegativeSafeIntegerSchema.parse(
		input.focusedAtEpochMilliseconds,
	);

	if ( statisticsSession?.pendingInterval !== undefined ) {
		throw new RangeError( 'Statistics checkpoint requires pending work to be replayed first.' );
	}

	if ( focusedAtEpochMilliseconds < nowEpochMilliseconds ) {
		throw new RangeError( 'Statistics focus cannot begin before its checkpoint boundary.' );
	}

	const previousAnchor = statisticsSession?.focusAnchor;
	const nextAnchor = createNextFocusAnchor(
		input,
		statisticsDocument,
		focusedAtEpochMilliseconds,
		previousAnchor,
	);
	const pendingInterval = createPendingInterval(
		previousAnchor !== undefined &&
			focusAnchorCanReachCheckpoint( previousAnchor, input, statisticsDocument )
			? previousAnchor
			: undefined,
		nowEpochMilliseconds,
	);
	const writeAheadSession = pendingInterval === undefined
		? undefined
		: createWriteAheadSessionDocument( nextAnchor, pendingInterval );
	const aggregatedDocument = pendingInterval === undefined
		? statisticsDocument
		: reduceStatistics( statisticsDocument, {
			type: StatisticsOperationType.RECORD_FOCUSED_INTERVAL,
			...pendingInterval,
		} );
	const [ finalizedDocument, finalized ] = finalizeExpiredAllowances(
		aggregatedDocument,
		nowEpochMilliseconds,
	);

	return {
		statisticsDocument: finalizedDocument,
		...( writeAheadSession === undefined ? {} : { writeAheadSession } ),
		finalSession: createSessionDocument( nextAnchor ),
		shouldSaveStatistics: pendingInterval !== undefined || finalized,
		shouldPersistFinalSession:
			statisticsSession !== null || nextAnchor !== undefined,
	};
}

export * from './types';
