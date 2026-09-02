import {
	CompletionAction,
	type CompletionAction as CompletionActionValue,
} from '../../../../domains/protection/types/completion-action';

/**
 * Stable loading states rendered by the Timing settings screen.
 * @since 0.1.0 Initial implementation.
 */
export const TimingScreenLoadStatus = {
	FAILED: 'failed',
	LOADING: 'loading',
	MALFORMED: 'malformed',
	READY: 'ready',
} as const;

/**
 * Current loading state rendered by the Timing settings screen.
 * @since 0.1.0 Initial implementation.
 */
export type TimingScreenLoadStatus =
	typeof TimingScreenLoadStatus[ keyof typeof TimingScreenLoadStatus ];

/**
 * Timing form event whose current target is the rendered global form.
 * @since 0.1.0 Initial implementation.
 */
export interface TimingFormEvent extends Event {
	readonly currentTarget: HTMLFormElement;
}

/**
 * Localizable messages rendered by the Timing settings screen.
 * @since 0.1.0 Initial implementation.
 */
export interface TimingScreenCopy {
	eyebrow: string;
	title: string;
	introduction: string;
	formLabel: string;
	initialWaitLabel: string;
	initialWaitHelp: string;
	waitIncreaseLabel: string;
	waitIncreaseHelp: string;
	maximumWaitLabel: string;
	maximumWaitHelp: string;
	maximumWaitError: string;
	allowanceLabel: string;
	allowanceHelp: string;
	completionActionLegend: string;
	showContinueLabel: string;
	showContinueDescription: string;
	openAutomaticallyLabel: string;
	openAutomaticallyDescription: string;
	summaryTitle: string;
	loading: string;
	malformedDataTitle: string;
	malformedDataDescription: string;
	loadErrorTitle: string;
	loadErrorDescription: string;
	retry: string;
	saveTiming: string;
	savingTiming: string;
	saveError: string;
	invalidConfigurationError: string;
	invalidTimingConfigurationError: string;
	savedAnnouncement: string;
	/**
	 * Formats one whole-second native option.
	 * @param seconds - Allowed whole-second duration.
	 * @return Human-readable second duration.
	 * @since 0.1.0 Initial implementation.
	 */
	formatSecondsOption( seconds: number ): string;
	/**
	 * Formats one whole-minute native option.
	 * @param minutes - Allowed whole-minute duration.
	 * @return Human-readable minute duration.
	 * @since 0.1.0 Initial implementation.
	 */
	formatMinutesOption( minutes: number ): string;
	/**
	 * Formats the plain-language summary for one timing draft.
	 * @param initialWaitSeconds - Draft initial wait in whole seconds.
	 * @param waitIncreaseSeconds - Draft daily increase in whole seconds.
	 * @param maximumWaitSeconds - Draft maximum wait in whole seconds.
	 * @param allowanceMinutes - Draft allowance in whole minutes.
	 * @param completionAction - Draft post-wait action.
	 * @return Human-readable global timing summary.
	 * @since 0.1.0 Initial implementation.
	 */
	formatSummary(
		initialWaitSeconds: number,
		waitIncreaseSeconds: number,
		maximumWaitSeconds: number,
		allowanceMinutes: number,
		completionAction: CompletionActionValue,
	): string;
}

/**
 * Formats the default whole-second native option.
 * @param seconds - Allowed whole-second duration.
 * @return Human-readable second duration.
 * @since 0.1.0 Initial implementation.
 */
function formatSecondsOption( seconds: number ): string {
	return `${ String( seconds ) } seconds`;
}

/**
 * Formats the default whole-minute native option.
 * @param minutes - Allowed whole-minute duration.
 * @return Human-readable minute duration.
 * @since 0.1.0 Initial implementation.
 */
function formatMinutesOption( minutes: number ): string {
	return minutes === 1 ? '1 minute' : `${ String( minutes ) } minutes`;
}

/**
 * Formats the default plain-language summary for one timing draft.
 * @param initialWaitSeconds - Draft initial wait in whole seconds.
 * @param waitIncreaseSeconds - Draft daily increase in whole seconds.
 * @param maximumWaitSeconds - Draft maximum wait in whole seconds.
 * @param allowanceMinutes - Draft allowance in whole minutes.
 * @param completionAction - Draft post-wait action.
 * @return Human-readable global timing summary.
 * @since 0.1.0 Initial implementation.
 */
function formatSummary(
	initialWaitSeconds: number,
	waitIncreaseSeconds: number,
	maximumWaitSeconds: number,
	allowanceMinutes: number,
	completionAction: CompletionActionValue,
): string {
	const completionSummary = completionAction === CompletionAction.OPEN_AUTOMATICALLY
		? 'opens the site automatically'
		: 'shows a Continue button';

	return `Waits start at ${ formatSecondsOption( initialWaitSeconds ) }. Each completed wait adds ${
		formatSecondsOption( waitIncreaseSeconds )
	} to the next wait, up to ${ formatSecondsOption( maximumWaitSeconds ) }. Completing a wait starts an allowance for ${
		formatMinutesOption( allowanceMinutes )
	} and ${ completionSummary }.`;
}

/**
 * Default English messages for the Timing settings screen.
 * @since 0.1.0 Initial implementation.
 */
export const DefaultTimingScreenCopy: Readonly<TimingScreenCopy> = Object.freeze( {
	eyebrow: 'Protection',
	title: 'Timing',
	introduction: 'Set one calm timing pattern for every protected site.',
	formLabel: 'Global timing',
	initialWaitLabel: 'Initial wait',
	initialWaitHelp: 'The first interruption of the day starts with this wait.',
	waitIncreaseLabel: 'Wait increase',
	waitIncreaseHelp: 'Each completed wait adds this amount to the next wait that day.',
	maximumWaitLabel: 'Maximum wait',
	maximumWaitHelp: 'Choose a maximum that is at least as long as the initial wait.',
	maximumWaitError: 'Maximum wait must be at least as long as the initial wait.',
	allowanceLabel: 'Allowance',
	allowanceHelp: 'Completing a wait pauses protection for this long.',
	completionActionLegend: 'When the wait finishes',
	showContinueLabel: 'Show a Continue button',
	showContinueDescription: 'Wait for an explicit choice before opening the site.',
	openAutomaticallyLabel: 'Open the site automatically',
	openAutomaticallyDescription: 'Open the requested site as soon as the wait ends.',
	summaryTitle: 'Timing summary',
	loading: 'Loading timing settings...',
	malformedDataTitle: 'Timing settings need your attention',
	malformedDataDescription: 'Your local timing data is not valid, so it was not replaced.',
	loadErrorTitle: 'Timing settings could not load',
	loadErrorDescription: 'TOCus could not load local timing settings. Nothing was changed.',
	retry: 'Try again',
	saveTiming: 'Save timing',
	savingTiming: 'Saving...',
	saveError: 'Timing settings could not be saved. Your choices are still here.',
	invalidConfigurationError: 'Your timing data changed. Retry before saving these choices.',
	invalidTimingConfigurationError: 'These timing choices are not valid. Review them before saving.',
	savedAnnouncement: 'Timing settings were saved.',
	formatSecondsOption,
	formatMinutesOption,
	formatSummary,
} );
