import { AvailableStatisticsProjectionSchema, StatisticsProjectionStatus }
	from '../../../../../domains/statistics/types/statistics-projection';
import type { AvailableStatisticsProjection } from '../../../../../domains/statistics/types/statistics-projection';
import { shiftStatisticsDate } from '../../../../../domains/statistics/utils/statistics-calendar-date';
import { LocalDateSchema } from '../../../../../domains/protection/types/protection-value';

/**
 * Supplies invented, explicitly comparable weeks for visual review without retaining user activity.
 * @return Validated aggregate-only sample with distinct chart and visit outcomes.
 * @since 1.1.0
 */
export function createStatisticsComparisonFixture(): AvailableStatisticsProjection {
	const previous = [ 2, 5, 3, 4, 1, 3, 2 ];
	const current = [ 3, 2, 4, 3, 5, 4, 3 ];
	const dailyTotals = [ ...previous, ...current ].map( ( count, index ) => ( {
		date: shiftStatisticsDate( LocalDateSchema.parse( '2026-10-05' ), index ),
		estimatedReclaimedMilliseconds: count * 300_000,
		focusedPauseMilliseconds: count * 10_000,
		reconsideredVisitCount: count,
		completedWaitCount: index < previous.length ? 5 : 4,
		allowanceGrantedCount: index < previous.length ? 5 : 4,
	} ) );
	return AvailableStatisticsProjectionSchema.parse( {
		status: StatisticsProjectionStatus.AVAILABLE,
		currentDate: '2026-10-18', firstRecordedDate: '2026-10-01',
		estimatedReclaimedMilliseconds: 44 * 300_000, focusedPauseMilliseconds: 44 * 10_000,
		reconsideredVisitCount: 44, completedWaitCount: 63, allowanceGrantedCount: 63,
		dailyTotals,
		visitOutcomes: { recordedFromDate: '2026-10-01',
			dailySites: dailyTotals.flatMap( ( day, index ) => {
				const visited = index < previous.length ? ( index === 6 ? 2 : 3 ) : ( index === 7 ? 2 : 1 );
				const redditCount = Math.floor( day.reconsideredVisitCount / 2 );
				const redditVisited = Math.floor( visited / 2 );
				return [
					{ date: day.date, siteHost: 'reddit.com',
						reconsideredVisitCount: redditCount, visitedAfterPauseCount: redditVisited },
					{ date: day.date, siteHost: 'youtube.com',
						reconsideredVisitCount: day.reconsideredVisitCount - redditCount,
						visitedAfterPauseCount: visited - redditVisited },
				];
			} ),
			dailyHours: dailyTotals.flatMap( ( day, index ) => {
				if ( index < previous.length ) {
					return [ { date: day.date, hour: 9, reconsideredVisitCount: day.reconsideredVisitCount } ];
				}
				const morning = index === previous.length ? 1 : 0;
				return [
					{ date: day.date, hour: 9, reconsideredVisitCount: morning },
					{ date: day.date, hour: 15, reconsideredVisitCount: day.reconsideredVisitCount - morning },
				];
			} ),
		},
	} );
}
