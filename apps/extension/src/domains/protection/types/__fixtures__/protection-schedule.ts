import {
	CustomScheduleSchema,
	NormalizedCustomScheduleSchema,
	ScheduleMode,
} from '../protection-schedule';

/**
 * Valid custom schedule with an overnight window.
 * @since 0.1.0 Initial implementation.
 */
export const Mock_ProtectionSchedule_Custom = CustomScheduleSchema.parse( {
	mode: ScheduleMode.CUSTOM,
	windows: [ {
		weekday: 'Monday',
		startMinute: 1_380,
		endMinute: 60,
	} ],
} );

/**
 * Valid normalized schedule with deterministic weekday order.
 * @since 0.1.0 Initial implementation.
 */
export const Mock_ProtectionSchedule_Normalized = NormalizedCustomScheduleSchema.parse( {
	mode: ScheduleMode.CUSTOM,
	windows: [
		{ weekday: 'Monday', startMinute: 60, endMinute: 120 },
		{ weekday: 'Tuesday', startMinute: 180, endMinute: 240 },
	],
} );
