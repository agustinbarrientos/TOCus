import { type I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { type StatisticsSettingsScreenCopy } from '../../../features/statistics/components/settings-screen/types';
import { type LocalizationFormatters } from '../create-localization-formatters';
import {
	formatMinuteDuration,
	MILLISECONDS_PER_MINUTE,
} from '../format-localized-duration';

/**
 * Creates localized Statistics-screen copy.
 * @param i18n - Locale-specific Lingui instance.
 * @param formatters - Locale-sensitive formatters for the bundle.
 * @return Complete localized Statistics-screen copy.
 * @since 0.1.0 Initial implementation.
 */
export function createStatisticsCopy(
	i18n: I18n,
	formatters: LocalizationFormatters,
): Readonly<StatisticsSettingsScreenCopy> {
	/**
	 * Formats one rounded focused-pause duration.
	 * @param milliseconds - Nonnegative duration in milliseconds.
	 * @return Localized duration.
	 * @since 0.1.0 Initial implementation.
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
	 * Formats one approximate reclaimed-time duration.
	 * @param milliseconds - Nonnegative estimated duration in milliseconds.
	 * @return Localized approximate duration.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatEstimatedDuration( milliseconds: number ): string {
		const duration = formatDuration( milliseconds );

		return milliseconds > 0 && milliseconds < MILLISECONDS_PER_MINUTE
			? duration
			: i18n._( msg`About ${ { duration } }` );
	}

	/**
	 * Formats one metric count.
	 * @param count - Nonnegative metric count.
	 * @return Locale-sensitive decimal count.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatCount( count: number ): string {
		return formatters.number.format( count );
	}

	return Object.freeze( {
		eyebrow: i18n._( msg`Wellbeing` ),
		title: i18n._( msg`Statistics` ),
		introduction: i18n._(
			msg`A private, all-time view of the pauses and choices TOCus has supported on this device.`,
		),
		allTimeTitle: i18n._( msg`All time` ),
		estimatedReclaimedLabel: i18n._( msg`Estimated time reclaimed` ),
		focusedPauseLabel: i18n._( msg`Time you took to pause` ),
		reconsideredVisitsLabel: i18n._( msg`Reconsidered visits` ),
		completedWaitsLabel: i18n._( msg`Completed waits` ),
		allowancesGrantedLabel: i18n._( msg`Allowances granted` ),
		estimationDescription: i18n._( msg`Estimated browsing time avoided on your selected websites, based on your prior focused use.` ),
		notEnoughHistory: i18n._( msg`Not enough history yet` ),
		emptyMessage: i18n._( msg`This is a moment just for you.` ),
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
		formatCount,
	} );
}
