import type {
	ScheduleMode,
	Weekday,
} from '../../../../domains/protection/types/protection-schedule';


/**
 * Editable weekly window including an unchanged loaded full-day boundary.
 * @since 0.1.0
 */
export interface ScheduleWindowDraft {
	id: number;
	weekday: Weekday;
	start: string;
	end: string;
	fullDay: boolean;
}


/**
 * Complete presentation draft for one selected protection schedule.
 * @since 0.1.0
 */
export interface ScheduleDraft {
	mode: ScheduleMode;
	windows: ScheduleWindowDraft[];
}


/**
 * Localized field errors for one editable time window.
 * @since 0.1.0
 */
export interface ScheduleWindowErrors {
	start: string | null;
	end: string | null;
}
