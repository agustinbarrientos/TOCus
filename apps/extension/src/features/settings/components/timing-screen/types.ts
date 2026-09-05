import { type CompletionAction as CompletionActionValue } from '../../../../domains/protection/types/completion-action';

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
 * Stable save failures retained by the Timing settings screen.
 * @since 0.1.0 Initial implementation.
 */
export const TimingScreenSaveErrorReason = {
	INVALID_CONFIGURATION: 'invalid-configuration',
	INVALID_TIMING_CONFIGURATION: 'invalid-timing-configuration',
	PERSISTENCE: 'persistence',
} as const;

/**
 * Save failure retained by the Timing settings screen.
 * @since 0.1.0 Initial implementation.
 */
export type TimingScreenSaveErrorReason = typeof TimingScreenSaveErrorReason[
	keyof typeof TimingScreenSaveErrorReason
];

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
