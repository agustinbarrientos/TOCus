import {
	StatisticsProjectionStatus, AvailableStatisticsProjectionSchema,
} from '../../../../extension/src/domains/statistics/types/statistics-projection';

/**
 * Illustrative totals: 12 reconsidered visits at five minutes each, plus eight minutes pausing.
 * @since 0.1.0
 */
export const ExampleStatistics = Object.freeze( AvailableStatisticsProjectionSchema.parse( {
	status: StatisticsProjectionStatus.AVAILABLE,
	estimatedReclaimedMilliseconds: ( 12 * 5 + 8 ) * 60_000,
	focusedPauseMilliseconds: 8 * 60_000,
	reconsideredVisitCount: 12,
	completedWaitCount: 24,
	allowanceGrantedCount: 18,
	dailyTotals: [ 1, 2, 1, 2, 1, 2, 3 ].map( ( visits, index ) => ( {
		date: `2026-09-${ String( 8 + index ).padStart( 2, '0' ) }`,
		estimatedReclaimedMilliseconds: ( visits * 5 + ( index === 6 ? 2 : 1 ) ) * 60_000,
		focusedPauseMilliseconds: ( index === 6 ? 2 : 1 ) * 60_000,
		reconsideredVisitCount: visits,
		completedWaitCount: index === 6 ? 6 : 3,
		allowanceGrantedCount: index === 6 ? 6 : 2,
	} ) ),
} ) );
