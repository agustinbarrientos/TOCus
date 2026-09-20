import {
	StatisticsProjectionStatus,
	type StatisticsProjection,
} from '../../../../domains/statistics/types/statistics-projection';
import type {
	WellbeingSummaryCopy,
} from './types';

/** Minimum raw all-time estimate shown on the standalone interruption page. */
const NEW_TAB_MINIMUM_ESTIMATED_RECLAIMED_MILLISECONDS = 15 * 60_000;

/**
 * Formats the concise standalone interruption-page summary after its visibility threshold.
 * @param projection - Validated all-time statistics projection.
 * @param copy - Localizable compact duration and sentence formatter.
 * @return Concise footer sentence, or an empty string below the raw threshold.
 * @since 0.1.0 Initial implementation.
 */
export function formatNewTabWellbeingSummary(
	projection: StatisticsProjection,
	copy: Readonly<WellbeingSummaryCopy>,
): string {
	if (
		projection.status === StatisticsProjectionStatus.UNAVAILABLE ||
		projection.estimatedReclaimedMilliseconds < NEW_TAB_MINIMUM_ESTIMATED_RECLAIMED_MILLISECONDS
	) {
		return '';
	}

	return copy.formatShortSummary(
		copy.formatShortDuration( projection.estimatedReclaimedMilliseconds ),
	);
}

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

	const estimatedReclaimedTime = projection.estimatedReclaimedMilliseconds === 0
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
