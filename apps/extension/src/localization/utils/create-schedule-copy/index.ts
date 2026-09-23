import type { I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { Weekday } from '../../../domains/protection/types/protection-schedule';
import type { ScheduleScreenCopy } from '../../../features/settings/components/schedule-screen/types';
import type { LocalizationFormatters } from '../create-localization-formatters';

/**
 * Creates localized Schedule-screen copy.
 * @param i18n - Locale-specific Lingui instance.
 * @param formatters - Locale-sensitive formatters for the bundle.
 * @return Complete localized Schedule-screen copy.
 * @since 1.0.0 Initial implementation.
 */
export function createScheduleCopy(
	i18n: I18n,
	formatters: LocalizationFormatters,
): Readonly<ScheduleScreenCopy> {
	const weekdays = Object.freeze( {
		Monday: i18n._( msg`Monday` ),
		Tuesday: i18n._( msg`Tuesday` ),
		Wednesday: i18n._( msg`Wednesday` ),
		Thursday: i18n._( msg`Thursday` ),
		Friday: i18n._( msg`Friday` ),
		Saturday: i18n._( msg`Saturday` ),
		Sunday: i18n._( msg`Sunday` ),
	} );

	/**
	 * Resolves one stable domain weekday to its localized label.
	 * @param weekday - Stable weekday domain value.
	 * @return Localized weekday label.
	 * @since 1.0.0 Initial implementation.
	 */
	function formatWeekday( weekday: Weekday ): string {
		return weekdays[ weekday ];
	}

	/**
	 * Formats one accessible time-window group label.
	 * @param position - One-based visual position.
	 * @return Complete localized group label.
	 * @since 1.0.0 Initial implementation.
	 */
	function formatWindowLabel( position: number ): string {
		const formattedPosition = formatters.number.format( position );

		return i18n._( msg`Time window ${ { position: formattedPosition } }` );
	}

	/**
	 * Formats one contextual remove-window action.
	 * @param position - One-based visual position.
	 * @return Complete localized action label.
	 * @since 1.0.0 Initial implementation.
	 */
	function formatRemoveWindowLabel( position: number ): string {
		const formattedPosition = formatters.number.format( position );

		return i18n._( msg`Remove time window ${ { position: formattedPosition } }` );
	}

	return Object.freeze( {
		title: i18n._( msg`Schedule` ),
		formatWeekday,
		formatWindowLabel,
		formatRemoveWindowLabel,
		scheduleLegend: i18n._( msg`When should TOCus be active?` ),
		alwaysLabel: i18n._( msg`All the time` ),
		alwaysDescription: i18n._( msg`Keep TOCus active every day and at every time.` ),
		customLabel: i18n._( msg`On a weekly schedule` ),
		customDescription: i18n._( msg`Choose the days and times when TOCus should be active.` ),
		windowsLegend: i18n._( msg`Active time windows` ),
		weekdayLabel: i18n._( msg`Day` ),
		startTimeLabel: i18n._( msg( {
			comment: 'Label for the start-time field of a scheduled protection window.',
			message: 'Start',
		} ) ),
		endTimeLabel: i18n._( msg( {
			comment: 'Label for the end-time field of a scheduled protection window.',
			message: 'End',
		} ) ),
		removeWindow: i18n._( msg`Remove window` ),
		addWindow: i18n._( msg`Add row` ),
		presetWeekdaysWorkingHours: i18n._( msg`Mon - Fri, 9 AM - 5 PM` ),
		presetWeekdaysAllDay: i18n._( msg`Mon - Fri, all day` ),
		presetWeekendsAllDay: i18n._( msg`Sat - Sun, all day` ),
		clearWindows: i18n._( msg`Clear all` ),
		clearWindowsTitle: i18n._( msg`Clear all schedule rows?` ),
		clearWindowsDescription: i18n._( msg`This clears the rows you're editing. Your saved schedule stays unchanged until you save.` ),
		cancelClearWindows: i18n._( msg`Cancel` ),
		emptyWindowsMessage: i18n._( msg`Add a row or choose a preset before saving.` ),
		allDayLabel: i18n._( msg`All day` ),
		startTimeRequiredError: i18n._( msg`Choose a start time.` ),
		endTimeRequiredError: i18n._( msg`Choose an end time.` ),
		equalTimeError: i18n._( msg`Start and end time must be different.` ),
		discard: i18n._( msg`Discard` ),
		save: i18n._( msg`Save` ),
		saving: i18n._( msg`Saving...` ),
		loading: i18n._( msg`Loading schedule...` ),
		malformedDataTitle: i18n._( msg`Your local settings need attention` ),
		malformedDataDescription: i18n._( msg`TOCus found local settings it couldn't read. They weren't replaced.` ),
		loadErrorTitle: i18n._( msg`Schedule couldn't load` ),
		loadErrorDescription: i18n._( msg`Your local settings weren't changed. Try loading them again.` ),
		retry: i18n._( msg`Try again` ),
		saveError: i18n._( msg`The schedule couldn't be saved. Your settings weren't changed.` ),
		invalidConfigurationError: i18n._( msg`The local configuration couldn't be updated safely.` ),
		invalidScheduleError: i18n._( msg`Check the schedule and try again.` ),
		scopeNotFoundError: i18n._( msg`This timing group is no longer available. Reload the page and try again.` ),
	} );
}
