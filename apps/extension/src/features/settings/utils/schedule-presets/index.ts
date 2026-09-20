import { Weekday } from '../../../../domains/protection/types/protection-schedule';
import type { ScheduleWindowDraft } from '../schedule-draft/types';
import { SchedulePreset } from './types';

/**
 * Creates independent editable windows for a selected starting schedule.
 * @param preset - Starting schedule that replaces the current draft windows.
 * @return Fresh weekday windows with deterministic draft identifiers.
 * @since 0.1.0
 */
export function createSchedulePresetWindows( preset: SchedulePreset ): ScheduleWindowDraft[] {
	const weekdays = preset === SchedulePreset.WEEKENDS_ALL_DAY
		? [ Weekday.SATURDAY, Weekday.SUNDAY ]
		: [ Weekday.MONDAY, Weekday.TUESDAY, Weekday.WEDNESDAY, Weekday.THURSDAY, Weekday.FRIDAY ];
	const fullDay = preset !== SchedulePreset.WEEKDAYS_WORKING_HOURS;

	return weekdays.map( ( weekday, id ) => ( {
		id,
		weekday,
		start: fullDay ? '00:00' : '09:00',
		end: fullDay ? '00:00' : '17:00',
		fullDay,
	} ) );
}
