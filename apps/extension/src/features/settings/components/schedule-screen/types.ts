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
 * Stable end-time validation failures retained by the Schedule screen.
 * @since 0.1.0 Initial implementation.
 */
export const ScheduleWindowEndErrorReason = {
	EQUAL_TIME: 'equal-time',
	REQUIRED: 'required',
} as const;

/**
 * End-time validation failure retained by the Schedule screen.
 * @since 0.1.0 Initial implementation.
 */
export type ScheduleWindowEndErrorReason = typeof ScheduleWindowEndErrorReason[
	keyof typeof ScheduleWindowEndErrorReason
];

/**
 * Stable save failures retained by the Schedule screen.
 * @since 0.1.0 Initial implementation.
 */
export const ScheduleSaveErrorReason = {
	GENERIC: 'generic',
	INVALID_CONFIGURATION: 'invalid-configuration',
	INVALID_SCHEDULE: 'invalid-schedule',
	SCOPE_NOT_FOUND: 'scope-not-found',
} as const;

/**
 * Save failure retained by the Schedule screen.
 * @since 0.1.0 Initial implementation.
 */
export type ScheduleSaveErrorReason = typeof ScheduleSaveErrorReason[
	keyof typeof ScheduleSaveErrorReason
];

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
 * Semantic validation state associated with one editable time window.
 * @since 0.1.0 Initial implementation.
 */
export interface ScheduleWindowDraftErrors {
	startTimeRequired: boolean;
	endTime: ScheduleWindowEndErrorReason | null;
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
	 * Compares two scope labels using the selected language's collation rules.
	 * @param firstName - First scope label.
	 * @param secondName - Second scope label.
	 * @return Negative, zero, or positive locale-aware ordering result.
	 * @since 0.1.0 Initial implementation.
	 */
	compareNames( firstName: string, secondName: string ): number;
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
