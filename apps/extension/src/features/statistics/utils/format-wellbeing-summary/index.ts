import {
	StatisticsProjectionStatus,
	type StatisticsProjection,
} from '../../../../domains/statistics/types/statistics-projection';
import {
	type WellbeingSummaryCopy,
	type WellbeingSummaryValues,
} from './types';

/**
 * Milliseconds contained in one second.
 * @since 0.1.0 Initial implementation.
 */
const MILLISECONDS_PER_SECOND = 1_000;

/**
 * Milliseconds contained in one minute.
 * @since 0.1.0 Initial implementation.
 */
const MILLISECONDS_PER_MINUTE = 60_000;

/**
 * Minutes contained in one hour.
 * @since 0.1.0 Initial implementation.
 */
const MINUTES_PER_HOUR = 60;

/**
 * Neutral footer shown without honest nonzero values.
 * @since 0.1.0 Initial implementation.
 */
const DEFAULT_NEUTRAL_SUMMARY = 'This is a moment just for you.';

/**
 * Formats one natural English duration unit.
 * @param value - Positive whole-unit count.
 * @param unit - Singular English unit name.
 * @return Count followed by its correctly pluralized unit.
 * @since 0.1.0 Initial implementation.
 */
function formatDurationUnit( value: number, unit: string ): string {
	return `${ String( value ) } ${ unit }${ value === 1 ? '' : 's' }`;
}

/**
 * Formats one positive duration with natural English units.
 * @param milliseconds - Positive duration in milliseconds.
 * @return Rounded duration in seconds, minutes, or hours and minutes.
 * @since 0.1.0 Initial implementation.
 */
function formatDefaultDuration( milliseconds: number ): string {
	const totalSeconds = Math.max( 1, Math.round( milliseconds / MILLISECONDS_PER_SECOND ) );

	if ( totalSeconds < 60 ) {
		return formatDurationUnit( totalSeconds, 'second' );
	}

	const totalMinutes = Math.max( 1, Math.round( milliseconds / MILLISECONDS_PER_MINUTE ) );

	if ( totalMinutes < MINUTES_PER_HOUR ) {
		return formatDurationUnit( totalMinutes, 'minute' );
	}

	const hours = Math.floor( totalMinutes / MINUTES_PER_HOUR );
	const minutes = totalMinutes % MINUTES_PER_HOUR;

	const hoursLabel = formatDurationUnit( hours, 'hour' );

	return minutes === 0
		? hoursLabel
		: `${ hoursLabel } ${ formatDurationUnit( minutes, 'minute' ) }`;
}

/**
 * Composes the default English wellbeing sentence without claiming unavailable values.
 * @param values - Formatted all-time values.
 * @return Complete English wellbeing sentence.
 * @since 0.1.0 Initial implementation.
 */
function formatDefaultSummary( values: WellbeingSummaryValues ): string {
	if ( values.estimatedReclaimedTime === null && values.focusedPauseTime === null ) {
		return DEFAULT_NEUTRAL_SUMMARY;
	}

	if ( values.estimatedReclaimedTime === null ) {
		return `Since you started, you've taken ${ String( values.focusedPauseTime ) } for yourself.`;
	}

	if ( values.focusedPauseTime === null ) {
		return `Since you started, you've given yourself about ${ values.estimatedReclaimedTime } back.`;
	}

	return `Since you started, you've given yourself about ${ values.estimatedReclaimedTime } back and taken ${ values.focusedPauseTime } for yourself.`;
}

/**
 * Safe English interruption-footer copy used before localization is available.
 * @since 0.1.0 Initial implementation.
 */
export const DefaultWellbeingSummaryCopy: Readonly<WellbeingSummaryCopy> = Object.freeze( {
	neutral: DEFAULT_NEUTRAL_SUMMARY,
	formatDuration: formatDefaultDuration,
	formatSummary: formatDefaultSummary,
} );

/**
 * Formats one honest all-time wellbeing summary for the interruption footer.
 * @param projection - Validated all-time statistics projection.
 * @param copy - Localizable duration and sentence formatter.
 * @return Complete footer sentence or the neutral fallback.
 * @since 0.1.0 Initial implementation.
 */
export function formatWellbeingSummary(
	projection: StatisticsProjection,
	copy: Readonly<WellbeingSummaryCopy> = DefaultWellbeingSummaryCopy,
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
