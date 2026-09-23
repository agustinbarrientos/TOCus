import type { I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { WellbeingSummaryCopy } from '../../../features/statistics/utils/format-wellbeing-summary/types';
import type { LocalizationFormatters } from '../create-localization-formatters';
import {
	DurationUnit,
	formatDurationUnit,
	formatMinuteDuration,
	MILLISECONDS_PER_MINUTE,
	MILLISECONDS_PER_SECOND,
} from '../format-localized-duration';

/**
 * Creates localized interruption-footer wellbeing copy.
 * @param i18n - Locale-specific Lingui instance.
 * @param formatters - Locale-sensitive formatters for the bundle.
 * @return Complete localized wellbeing-summary copy.
 * @since 1.0.0 Initial implementation.
 */
export function createWellbeingCopy(
	i18n: I18n,
	formatters: LocalizationFormatters,
): Readonly<WellbeingSummaryCopy> {
	const shortSeconds = new Intl.NumberFormat( i18n.locale, {
		style: 'unit', unit: DurationUnit.SECOND, unitDisplay: 'short',
	} );
	const shortMinutes = new Intl.NumberFormat( i18n.locale, {
		style: 'unit', unit: DurationUnit.MINUTE, unitDisplay: 'short',
	} );
	const shortHours = new Intl.NumberFormat( i18n.locale, {
		style: 'unit', unit: DurationUnit.HOUR, unitDisplay: 'short',
	} );
	const shortList = new Intl.ListFormat( i18n.locale, { style: 'short', type: 'unit' } );

	/**
	 * Formats one nonzero all-time duration.
	 * @param milliseconds - Positive duration in milliseconds.
	 * @return Localized natural duration.
	 * @since 1.0.0 Initial implementation.
	 */
	function formatDuration( milliseconds: number ): string {
		const totalSeconds = Math.max( 1, Math.round( milliseconds / MILLISECONDS_PER_SECOND ) );

		if ( totalSeconds < 60 ) {
			return formatDurationUnit( i18n, totalSeconds, DurationUnit.SECOND );
		}

		return formatMinuteDuration(
			i18n,
			Math.max( 1, Math.round( milliseconds / MILLISECONDS_PER_MINUTE ) ),
			formatters,
		);
	}

	/**
	 * Formats one nonzero all-time duration with locale-native compact units.
	 * @param milliseconds - Positive duration in milliseconds.
	 * @return Localized compact duration.
	 * @since 1.0.0 Initial implementation.
	 */
	function formatShortDuration( milliseconds: number ): string {
		const totalSeconds = Math.max( 1, Math.round( milliseconds / MILLISECONDS_PER_SECOND ) );

		if ( totalSeconds < 60 ) {
			return shortSeconds.format( totalSeconds );
		}

		const totalMinutes = Math.max( 1, Math.round( milliseconds / MILLISECONDS_PER_MINUTE ) );

		if ( totalMinutes < 60 ) {
			return shortMinutes.format( totalMinutes );
		}

		const hours = Math.floor( totalMinutes / 60 );
		const minutes = totalMinutes % 60;

		return minutes === 0
			? shortHours.format( hours )
			: shortList.format( [ shortHours.format( hours ), shortMinutes.format( minutes ) ] );
	}

	/**
	 * Composes the concise new-tab estimate.
	 * @param duration - Localized compact estimated duration.
	 * @return Complete concise estimate sentence.
	 * @since 1.0.0 Initial implementation.
	 */
	function formatShortSummary( duration: string ): string {
		return i18n._( msg`About ${ duration } saved.` );
	}

	/**
	 * Composes one complete wellbeing sentence from available values.
	 * @param values - Available formatted all-time values.
	 * @return Complete localized wellbeing sentence.
	 * @since 1.0.0 Initial implementation.
	 */
	function formatSummary( values: Parameters<WellbeingSummaryCopy[ 'formatSummary' ]>[ 0 ] ): string {
		const { estimatedReclaimedTime, focusedPauseTime } = values;

		if ( estimatedReclaimedTime === null ) {
			if ( focusedPauseTime === null ) {
				return i18n._( msg`This is a moment just for you.` );
			}

			return i18n._( msg`Since you started, you've taken ${ focusedPauseTime } for yourself.` );
		}

		if ( focusedPauseTime === null ) {
			return i18n._( msg`Since you started, you've given yourself about ${ estimatedReclaimedTime } back.` );
		}

		return i18n._( msg`Since you started, you've given yourself about ${ estimatedReclaimedTime } back, including ${ focusedPauseTime } spent pausing.` );
	}

	return Object.freeze( {
		neutral: i18n._( msg`This is a moment just for you.` ),
		formatDuration,
		formatShortDuration,
		formatShortSummary,
		formatSummary,
	} );
}
