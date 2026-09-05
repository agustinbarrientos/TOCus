import { type I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import {
	CompletionAction,
	type CompletionAction as CompletionActionValue,
} from '../../../domains/protection/types/completion-action';
import { type TimingScreenCopy } from '../../../features/settings/components/timing-screen/types';
import {
	DurationUnit,
	formatDurationUnit,
} from '../format-localized-duration';

/**
 * Creates localized Timing-screen copy.
 * @param i18n - Locale-specific Lingui instance.
 * @return Complete localized Timing-screen copy.
 * @since 0.1.0 Initial implementation.
 */
export function createTimingCopy( i18n: I18n ): Readonly<TimingScreenCopy> {
	/**
	 * Formats one whole-second option.
	 * @param seconds - Allowed whole seconds.
	 * @return Localized duration option.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatSecondsOption( seconds: number ): string {
		return formatDurationUnit( i18n, seconds, DurationUnit.SECOND );
	}

	/**
	 * Formats one whole-minute option.
	 * @param minutes - Allowed whole minutes.
	 * @return Localized duration option.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatMinutesOption( minutes: number ): string {
		return formatDurationUnit( i18n, minutes, DurationUnit.MINUTE );
	}

	/**
	 * Formats the complete timing summary for one draft.
	 * @param initialWaitSeconds - Draft initial wait.
	 * @param waitIncreaseSeconds - Draft daily increase.
	 * @param maximumWaitSeconds - Draft maximum wait.
	 * @param allowanceMinutes - Draft allowance.
	 * @param completionAction - Draft post-wait action.
	 * @return Complete localized timing summary.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatSummary(
		initialWaitSeconds: number,
		waitIncreaseSeconds: number,
		maximumWaitSeconds: number,
		allowanceMinutes: number,
		completionAction: CompletionActionValue,
	): string {
		const initialWait = formatSecondsOption( initialWaitSeconds );
		const waitIncrease = formatSecondsOption( waitIncreaseSeconds );
		const maximumWait = formatSecondsOption( maximumWaitSeconds );
		const allowance = formatMinutesOption( allowanceMinutes );

		return completionAction === CompletionAction.OPEN_AUTOMATICALLY
			? i18n._(
				msg`Waits start at ${ { initialWait } }. Each completed wait adds ${ { waitIncrease } } to the next wait, up to ${ { maximumWait } }. Completing a wait starts an allowance for ${ { allowance } } and opens the site automatically.`,
			)
			: i18n._(
				msg`Waits start at ${ { initialWait } }. Each completed wait adds ${ { waitIncrease } } to the next wait, up to ${ { maximumWait } }. Completing a wait starts an allowance for ${ { allowance } } and shows a Continue button.`,
			);
	}

	return Object.freeze( {
		eyebrow: i18n._( msg`Pause setup` ),
		title: i18n._( msg`Timing` ),
		introduction: i18n._( msg`Set one calm timing pattern for every website on your list.` ),
		formLabel: i18n._( msg`Global timing` ),
		initialWaitLabel: i18n._( msg`Initial wait` ),
		initialWaitHelp: i18n._( msg`The first interruption of the day starts with this wait.` ),
		waitIncreaseLabel: i18n._( msg`Wait increase` ),
		waitIncreaseHelp: i18n._( msg`Each completed wait adds this amount to the next wait that day.` ),
		maximumWaitLabel: i18n._( msg`Maximum wait` ),
		maximumWaitHelp: i18n._( msg`Choose a maximum that is at least as long as the initial wait.` ),
		maximumWaitError: i18n._( msg`Maximum wait must be at least as long as the initial wait.` ),
		allowanceLabel: i18n._( msg`Allowance` ),
		allowanceHelp: i18n._( msg`Completing a wait keeps your websites available for this long.` ),
		completionActionLegend: i18n._( msg`When the wait finishes` ),
		showContinueLabel: i18n._( msg`Show a Continue button` ),
		showContinueDescription: i18n._( msg`Wait for an explicit choice before opening the site.` ),
		openAutomaticallyLabel: i18n._( msg`Open the site automatically` ),
		openAutomaticallyDescription: i18n._( msg`Open the requested site as soon as the wait ends.` ),
		summaryTitle: i18n._( msg`Timing summary` ),
		loading: i18n._( msg`Loading timing settings...` ),
		malformedDataTitle: i18n._( msg`Timing settings need your attention` ),
		malformedDataDescription: i18n._( msg`Your local timing data is not valid, so it was not replaced.` ),
		loadErrorTitle: i18n._( msg`Timing settings could not load` ),
		loadErrorDescription: i18n._( msg`TOCus could not load local timing settings. Nothing was changed.` ),
		retry: i18n._( msg`Try again` ),
		saveTiming: i18n._( msg`Save timing` ),
		savingTiming: i18n._( msg`Saving...` ),
		saveError: i18n._( msg`Timing settings could not be saved. Your choices are still here.` ),
		invalidConfigurationError: i18n._( msg`Your timing data changed. Retry before saving these choices.` ),
		invalidTimingConfigurationError: i18n._(
			msg`These timing choices are not valid. Review them before saving.`,
		),
		savedAnnouncement: i18n._( msg`Timing settings were saved.` ),
		formatSecondsOption,
		formatMinutesOption,
		formatSummary,
	} );
}
