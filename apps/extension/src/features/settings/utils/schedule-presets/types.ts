/**
 * Starting schedules available in the custom schedule editor.
 * @since 1.0.0
 */
export const SchedulePreset = {
	WEEKDAYS_WORKING_HOURS: 'weekdays-working-hours',
	WEEKDAYS_ALL_DAY: 'weekdays-all-day',
	WEEKENDS_ALL_DAY: 'weekends-all-day',
} as const;

/**
 * One starting schedule available in the custom schedule editor.
 * @since 1.0.0
 */
export type SchedulePreset = typeof SchedulePreset[ keyof typeof SchedulePreset ];
