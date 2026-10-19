import { StatisticsChangeDirection, type StatisticsChange } from './types';

/**
 * Describes a neutral change between two known non-negative metric values.
 * @param current - Recorded value in the current calendar period.
 * @param previous - Recorded value in the equivalent previous period.
 * @return Magnitude and direction, or no change to display for two zeroes.
 * @since 1.1.0
 */
export function calculateStatisticsChange( current: number, previous: number ): StatisticsChange | null {
	if ( current === 0 && previous === 0 ) {
		return null;
	}
	const difference = Math.abs( current - previous );
	const percentage = previous === 0 ? null : Math.round( difference / previous * 100 );
	return {
		direction: current === previous ? StatisticsChangeDirection.SAME :
			current > previous ? StatisticsChangeDirection.UP : StatisticsChangeDirection.DOWN,
		difference,
		percentage: difference > 0 && percentage === 0 ? null : percentage,
	};
}
