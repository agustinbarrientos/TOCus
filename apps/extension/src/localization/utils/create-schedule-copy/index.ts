import { type I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { type Weekday } from '../../../domains/protection/types/protection-schedule';
import { type ScheduleScreenCopy } from '../../../features/settings/components/schedule-screen/types';
import { type LocalizationFormatters } from '../create-localization-formatters';

/**
 * Creates localized Schedule-screen copy.
 * @param i18n - Locale-specific Lingui instance.
 * @param formatters - Locale-sensitive formatters for the bundle.
 * @return Complete localized Schedule-screen copy.
 * @since 0.1.0 Initial implementation.
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
	 * Formats one independent protection scope.
	 * @param name - Resolved local site name.
	 * @param domain - Exact configured domain.
	 * @return Complete localized scope label.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatIndependentScopeLabel( name: string, domain: string ): string {
		return i18n._( msg`${ { name } } (${ { domain } })` );
	}

	/**
	 * Resolves one stable domain weekday to its localized label.
	 * @param weekday - Stable weekday domain value.
	 * @return Localized weekday label.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatWeekday( weekday: Weekday ): string {
		return weekdays[ weekday ];
	}

	/**
	 * Formats one accessible time-window group label.
	 * @param position - One-based visual position.
	 * @return Complete localized group label.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatWindowLabel( position: number ): string {
		const formattedPosition = formatters.number.format( position );

		return i18n._( msg`Time window ${ { position: formattedPosition } }` );
	}

	/**
	 * Formats one contextual remove-window action.
	 * @param position - One-based visual position.
	 * @return Complete localized action label.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatRemoveWindowLabel( position: number ): string {
		const formattedPosition = formatters.number.format( position );

		return i18n._( msg`Remove time window ${ { position: formattedPosition } }` );
	}

	/**
	 * Compares two scope names using the selected language.
	 * @param firstName - First scope name.
	 * @param secondName - Second scope name.
	 * @return Locale-sensitive collation result.
	 * @since 0.1.0 Initial implementation.
	 */
	function compareNames( firstName: string, secondName: string ): number {
		return formatters.collator.compare( firstName, secondName );
	}

	return Object.freeze( {
		eyebrow: i18n._( msg`Pause setup` ),
		title: i18n._( msg`Schedule` ),
		introduction: i18n._( msg`Choose when TOCus is active. Times use this device's current time zone.` ),
		appliesToLabel: i18n._( msg`Applies to` ),
		sharedScope: i18n._( msg`Shared timing` ),
		formatIndependentScopeLabel,
		compareNames,
		formatWeekday,
		formatWindowLabel,
		formatRemoveWindowLabel,
		scheduleLegend: i18n._( msg`When should TOCus be active?` ),
		alwaysLabel: i18n._( msg`All the time` ),
		alwaysDescription: i18n._( msg`Keep TOCus active every day and at every time.` ),
		customLabel: i18n._( msg`On a weekly schedule` ),
		customDescription: i18n._( msg`Choose the days and times when TOCus should be active.` ),
		windowsLegend: i18n._( msg`Active time windows` ),
		windowsHelp: i18n._( msg`An end time earlier than its start continues into the next day.` ),
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
		addWindow: i18n._( msg`Add time window` ),
		startTimeRequiredError: i18n._( msg`Choose a start time.` ),
		endTimeRequiredError: i18n._( msg`Choose an end time.` ),
		equalTimeError: i18n._( msg`Start and end time must be different.` ),
		dirtyScopeNotice: i18n._( msg`Save or discard these changes before choosing another scope.` ),
		discard: i18n._( msg`Discard changes` ),
		save: i18n._( msg`Save schedule` ),
		saving: i18n._( msg`Saving...` ),
		loading: i18n._( msg`Loading schedule...` ),
		malformedDataTitle: i18n._( msg`Your local settings need attention` ),
		malformedDataDescription: i18n._( msg`TOCus found local settings it could not read. They were not replaced.` ),
		loadErrorTitle: i18n._( msg`Schedule could not load` ),
		loadErrorDescription: i18n._( msg`Your local settings were not changed. Try loading them again.` ),
		retry: i18n._( msg`Try again` ),
		saveError: i18n._( msg`The schedule could not be saved. Your settings were not changed.` ),
		invalidConfigurationError: i18n._( msg`The local configuration could not be updated safely.` ),
		invalidScheduleError: i18n._( msg`Check the schedule and try again.` ),
		scopeNotFoundError: i18n._( msg`This timing group is no longer available. Reload the page and try again.` ),
		savedAnnouncement: i18n._( msg`Schedule saved.` ),
	} );
}
