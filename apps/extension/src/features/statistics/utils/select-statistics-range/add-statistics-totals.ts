import type { StatisticsTotals } from '../../../../domains/statistics/types/statistics-document';

/**
 * Adds projected metric values with saturation and without adding included pause time again.
 * @param left - Accumulated recorded values.
 * @param right - Recorded contribution to include.
 * @return Totals bounded by the maximum safe integer.
 * @since 1.1.0
 */
export function addStatisticsTotals( left: StatisticsTotals, right: StatisticsTotals ): StatisticsTotals {
	return {
		estimatedReclaimedMilliseconds: Math.min( Number.MAX_SAFE_INTEGER,
			left.estimatedReclaimedMilliseconds + right.estimatedReclaimedMilliseconds ),
		focusedPauseMilliseconds: Math.min( Number.MAX_SAFE_INTEGER,
			left.focusedPauseMilliseconds + right.focusedPauseMilliseconds ),
		reconsideredVisitCount: Math.min( Number.MAX_SAFE_INTEGER,
			left.reconsideredVisitCount + right.reconsideredVisitCount ),
		completedWaitCount: Math.min( Number.MAX_SAFE_INTEGER, left.completedWaitCount + right.completedWaitCount ),
		allowanceGrantedCount: Math.min( Number.MAX_SAFE_INTEGER,
			left.allowanceGrantedCount + right.allowanceGrantedCount ),
	};
}
