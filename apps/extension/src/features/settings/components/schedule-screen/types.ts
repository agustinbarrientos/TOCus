import { type ProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import { type Weekday } from '../../../../domains/protection/types/protection-schedule';

/**
 * Stable local-configuration loading states for the Schedule screen.
 * @since 0.1.0 Initial implementation.
 */
export const ScheduleScreenLoadStatus = {
	FAILED: 'failed',
	LOADING: 'loading',
	MALFORMED: 'malformed',
	READY: 'ready',
} as const;

/**
 * Local-configuration loading state for the Schedule screen.
 * @since 0.1.0 Initial implementation.
 */
export type ScheduleScreenLoadStatus = typeof ScheduleScreenLoadStatus[ keyof typeof ScheduleScreenLoadStatus ];

/**
 * Editable weekly time-window presentation.
 * @since 0.1.0 Initial implementation.
 */
export interface ScheduleWindowDraft {
	id: number;
	weekday: Weekday;
	startTime: string;
	endTime: string;
	spansFullDay: boolean;
}

/**
 * Validation messages associated with one editable time window.
 * @since 0.1.0 Initial implementation.
 */
export interface ScheduleWindowDraftErrors {
	startTime: string;
	endTime: string;
}

/**
 * One protection scope presented in the settings selector.
 * @since 0.1.0 Initial implementation.
 */
export interface PresentedScheduleScope {
	id: ProtectionScopeId;
	label: string;
}

/**
 * Native Schedule selector event whose current target is the bound select.
 * @since 0.1.0 Initial implementation.
 */
export interface ScheduleSelectChangeEvent extends Event {
	readonly currentTarget: HTMLSelectElement;
}

/**
 * Native Schedule input event whose current target is the bound input.
 * @since 0.1.0 Initial implementation.
 */
export interface ScheduleInputEvent extends Event {
	readonly currentTarget: HTMLInputElement;
}

/**
 * Native Schedule action event whose current target is the bound button.
 * @since 0.1.0 Initial implementation.
 */
export interface ScheduleButtonEvent extends Event {
	readonly currentTarget: HTMLButtonElement;
}

/**
 * Localizable messages rendered by the Schedule screen.
 * @since 0.1.0 Initial implementation.
 */
export interface ScheduleScreenCopy {
	eyebrow: string;
	title: string;
	introduction: string;
	appliesToLabel: string;
	sharedScope: string;
	/**
	 * Formats one independent protection scope for the native selector.
	 * @param name - Resolved local site name.
	 * @param domain - Exact configured site identity.
	 * @return Readable selector label.
	 * @since 0.1.0 Initial implementation.
	 */
	formatIndependentScopeLabel( name: string, domain: string ): string;
	/**
	 * Formats one weekday for native schedule options.
	 * @param weekday - Domain weekday to present.
	 * @return Localized weekday label.
	 * @since 0.1.0 Initial implementation.
	 */
	formatWeekday( weekday: Weekday ): string;
	/**
	 * Formats one accessible time-window group label.
	 * @param position - One-based visual window position.
	 * @return Localized time-window group label.
	 * @since 0.1.0 Initial implementation.
	 */
	formatWindowLabel( position: number ): string;
	/**
	 * Formats one contextual remove-window action label.
	 * @param position - One-based visual window position.
	 * @return Localized remove-window action label.
	 * @since 0.1.0 Initial implementation.
	 */
	formatRemoveWindowLabel( position: number ): string;
	scheduleLegend: string;
	alwaysLabel: string;
	alwaysDescription: string;
	customLabel: string;
	customDescription: string;
	windowsLegend: string;
	windowsHelp: string;
	weekdayLabel: string;
	startTimeLabel: string;
	endTimeLabel: string;
	removeWindow: string;
	addWindow: string;
	startTimeRequiredError: string;
	endTimeRequiredError: string;
	equalTimeError: string;
	dirtyScopeNotice: string;
	discard: string;
	save: string;
	saving: string;
	loading: string;
	malformedDataTitle: string;
	malformedDataDescription: string;
	loadErrorTitle: string;
	loadErrorDescription: string;
	retry: string;
	saveError: string;
	invalidConfigurationError: string;
	invalidScheduleError: string;
	scopeNotFoundError: string;
	savedAnnouncement: string;
}

/**
 * Formats one independent-scope selector label.
 * @param name - Resolved local site name.
 * @param domain - Exact configured site identity.
 * @return Readable selector label.
 * @since 0.1.0 Initial implementation.
 */
function formatIndependentScopeLabel( name: string, domain: string ): string {
	return `${ name } (${ domain })`;
}

/**
 * Formats one default English weekday label.
 * @param weekday - Domain weekday to present.
 * @return English weekday label.
 * @since 0.1.0 Initial implementation.
 */
function formatWeekday( weekday: Weekday ): string {
	return weekday;
}

/**
 * Formats one default English time-window group label.
 * @param position - One-based visual window position.
 * @return English time-window group label.
 * @since 0.1.0 Initial implementation.
 */
function formatWindowLabel( position: number ): string {
	return `Time window ${ String( position ) }`;
}

/**
 * Formats one default English remove-window action label.
 * @param position - One-based visual window position.
 * @return English remove-window action label.
 * @since 0.1.0 Initial implementation.
 */
function formatRemoveWindowLabel( position: number ): string {
	return `Remove time window ${ String( position ) }`;
}

/**
 * Default English Schedule screen messages.
 * @since 0.1.0 Initial implementation.
 */
export const DefaultScheduleScreenCopy: Readonly<ScheduleScreenCopy> = Object.freeze( {
	eyebrow: 'Protection',
	title: 'Schedule',
	introduction: 'Choose when protection is active. Times use this device’s current time zone.',
	appliesToLabel: 'Applies to',
	sharedScope: 'Shared protection',
	formatIndependentScopeLabel,
	formatWeekday,
	formatWindowLabel,
	formatRemoveWindowLabel,
	scheduleLegend: 'When should protection be active?',
	alwaysLabel: 'All the time',
	alwaysDescription: 'Keep protection active every day and at every time.',
	customLabel: 'On a weekly schedule',
	customDescription: 'Choose the days and times when protection should be active.',
	windowsLegend: 'Active time windows',
	windowsHelp: 'An end time earlier than its start continues into the next day.',
	weekdayLabel: 'Day',
	startTimeLabel: 'Start',
	endTimeLabel: 'End',
	removeWindow: 'Remove window',
	addWindow: 'Add time window',
	startTimeRequiredError: 'Choose a start time.',
	endTimeRequiredError: 'Choose an end time.',
	equalTimeError: 'Start and end time must be different.',
	dirtyScopeNotice: 'Save or discard these changes before choosing another scope.',
	discard: 'Discard changes',
	save: 'Save schedule',
	saving: 'Saving...',
	loading: 'Loading schedule...',
	malformedDataTitle: 'Your local settings need attention',
	malformedDataDescription: 'TOCus found local settings it could not read. They were not replaced.',
	loadErrorTitle: 'Schedule could not load',
	loadErrorDescription: 'Your local settings were not changed. Try loading them again.',
	retry: 'Try again',
	saveError: 'The schedule could not be saved. Your settings were not changed.',
	invalidConfigurationError: 'The local configuration could not be updated safely.',
	invalidScheduleError: 'Check the schedule and try again.',
	scopeNotFoundError: 'This protection scope is no longer available. Reload the page and try again.',
	savedAnnouncement: 'Schedule saved.',
} );
