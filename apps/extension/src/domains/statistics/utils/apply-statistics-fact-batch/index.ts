import {
	ProtectionFactType,
	type AllowanceGrantedFact,
	type PauseTimeFact,
	type ProtectionFact,
} from '../../../protection/types/protection-fact';
import { type ProtectionMeasurementRevision } from '../../../protection/types/protection-value';
import { type StatisticsDocument, type ScopeStatistics } from '../../types/statistics-document';
import { type ApplyStatisticsFactBatchOperation } from '../../types/statistics-operation';
import { addStatisticsValues } from '../add-statistics-values';
import { createEmptyScopeStatistics } from '../create-statistics-document';
import { finalizeExpiredStatisticsAllowance } from '../finalize-statistics-allowance';

/**
 * Applies one pause-time fact to scope totals.
 * @param scope - Current scope statistics.
 * @param fact - Accepted pause-time fact.
 * @return Updated scope statistics.
 * @since 0.1.0 Initial implementation.
 */
function applyPauseTimeFact(
	scope: ScopeStatistics,
	fact: PauseTimeFact,
): ScopeStatistics {
	return {
		...scope,
		totals: {
			...scope.totals,
			focusedPauseMilliseconds: addStatisticsValues(
				scope.totals.focusedPauseMilliseconds,
				fact.acceptedDurationMilliseconds,
			),
		},
	};
}

/**
 * Applies one reconsidered-visit fact to scope totals.
 * @param scope - Current scope statistics.
 * @param measurementRevision - Revision captured with the fact.
 * @return Updated scope statistics.
 * @since 0.1.0 Initial implementation.
 */
function applyReconsideredVisitFact(
	scope: ScopeStatistics,
	measurementRevision: ProtectionMeasurementRevision,
): ScopeStatistics {
	const baseline = scope.latestBaseline;
	const reclaimedIncrement =
		baseline?.measurementRevision === measurementRevision
			? baseline.focusedUseMilliseconds
			: 0;

	return {
		...scope,
		totals: {
			...scope.totals,
			estimatedReclaimedMilliseconds: addStatisticsValues(
				scope.totals.estimatedReclaimedMilliseconds,
				reclaimedIncrement,
			),
			reconsideredVisitCount: addStatisticsValues(
				scope.totals.reconsideredVisitCount,
				1,
			),
		},
	};
}

/**
 * Applies one completed-wait fact to scope totals.
 * @param scope - Current scope statistics.
 * @return Updated scope statistics.
 * @since 0.1.0 Initial implementation.
 */
function applyCompletedWaitFact( scope: ScopeStatistics ): ScopeStatistics {
	return {
		...scope,
		totals: {
			...scope.totals,
			completedWaitCount: addStatisticsValues( scope.totals.completedWaitCount, 1 ),
		},
	};
}

/**
 * Applies one allowance-granted fact to scope totals and current measurement state.
 * @param scope - Current scope statistics.
 * @param fact - Accepted allowance-granted fact.
 * @param measurementRevision - Revision captured with the fact.
 * @return Updated scope statistics.
 * @throws {RangeError} When a current allowance would overlap another active allowance.
 * @since 0.1.0 Initial implementation.
 */
function applyAllowanceGrantedFact(
	scope: ScopeStatistics,
	fact: AllowanceGrantedFact,
	measurementRevision: ProtectionMeasurementRevision,
): ScopeStatistics {
	const totals = {
		...scope.totals,
		allowanceGrantedCount: addStatisticsValues( scope.totals.allowanceGrantedCount, 1 ),
	};

	if ( scope.currentMeasurementRevision !== measurementRevision ) {
		return { ...scope, totals };
	}

	if ( scope.activeAllowance !== undefined ) {
		throw new RangeError( 'A new allowance cannot overlap an active allowance measurement.' );
	}

	return {
		...scope,
		totals,
		activeAllowance: {
			allowanceId: fact.allowanceId,
			measurementRevision: scope.currentMeasurementRevision,
			startedAtEpochMilliseconds: fact.startedAtEpochMilliseconds,
			expiresAtEpochMilliseconds: fact.expiresAtEpochMilliseconds,
			confirmedFocusedUseMilliseconds: 0,
			accountedThroughEpochMilliseconds: fact.startedAtEpochMilliseconds,
		},
	};
}

/**
 * Applies one fact to one scope aggregate.
 * @param scope - Current scope statistics.
 * @param fact - Accepted protection fact.
 * @param measurementRevision - Revision captured with the fact.
 * @return Updated scope statistics.
 * @since 0.1.0 Initial implementation.
 */
function applyStatisticsFact(
	scope: ScopeStatistics,
	fact: ProtectionFact,
	measurementRevision: ProtectionMeasurementRevision,
): ScopeStatistics {
	switch ( fact.type ) {
		case ProtectionFactType.PAUSE_TIME:
			return applyPauseTimeFact( scope, fact );
		case ProtectionFactType.RECONSIDERED_VISIT:
			return applyReconsideredVisitFact( scope, measurementRevision );
		case ProtectionFactType.COMPLETED_WAIT:
			return applyCompletedWaitFact( scope );
		case ProtectionFactType.ALLOWANCE_GRANTED:
			return applyAllowanceGrantedFact( scope, fact, measurementRevision );
	}
}

/**
 * Applies one strict FIFO-head fact batch exactly once.
 * @param document - Current validated statistics document.
 * @param operation - Validated fact-batch operation supplied from the durable FIFO head.
 * @return Updated statistics document.
 * @since 0.1.0 Initial implementation.
 */
export function applyStatisticsFactBatch(
	document: StatisticsDocument,
	operation: ApplyStatisticsFactBatchOperation,
): StatisticsDocument {
	const { batch } = operation;

	if ( document.lastAppliedBatchId === batch.batchId ) {
		return document;
	}

	const existingScope = Object.hasOwn( document.scopes, batch.scopeId )
		? document.scopes[ batch.scopeId ]
		: undefined;
	let scope = finalizeExpiredStatisticsAllowance(
		existingScope ?? createEmptyScopeStatistics(),
		batch.observedAtEpochMilliseconds,
	);

	for ( const fact of batch.facts ) {
		scope = applyStatisticsFact( scope, fact, batch.measurementRevision );
	}

	return {
		...document,
		lastAppliedBatchId: batch.batchId,
		scopes: {
			...document.scopes,
			[ batch.scopeId ]: scope,
		},
	};
}
