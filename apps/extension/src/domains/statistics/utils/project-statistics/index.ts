import { StatisticsDocumentSchema } from '../../types/statistics-document';
import {
	StatisticsProjectionStatus,
	type StatisticsProjection,
} from '../../types/statistics-projection';
import { addStatisticsValues } from '../add-statistics-values';

/**
 * Creates an unavailable statistics projection.
 * @return Projection without fabricated metric values.
 * @since 0.1.0 Initial implementation.
 */
function createUnavailableProjection(): StatisticsProjection {
	return { status: StatisticsProjectionStatus.UNAVAILABLE };
}

/**
 * Projects all-time statistics, including focused pause time in the reclaimed-time total.
 * @param input - Unknown persisted statistics document.
 * @return Available aggregate values, or an unavailable projection for unsafe persistence.
 * @since 0.1.0 Initial implementation.
 */
export function projectStatistics( input: unknown ): StatisticsProjection {
	const result = StatisticsDocumentSchema.safeParse( input );

	if ( ! result.success ) {
		return createUnavailableProjection();
	}

	let estimatedReclaimedMilliseconds = 0;
	let focusedPauseMilliseconds = 0;
	let reconsideredVisitCount = 0;
	let completedWaitCount = 0;
	let allowanceGrantedCount = 0;

	try {
		for ( const scope of Object.values( result.data.scopes ) ) {
			estimatedReclaimedMilliseconds = addStatisticsValues(
				estimatedReclaimedMilliseconds,
				scope.totals.estimatedReclaimedMilliseconds,
			);
			focusedPauseMilliseconds = addStatisticsValues(
				focusedPauseMilliseconds,
				scope.totals.focusedPauseMilliseconds,
			);
			reconsideredVisitCount = addStatisticsValues(
				reconsideredVisitCount,
				scope.totals.reconsideredVisitCount,
			);
			completedWaitCount = addStatisticsValues(
				completedWaitCount,
				scope.totals.completedWaitCount,
			);
			allowanceGrantedCount = addStatisticsValues(
				allowanceGrantedCount,
				scope.totals.allowanceGrantedCount,
			);
		}

		// Stored estimates contain avoided browsing only; include pause time once at the read boundary.
		estimatedReclaimedMilliseconds = addStatisticsValues(
			estimatedReclaimedMilliseconds,
			focusedPauseMilliseconds,
		);
	} catch {
		return createUnavailableProjection();
	}

	return {
		status: StatisticsProjectionStatus.AVAILABLE,
		estimatedReclaimedMilliseconds,
		focusedPauseMilliseconds,
		reconsideredVisitCount,
		completedWaitCount,
		allowanceGrantedCount,
	};
}
