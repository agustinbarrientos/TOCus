import type { I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { StatisticsSettingsScreenCopy } from '../../../features/statistics/components/settings-screen/types';
import type { LocalizationFormatters } from '../create-localization-formatters';
import {
	formatMinuteDuration,
	DurationUnit,
	MILLISECONDS_PER_MINUTE,
	MILLISECONDS_PER_SECOND,
} from '../format-localized-duration';

/**
 * Creates localized Statistics-screen copy.
 * @param i18n - Locale-specific Lingui instance.
 * @param formatters - Locale-sensitive formatters for the bundle.
 * @return Complete localized Statistics-screen copy.
 * @since 1.0.0 Initial implementation.
 */
export function createStatisticsCopy(
	i18n: I18n,
	formatters: LocalizationFormatters,
): Readonly<StatisticsSettingsScreenCopy> {
	const dateFormatter = new Intl.DateTimeFormat( i18n.locale, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' } );
	const axisOptions: Intl.NumberFormatOptions = {
		style: 'unit', unitDisplay: 'narrow', maximumSignificantDigits: 3, notation: 'compact',
	};
	const axisSeconds = new Intl.NumberFormat( i18n.locale, { ...axisOptions, unit: DurationUnit.SECOND } );
	const axisMinutes = new Intl.NumberFormat( i18n.locale, { ...axisOptions, unit: DurationUnit.MINUTE } );
	const axisHours = new Intl.NumberFormat( i18n.locale, { ...axisOptions, unit: DurationUnit.HOUR } );
	/**
	 * Keeps numeric axis ticks distinct without fitting full prose into a narrow chart margin.
	 * @param milliseconds - Nonnegative numeric axis tick.
	 * @return Compact localized duration in scale-appropriate units.
	 * @since 1.0.0 Initial implementation.
	 */
	function formatAxisDuration( milliseconds: number ): string {
		if ( milliseconds < MILLISECONDS_PER_MINUTE ) {
			return axisSeconds.format( milliseconds / MILLISECONDS_PER_SECOND );
		}
		if ( milliseconds < 60 * MILLISECONDS_PER_MINUTE ) {
			return axisMinutes.format( milliseconds / MILLISECONDS_PER_MINUTE );
		}
		return axisHours.format( milliseconds / ( 60 * MILLISECONDS_PER_MINUTE ) );
	}
	/**
	 * Formats a calendar label independently of the current timezone offset.
	 * @param date - Canonical recorded calendar date.
	 * @return Localized day and month.
	 */
	function formatDate( date: string ): string {
		return dateFormatter.format( new Date( `${ date }T12:00:00Z` ) );
	}
	/**
	 * Labels every date included in a chart interval using the active locale.
	 * @param startDate - First included calendar date.
	 * @param endDate - Last included calendar date.
	 * @return Localized inclusive date range, or a single-day label.
	 */
	function formatDateRange( startDate: string, endDate: string ): string {
		return startDate === endDate ? formatDate( startDate ) : dateFormatter.formatRange(
			new Date( `${ startDate }T12:00:00Z` ), new Date( `${ endDate }T12:00:00Z` ),
		);
	}
	/**
	 * Formats one rounded focused-pause duration.
	 * @param milliseconds - Nonnegative duration in milliseconds.
	 * @return Localized duration.
	 * @since 1.0.0 Initial implementation.
	 */
	function formatDuration( milliseconds: number ): string {
		if ( milliseconds > 0 && milliseconds < MILLISECONDS_PER_MINUTE ) {
			return i18n._( msg`Less than 1 minute` );
		}

		return formatMinuteDuration(
			i18n,
			Math.round( milliseconds / MILLISECONDS_PER_MINUTE ),
			formatters,
		);
	}

	/**
	 * Formats a reclaimed-time estimate rounded to the nearest minute.
	 * @param milliseconds - Nonnegative estimated duration in milliseconds.
	 * @return Localized zero-estimate guidance, approximation, or explicit subminute duration.
	 * @since 1.0.0 Initial implementation.
	 */
	function formatEstimatedDuration( milliseconds: number ): string {
		if ( milliseconds === 0 ) {
			return i18n._( msg`Not enough data yet` );
		}

		if ( milliseconds < MILLISECONDS_PER_MINUTE ) {
			return formatDuration( milliseconds );
		}

		const duration = formatMinuteDuration(
			i18n,
			Math.round( milliseconds / MILLISECONDS_PER_MINUTE ),
			formatters,
		);

		return i18n._( msg`Approximately ${ { duration } }` );
	}

	/**
	 * Formats one metric count.
	 * @param count - Nonnegative metric count.
	 * @return Locale-sensitive decimal count.
	 * @since 1.0.0 Initial implementation.
	 */
	function formatCount( count: number ): string {
		return formatters.number.format( count );
	}

	return Object.freeze( {
		title: i18n._( msg`Statistics` ),
		allTimeTitle: i18n._( msg`All time` ),
		currentWeekTitle: i18n._( msg`Current week` ),
		currentMonthTitle: i18n._( msg`Current month` ),
		periodLabel: i18n._( msg`Period` ),
		incompleteHistory: i18n._( msg`Some daily details are unavailable. All-time totals still include them.` ),
		estimatedReclaimedLabel: i18n._( msg`Estimated time reclaimed` ),
		focusedPauseLabel: i18n._( msg`Time you took to pause` ),
		reconsideredVisitsLabel: i18n._( msg`Reconsidered visits` ),
		completedWaitsLabel: i18n._( msg`Completed waits` ),
		allowancesGrantedLabel: i18n._( msg`Allowances granted` ),
		estimationDescription: i18n._( msg`Time spent pausing plus estimated browsing time avoided, based on your configured visit time.` ),
		dailyTitle: i18n._( msg`Activity` ),
		dailyEmpty: i18n._( msg`No activity recorded in this period.` ),
		dateLabel: i18n._( msg`Date` ),
		formatDate,
		formatDateRange,
		loading: i18n._( msg`Loading statistics...` ),
		unavailableTitle: i18n._( msg`Statistics are unavailable` ),
		unavailableDescription: i18n._(
			msg`TOCus could not read your local statistics. No estimates or totals are shown.`,
		),
		retry: i18n._( msg`Try again` ),
		localDataTitle: i18n._( msg`Local data` ),
		localDataDescription: i18n._( msg`Your statistics stay on this device.` ),
		resetAction: i18n._( msg`Reset statistics` ),
		resetConfirmationTitle: i18n._( msg`Reset statistics?` ),
		resetConfirmationDescription: i18n._(
			msg`Your statistics will start over from zero. Websites, schedules, timing, and appearance remain unchanged.`,
		),
		cancelReset: i18n._( msg`Cancel` ),
		confirmReset: i18n._( msg`Reset statistics` ),
		resetting: i18n._( msg`Resetting...` ),
		resetSuccess: i18n._( msg`Statistics were reset. Your totals now start from zero.` ),
		resetErrorTitle: i18n._( msg`Statistics could not be reset` ),
		resetErrorDescription: i18n._(
			msg`TOCus could not confirm the reset. No totals are shown until your local statistics can be read again.`,
		),
		formatEstimatedDuration,
		formatDuration,
		formatAxisDuration,
		formatCount,
	} );
}
