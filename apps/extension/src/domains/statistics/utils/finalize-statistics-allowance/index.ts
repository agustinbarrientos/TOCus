import type { ScopeStatistics } from '../../types/statistics-document';
import type { FinalizeActiveAllowanceOperation } from '../../types/statistics-operation';

/**
 * Clears an expired allowance measurement while preserving accumulated totals.
 * @param scope - Current scope statistics.
 * @param observedAtEpochMilliseconds - Current deterministic observation time.
 * @return Updated scope statistics, or the original scope before expiry.
 * @since 0.1.0 Initial implementation.
 */
export function finalizeExpiredStatisticsAllowance(
	scope: ScopeStatistics,
	observedAtEpochMilliseconds: number,
): ScopeStatistics {
	const activeAllowance = scope.activeAllowance;

	if (
		activeAllowance === undefined ||
		observedAtEpochMilliseconds < activeAllowance.expiresAtEpochMilliseconds
	) {
		return scope;
	}

	return {
		totals: scope.totals,
		currentMeasurementRevision: activeAllowance.measurementRevision,
	};
}

/**
 * Finalizes one matching active allowance after its expiry.
 * @param scope - Current scope statistics.
 * @param operation - Validated explicit finalization operation.
 * @return Updated scope statistics, or the original scope for stale work.
 * @throws {RangeError} When the matching allowance has not expired.
 * @since 0.1.0 Initial implementation.
 */
export function finalizeMatchingStatisticsAllowance(
	scope: ScopeStatistics,
	operation: FinalizeActiveAllowanceOperation,
): ScopeStatistics {
	const activeAllowance = scope.activeAllowance;

	if (
		scope.currentMeasurementRevision !== operation.measurementRevision ||
		activeAllowance === undefined ||
		activeAllowance.measurementRevision !== operation.measurementRevision ||
		activeAllowance.allowanceId !== operation.allowanceId
	) {
		return scope;
	}

	if ( operation.finalizedAtEpochMilliseconds < activeAllowance.expiresAtEpochMilliseconds ) {
		throw new RangeError( 'An active allowance cannot be finalized before expiry.' );
	}

	return finalizeExpiredStatisticsAllowance(
		scope,
		operation.finalizedAtEpochMilliseconds,
	);
}
