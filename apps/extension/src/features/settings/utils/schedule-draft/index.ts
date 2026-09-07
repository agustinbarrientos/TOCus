import { ScheduleMode,
	Weekday,
	type Schedule,
	type NormalizedSchedule,
} from '../../../../domains/protection/types/protection-schedule';
import { normalizeSchedule } from '../../../../domains/protection/utils/schedule-normalizer';
import type {
	ScheduleScreenCopy,
} from '../../components/schedule-screen/types';
import type {
	ScheduleDraft,
	ScheduleWindowDraft,
	ScheduleWindowErrors,
} from './types';


/**
 * Formats a minute boundary for the controlled local-time field.
 * @param minute - Domain minute offset, including the end-of-day boundary.
 * @return Zero-padded hour and minute.
 * @since 0.1.0
 */
function formatTime( minute: number ): string {
	const hour = String( Math.floor( minute % 1440 / 60 ) ).padStart( 2, '0' );
	return `${ hour }:${ String( minute % 60 ).padStart( 2, '0' ) }`;
}


/**
 * Parses one controlled local-time value into domain minutes.
 * @param time - Complete hour/minute value or empty field.
 * @return Domain minute offset, or null for a required empty value.
 * @since 0.1.0
 */
export function parseTime( time: string ): number | null {
	if ( ! /^(?:[01]\d|2[0-3]):[0-5]\d$/.test( time ) ) {
		return null;
	}
	return Number( time.split( ':' )[ 0 ] ) * 60 + Number( time.split( ':' )[ 1 ] );
}


/**
 * Creates an incomplete custom window for explicit user entry.
 * @param id - Stable draft identifier.
 * @return Monday window with required empty time values.
 * @since 0.1.0
 */
export function blankWindow( id: number ): ScheduleWindowDraft {
	return { id, weekday: Weekday.MONDAY, start: '', end: '', fullDay: false };
}


/**
 * Projects a validated persisted schedule into editable local-time windows.
 * @param schedule - Validated authoritative schedule.
 * @return Complete draft preserving a loaded full-day boundary.
 * @since 0.1.0
 */
export function fromSchedule( schedule: Schedule ): ScheduleDraft {
	return {
		mode: schedule.mode,
		windows: schedule.mode === ScheduleMode.CUSTOM ? schedule.windows.map( ( window, id ) => ( {
			id, weekday: window.weekday, start: formatTime( window.startMinute ), end: formatTime( window.endMinute ),
			fullDay: window.startMinute === 0 && window.endMinute === 1440,
		} ) ) : [],
	};
}


/**
 * Preserves the end-of-day value for an unchanged loaded full-day window.
 * @param window - Current editable window.
 * @return Domain end minute or missing value.
 * @since 0.1.0
 */
export function endMinute( window: ScheduleWindowDraft ): number | null {
	return window.fullDay && window.end === '00:00' ? 1440 : parseTime( window.end );
}

/**
 * Converts a complete candidate through the canonical domain schedule normalizer.
 * @param candidate - Effective mode and editable weekly windows.
 * @return Validated, sorted and merged persistence representation.
 * @since 0.1.0
 */
export function toSchedule( candidate: ScheduleDraft ): NormalizedSchedule {
	return normalizeSchedule( candidate.mode === ScheduleMode.ALWAYS ? { mode: ScheduleMode.ALWAYS } : {
		mode: ScheduleMode.CUSTOM, windows: candidate.windows.map( ( window ) => ( {
			weekday: window.weekday, startMinute: parseTime( window.start ), endMinute: endMinute( window ),
		} ) ),
	} );
}

/**
 * Compares effective schedules while allowing incomplete custom drafts to remain editable.
 * @param left - First presentation draft.
 * @param right - Authoritative baseline or other candidate.
 * @return Whether both candidates represent the same protection intervals.
 * @since 0.1.0
 */
export function schedulesEqual( left: ScheduleDraft, right: ScheduleDraft ): boolean {
	try {
		return JSON.stringify( toSchedule( left ) ) === JSON.stringify( toSchedule( right ) );
	} catch {
		return JSON.stringify( left ) === JSON.stringify( right );
	}
}


/**
 * Produces specific required/equal-time guidance for editable schedule fields.
 * @param window - Current editable window.
 * @param copy - Canonical validation messages.
 * @return Localized field errors, with null for valid values.
 * @since 0.1.0
 */
export function windowErrors( window: ScheduleWindowDraft, copy: ScheduleScreenCopy ): ScheduleWindowErrors {
	const start = parseTime( window.start );
	const end = endMinute( window );
	return {
		start: start === null ? copy.startTimeRequiredError : null,
		end: end === null ? copy.endTimeRequiredError : start === end ? copy.equalTimeError : null,
	};
}
