import { LocalDateSchema } from '../../../protection/types/protection-value';
import {
	StatisticsDocumentSchema,
	StatisticsRetentionDays,
	type DailyStatisticsTotals,
} from '../../types/statistics-document';
import {
	StatisticsProjectionStatus,
	StatisticsProjectionDays,
	type StatisticsProjection,
} from '../../types/statistics-projection';
import { addStatisticsValues } from '../add-statistics-values';
import { createEmptyStatisticsTotals } from '../create-statistics-document';
import { shiftStatisticsDate } from '../statistics-calendar-date';

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
 * @param today - Current local calendar date used to bound the graph.
 * @return Available aggregate values, or an unavailable projection for unsafe persistence.
 * @since 0.1.0 Initial implementation.
 */
export function projectStatistics( input: unknown, today: unknown ): StatisticsProjection {
	const result = StatisticsDocumentSchema.safeParse( input );
	const currentDate = LocalDateSchema.safeParse( today );

	if ( ! result.success || ! currentDate.success ) {
		return createUnavailableProjection();
	}

	let estimatedReclaimedMilliseconds = 0;
	let focusedPauseMilliseconds = 0;
	let reconsideredVisitCount = 0;
	let completedWaitCount = 0;
	let allowanceGrantedCount = 0;
	const dailyTotals: DailyStatisticsTotals[] = [];

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

		const earliestDate = shiftStatisticsDate( currentDate.data, 1 - StatisticsProjectionDays );
		const firstRecordedDate = result.data.firstRecordedDate;

		if ( firstRecordedDate !== null ) {
			let date = firstRecordedDate > earliestDate ? firstRecordedDate : earliestDate;
			let retentionStart = firstRecordedDate;

			for ( const day of result.data.dailyTotals ) {
				retentionStart = shiftStatisticsDate( day.date, 1 - StatisticsRetentionDays );
			}

			if ( date < retentionStart ) {
				date = retentionStart;
			}

			const recordedDays = new Map( result.data.dailyTotals.map( ( day ) => [ day.date, day ] ) );

			while ( date <= currentDate.data ) {
				const totals = recordedDays.get( date ) ?? createEmptyStatisticsTotals();
				dailyTotals.push( {
					...totals,
					date,
					estimatedReclaimedMilliseconds: addStatisticsValues(
						totals.estimatedReclaimedMilliseconds, totals.focusedPauseMilliseconds,
					),
				} );
				date = shiftStatisticsDate( date, 1 );
			}
		}
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
		dailyTotals,
	};
}
