import {
	StatisticsProjectionStatus,
	type StatisticsProjection,
} from '../../../../domains/statistics/types/statistics-projection';
import {
	type WellbeingSummaryCopy,
} from './types';

/**
 * Formats one honest all-time wellbeing summary for the interruption footer.
 * @param projection - Validated all-time statistics projection.
 * @param copy - Localizable duration and sentence formatter.
 * @return Complete footer sentence or the neutral fallback.
 * @since 0.1.0 Initial implementation.
 */
export function formatWellbeingSummary(
	projection: StatisticsProjection,
	copy: Readonly<WellbeingSummaryCopy>,
): string {
	if ( projection.status === StatisticsProjectionStatus.UNAVAILABLE ) {
		return copy.neutral;
	}

	const estimatedReclaimedTime = projection.estimatedReclaimedMilliseconds === null ||
		projection.estimatedReclaimedMilliseconds === 0
		? null
		: copy.formatDuration( projection.estimatedReclaimedMilliseconds );
	const focusedPauseTime = projection.focusedPauseMilliseconds === 0
		? null
		: copy.formatDuration( projection.focusedPauseMilliseconds );

	return copy.formatSummary( {
		estimatedReclaimedTime,
		focusedPauseTime,
	} );
}

export type {
	WellbeingSummaryCopy,
	WellbeingSummaryValues,
} from './types';
