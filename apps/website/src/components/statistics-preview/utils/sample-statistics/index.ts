import { SamplePeriod, type SampleDay, type SampleTotals } from '../../types';

// Each tuple records reconsidered visits, completed waits, and allowances for one day.
const activity = [
	[ 3, 5, 2 ], [ 5, 8, 3 ], [ 2, 4, 2 ], [ 6, 9, 3 ], [ 4, 7, 3 ], [ 0, 0, 0 ], [ 1, 3, 2 ],
	[ 7, 10, 3 ], [ 4, 6, 2 ], [ 3, 6, 3 ], [ 8, 11, 3 ], [ 5, 7, 2 ], [ 2, 3, 1 ], [ 0, 0, 0 ],
	[ 6, 8, 2 ], [ 9, 12, 3 ], [ 4, 7, 3 ], [ 7, 9, 2 ], [ 3, 5, 2 ], [ 1, 2, 1 ], [ 0, 0, 0 ],
	[ 5, 8, 3 ], [ 2, 5, 3 ], [ 6, 10, 4 ], [ 4, 6, 2 ], [ 8, 10, 2 ], [ 3, 4, 1 ], [ 0, 0, 0 ],
	[ 7, 11, 4 ], [ 5, 9, 4 ],
	[ 4, 7, 3 ], [ 6, 8, 2 ], [ 3, 5, 2 ], [ 1, 3, 2 ], [ 0, 0, 0 ], [ 0, 0, 0 ], [ 8, 12, 4 ],
	[ 5, 7, 2 ], [ 10, 13, 3 ], [ 6, 9, 3 ], [ 4, 6, 2 ], [ 2, 4, 2 ], [ 0, 0, 0 ], [ 7, 10, 3 ],
	[ 3, 6, 3 ], [ 9, 11, 2 ], [ 5, 8, 3 ], [ 6, 10, 4 ], [ 0, 0, 0 ], [ 1, 2, 1 ], [ 4, 7, 3 ],
	[ 8, 11, 3 ], [ 6, 8, 2 ], [ 2, 5, 3 ], [ 7, 9, 2 ], [ 0, 0, 0 ], [ 3, 4, 1 ], [ 5, 8, 3 ],
	[ 9, 12, 3 ], [ 4, 6, 2 ], [ 6, 9, 3 ],
] as const;

const dailyTotals: readonly SampleDay[] = activity.map( ( [ visits, completed, allowances ], index ) => {
	const focusedPauseMilliseconds = completed === 0 ? 0 : completed * 30_000 + ( index * 17 % 9 ) * 5_000;
	return {
		date: index < 30 ? `2026-06-${ String( index + 1 ).padStart( 2, '0' ) }`
			: `2026-07-${ String( index - 29 ).padStart( 2, '0' ) }`,
		estimatedReclaimedMilliseconds: visits * 300_000 + focusedPauseMilliseconds,
		focusedPauseMilliseconds,
		reconsideredVisitCount: visits,
		completedWaitCount: completed,
		allowanceGrantedCount: allowances,
	};
} );

/**
 * Adds displayed metrics from the selected underlying days.
 * @param days - Complete calendar records included in the selected period.
 * @return Internally consistent illustrative totals.
 * @since 0.1.0
 */
export function summarizeSampleDays( days: readonly SampleDay[] ): SampleTotals {
	return days.reduce<SampleTotals>( ( total, day ) => ( {
		estimatedReclaimedMilliseconds: total.estimatedReclaimedMilliseconds + day.estimatedReclaimedMilliseconds,
		focusedPauseMilliseconds: total.focusedPauseMilliseconds + day.focusedPauseMilliseconds,
		reconsideredVisitCount: total.reconsideredVisitCount + day.reconsideredVisitCount,
		completedWaitCount: total.completedWaitCount + day.completedWaitCount,
		allowanceGrantedCount: total.allowanceGrantedCount + day.allowanceGrantedCount,
	} ), { estimatedReclaimedMilliseconds: 0, focusedPauseMilliseconds: 0, reconsideredVisitCount: 0,
		completedWaitCount: 0, allowanceGrantedCount: 0 } );
}

/**
 * Two complete past months, viewed on the fixed demonstration date July 31, 2026.
 * @since 0.1.0
 */
export const ExampleStatistics = Object.freeze( { ...summarizeSampleDays( dailyTotals ), dailyTotals } );

/**
 * Filters calendar periods relative to the fixed demonstration date, July 31, 2026.
 * @param period - Selected demonstration period.
 * @return Included daily records, with no future calendar days.
 * @since 0.1.0
 */
export function selectSampleDays( period: SamplePeriod ): readonly SampleDay[] {
	const startDate = period === SamplePeriod.CURRENT_WEEK ? '2026-07-27' :
		period === SamplePeriod.CURRENT_MONTH ? '2026-07-01' : '2026-06-01';
	return dailyTotals.filter( ( day ) => day.date >= startDate );
}
