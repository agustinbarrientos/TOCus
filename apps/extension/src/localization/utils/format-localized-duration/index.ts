import { type I18n } from '@lingui/core';
import { msg, plural } from '@lingui/core/macro';
import { type LocalizationFormatters } from '../create-localization-formatters';
import { DurationUnit, type DurationUnit as DurationUnitValue } from './types';

/**
 * Milliseconds contained in one second.
 * @since 0.1.0 Initial implementation.
 */
export const MILLISECONDS_PER_SECOND = 1_000;

/**
 * Milliseconds contained in one minute.
 * @since 0.1.0 Initial implementation.
 */
export const MILLISECONDS_PER_MINUTE = 60_000;

/**
 * Minutes contained in one hour.
 * @since 0.1.0 Initial implementation.
 */
const MINUTES_PER_HOUR = 60;

/**
 * Formats one localized duration unit through Lingui plural rules.
 * @param i18n - Locale-specific Lingui instance.
 * @param count - Whole unit count.
 * @param unit - Stable duration unit.
 * @return Localized duration unit.
 * @since 0.1.0 Initial implementation.
 */
export function formatDurationUnit( i18n: I18n, count: number, unit: DurationUnitValue ): string {
	switch ( unit ) {
		case DurationUnit.SECOND:
			return i18n._( msg( {
				comment: 'Standalone duration displayed as a whole number of seconds.',
				message: plural( { count }, {
					one: '# second',
					other: '# seconds',
				} ),
			} ) );
		case DurationUnit.MINUTE:
			return i18n._( msg( {
				comment: 'Standalone duration displayed as a whole number of minutes.',
				message: plural( { count }, {
					one: '# minute',
					other: '# minutes',
				} ),
			} ) );
		case DurationUnit.HOUR:
			return i18n._( msg( {
				comment: 'Standalone duration displayed as a whole number of hours.',
				message: plural( { count }, {
					one: '# hour',
					other: '# hours',
				} ),
			} ) );
	}
}

/**
 * Formats a rounded whole-minute duration as minutes or hours and minutes.
 * @param i18n - Locale-specific Lingui instance.
 * @param totalMinutes - Nonnegative rounded whole minutes.
 * @param formatters - Locale-sensitive formatters for the bundle.
 * @return Localized duration.
 * @since 0.1.0 Initial implementation.
 */
export function formatMinuteDuration(
	i18n: I18n,
	totalMinutes: number,
	formatters: LocalizationFormatters,
): string {
	if ( totalMinutes < MINUTES_PER_HOUR ) {
		return formatDurationUnit( i18n, totalMinutes, DurationUnit.MINUTE );
	}

	const hours = Math.floor( totalMinutes / MINUTES_PER_HOUR );
	const minutes = totalMinutes % MINUTES_PER_HOUR;
	const hoursLabel = formatDurationUnit( i18n, hours, DurationUnit.HOUR );

	if ( minutes === 0 ) {
		return hoursLabel;
	}

	return formatters.list.format( [
		hoursLabel,
		formatDurationUnit( i18n, minutes, DurationUnit.MINUTE ),
	] );
}

export { DurationUnit, type DurationUnit as DurationUnitValue } from './types';
