import type { I18n } from '@lingui/core';
import { msg, plural } from '@lingui/core/macro';
import type { StatisticsSettingsScreenCopy } from '../../../features/statistics/components/settings-screen/types';
import { StatisticsChangeDirection, type StatisticsChange } from '../../../features/statistics/utils/calculate-statistics-change/types';
import { StatisticsRange } from '../../../features/statistics/utils/select-statistics-range/types';
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
	const hourFormatter = new Intl.DateTimeFormat( i18n.locale, {
		hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC',
	} );
	const axisOptions: Intl.NumberFormatOptions = {
		style: 'unit', unitDisplay: 'narrow', maximumSignificantDigits: 3, notation: 'compact',
	};
	const axisSeconds = new Intl.NumberFormat( i18n.locale, { ...axisOptions, unit: DurationUnit.SECOND } );
	const axisMinutes = new Intl.NumberFormat( i18n.locale, { ...axisOptions, unit: DurationUnit.MINUTE } );
	const axisHours = new Intl.NumberFormat( i18n.locale, { ...axisOptions, unit: DurationUnit.HOUR } );
	const percentFormatter = new Intl.NumberFormat( i18n.locale, { style: 'percent', maximumFractionDigits: 3 } );
	/**
	 * Keeps each trend phrase independently translatable for its period and direction.
	 * @param change - Finite count change, with null percentages using the absolute difference.
	 * @param range - Selected calendar period.
	 * @return Localized trend, or no text for an all-time period without a comparison.
	 * @since 1.1.0
	 */
	function formatTrend( change: StatisticsChange, range: StatisticsRange ): string {
		const count = change.difference;
		const percentage = change.percentage === null ? '' : percentFormatter.format( change.percentage / 100 );
		switch ( range ) {
			case StatisticsRange.CURRENT_WEEK:
				if ( change.direction === StatisticsChangeDirection.SAME ) {
					return i18n._( msg`Same as last week` );
				}
				if ( change.percentage !== null ) {
					return change.direction === StatisticsChangeDirection.UP
						? i18n._( msg`${ percentage } more than last week` )
						: i18n._( msg`${ percentage } fewer than last week` );
				}
				return change.direction === StatisticsChangeDirection.UP
					? i18n._( msg( { message: plural( { count }, {
						one: '# more than last week', other: '# more than last week',
					} ) } ) )
					: i18n._( msg( { message: plural( { count }, {
						one: '# fewer than last week', other: '# fewer than last week',
					} ) } ) );
			case StatisticsRange.CURRENT_MONTH:
				if ( change.direction === StatisticsChangeDirection.SAME ) {
					return i18n._( msg`Same as last month` );
				}
				if ( change.percentage !== null ) {
					return change.direction === StatisticsChangeDirection.UP
						? i18n._( msg`${ percentage } more than last month` )
						: i18n._( msg`${ percentage } fewer than last month` );
				}
				return change.direction === StatisticsChangeDirection.UP
					? i18n._( msg( { message: plural( { count }, {
						one: '# more than last month', other: '# more than last month',
					} ) } ) )
					: i18n._( msg( { message: plural( { count }, {
						one: '# fewer than last month', other: '# fewer than last month',
					} ) } ) );
			case StatisticsRange.CURRENT_YEAR:
				if ( change.direction === StatisticsChangeDirection.SAME ) {
					return i18n._( msg`Same as last year` );
				}
				if ( change.percentage !== null ) {
					return change.direction === StatisticsChangeDirection.UP
						? i18n._( msg`${ percentage } more than last year` )
						: i18n._( msg`${ percentage } fewer than last year` );
				}
				return change.direction === StatisticsChangeDirection.UP
					? i18n._( msg( { message: plural( { count }, {
						one: '# more than last year', other: '# more than last year',
					} ) } ) )
					: i18n._( msg( { message: plural( { count }, {
						one: '# fewer than last year', other: '# fewer than last year',
					} ) } ) );
			case StatisticsRange.ALL_TIME:
				return '';
		}
	}
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
	 * Labels an aggregate local hour without shifting it into the viewer's timezone.
	 * @param hour - Recorded hour from zero through twenty-three.
	 * @return Localized hour label.
	 */
	function formatHour( hour: number ): string {
		return hourFormatter.format( new Date( Date.UTC( 2026, 0, 1, hour ) ) );
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
		currentYearTitle: i18n._( msg`Current year` ),
		periodLabel: i18n._( msg`Period` ),
		comparePreviousLabel: i18n._( msg`Compare with previous period` ),
		comparisonDetail: i18n._( msg`vs previous period` ),
		currentPeriodLabel: i18n._( msg`This period` ),
		previousPeriodLabel: i18n._( msg`Previous period` ),
		incompleteHistory: i18n._( msg`Some daily details are unavailable. All-time totals still include them.` ),
		estimatedReclaimedLabel: i18n._( msg`Estimated time reclaimed` ),
		focusedPauseLabel: i18n._( msg`Time you took to pause` ),
		reconsideredVisitsLabel: i18n._( msg`Reconsidered visits` ),
		completedWaitsLabel: i18n._( msg`Completed pauses` ),
		allowancesGrantedLabel: i18n._( msg`Allowances granted` ),
		estimationDescription: i18n._( msg`Time spent pausing plus estimated browsing time avoided.` ),
		estimationHelpLabel: i18n._( msg`How estimated time reclaimed is calculated` ),
		dailyTitle: i18n._( msg`Daily activity` ),
		dailyMetricLabel: i18n._( msg`Daily activity metric` ),
		dailyEmpty: i18n._( msg`No activity in this period` ),
		dailyEmptyDescription: i18n._( msg`Your pauses and reconsidered visits will appear here.` ),
		dateLabel: i18n._( msg`Date` ),
		visitOutcomesTitle: i18n._( msg`Visit outcomes` ),
		visitOutcomesHelpLabel: i18n._( msg`About visit outcomes` ),
		visitOutcomesDescription: i18n._( msg`Reconsidered visits end before the pause finishes. Visits after a pause count when you wait and continue to the website.` ),
		websiteOutcomesTitle: i18n._( msg`By website` ),
		allWebsitesTitle: i18n._( msg`All websites` ),
		allWebsitesLabel: i18n._( msg`Visit outcomes across all websites` ),
		visitOutcomesLegendLabel: i18n._( msg`Visit outcome key` ),
		reconsideredOutcomeLabel: i18n._( msg`Reconsidered` ),
		visitedAfterPauseLabel: i18n._( msg`Visited after pause` ),
		hourlyTitle: i18n._( msg`Reconsidered visits by hour` ),
		hourLabel: i18n._( msg`Hour` ),
		noRecordedOutcomes: i18n._( msg`No recorded outcomes` ),
		noVisitOutcomes: i18n._( msg`No visit outcomes recorded in this period.` ),
		noReconsideredVisits: i18n._( msg`No reconsidered visits recorded in this period.` ),
		breakdownsUnavailable: i18n._( msg`Website and hourly breakdowns will appear as new visits are recorded.` ),
		formatHour,
		formatDate,
		formatDateRange,
		formatTrend,
		loading: i18n._( msg`Loading statistics...` ),
		unavailableTitle: i18n._( msg`Statistics are unavailable` ),
		unavailableDescription: i18n._(
			msg`TOCus couldn't read your local statistics. No estimates or totals are shown.`,
		),
		retry: i18n._( msg`Try again` ),
		localDataTitle: i18n._( msg`Reset statistics` ),
		localDataDescription: i18n._( msg`Clear your recorded counts and time totals. Your websites and settings stay the same.` ),
		resetAction: i18n._( msg`Reset statistics` ),
		resetConfirmationTitle: i18n._( msg`Reset statistics?` ),
		resetConfirmationDescription: i18n._(
			msg`All recorded statistics will be deleted. This can't be undone.`,
		),
		cancelReset: i18n._( msg`Cancel` ),
		confirmReset: i18n._( msg`Reset statistics` ),
		resetting: i18n._( msg`Resetting...` ),
		resetSuccess: i18n._( msg`Statistics were reset. Your totals now start from zero.` ),
		resetErrorTitle: i18n._( msg`Statistics couldn't be reset` ),
		resetErrorDescription: i18n._(
			msg`TOCus couldn't confirm the reset. No totals are shown until your local statistics can be read again.`,
		),
		formatEstimatedDuration,
		formatDuration,
		formatAxisDuration,
		formatCount,
	} );
}
