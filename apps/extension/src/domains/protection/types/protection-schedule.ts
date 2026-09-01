import { z } from 'zod';

/**
 * Weekdays supported by weekly protection schedules.
 * @since 0.1.0 Initial implementation.
 */
export const Weekday = {
	MONDAY: 'Monday',
	TUESDAY: 'Tuesday',
	WEDNESDAY: 'Wednesday',
	THURSDAY: 'Thursday',
	FRIDAY: 'Friday',
	SATURDAY: 'Saturday',
	SUNDAY: 'Sunday',
} as const;

/**
 * Validates a weekday supported by weekly protection schedules.
 * @since 0.1.0 Initial implementation.
 */
export const WeekdaySchema = z.enum( Weekday );

/**
 * Weekday supported by weekly protection schedules.
 * @since 0.1.0 Initial implementation.
 */
export type Weekday = z.infer<typeof WeekdaySchema>;

/**
 * Sort position for each schedule weekday.
 * @since 0.1.0 Initial implementation.
 */
export const WeekdayOrder = {
	[ Weekday.MONDAY ]: 0,
	[ Weekday.TUESDAY ]: 1,
	[ Weekday.WEDNESDAY ]: 2,
	[ Weekday.THURSDAY ]: 3,
	[ Weekday.FRIDAY ]: 4,
	[ Weekday.SATURDAY ]: 5,
	[ Weekday.SUNDAY ]: 6,
} as const;

/**
 * Following weekday for overnight schedule normalization.
 * @since 0.1.0 Initial implementation.
 */
export const NextWeekday = {
	[ Weekday.MONDAY ]: Weekday.TUESDAY,
	[ Weekday.TUESDAY ]: Weekday.WEDNESDAY,
	[ Weekday.WEDNESDAY ]: Weekday.THURSDAY,
	[ Weekday.THURSDAY ]: Weekday.FRIDAY,
	[ Weekday.FRIDAY ]: Weekday.SATURDAY,
	[ Weekday.SATURDAY ]: Weekday.SUNDAY,
	[ Weekday.SUNDAY ]: Weekday.MONDAY,
} as const;

/**
 * Schedule modes available to one protection scope.
 * @since 0.1.0 Initial implementation.
 */
export const ScheduleMode = {
	ALWAYS: 'always',
	CUSTOM: 'custom',
} as const;

/**
 * Validates a protection schedule mode.
 * @since 0.1.0 Initial implementation.
 */
export const ScheduleModeSchema = z.enum( ScheduleMode );

/**
 * Protection schedule mode.
 * @since 0.1.0 Initial implementation.
 */
export type ScheduleMode = z.infer<typeof ScheduleModeSchema>;

/**
 * Validates a whole start minute from local midnight through 23:59.
 * @since 0.1.0 Initial implementation.
 */
export const ScheduleStartMinuteSchema = z
	.number()
	.int()
	.min( 0 )
	.max( 1_439 )
	.transform( ( value ) => ( Object.is( value, -0 ) ? 0 : value ) );

/**
 * Whole start minute from local midnight through 23:59.
 * @since 0.1.0 Initial implementation.
 */
export type ScheduleStartMinute = z.infer<typeof ScheduleStartMinuteSchema>;

/**
 * Validates a whole end minute from local midnight through the end of day.
 * @since 0.1.0 Initial implementation.
 */
export const ScheduleEndMinuteSchema = z
	.number()
	.int()
	.min( 0 )
	.max( 1_440 )
	.transform( ( value ) => ( Object.is( value, -0 ) ? 0 : value ) );

/**
 * Whole end minute from local midnight through the end of day.
 * @since 0.1.0 Initial implementation.
 */
export type ScheduleEndMinute = z.infer<typeof ScheduleEndMinuteSchema>;

/**
 * Validates one weekly schedule window, including an overnight range.
 * @since 0.1.0 Initial implementation.
 */
export const ScheduleWindowSchema = z.object( {
	weekday: WeekdaySchema,
	startMinute: ScheduleStartMinuteSchema,
	endMinute: ScheduleEndMinuteSchema,
} ).strict().superRefine( ( window, context ) => {
	if ( window.startMinute === window.endMinute ) {
		context.addIssue( {
			code: 'custom',
			message: 'Schedule window endpoints must be different.',
			path: [ 'endMinute' ],
		} );
	}
} );

/**
 * One weekly schedule window, including an overnight range.
 * @since 0.1.0 Initial implementation.
 */
export type ScheduleWindow = z.infer<typeof ScheduleWindowSchema>;

/**
 * Validates an Always protection schedule.
 * @since 0.1.0 Initial implementation.
 */
export const AlwaysScheduleSchema = z.object( {
	mode: z.enum( [ ScheduleMode.ALWAYS ] ),
} ).strict();

/**
 * Protection schedule that remains active at every valid instant.
 * @since 0.1.0 Initial implementation.
 */
export type AlwaysSchedule = z.infer<typeof AlwaysScheduleSchema>;

/**
 * Validates a custom weekly protection schedule with at least one window.
 * @since 0.1.0 Initial implementation.
 */
export const CustomScheduleSchema = z.object( {
	mode: z.enum( [ ScheduleMode.CUSTOM ] ),
	windows: z.array( ScheduleWindowSchema ).min( 1 ),
} ).strict();

/**
 * Custom weekly protection schedule with at least one window.
 * @since 0.1.0 Initial implementation.
 */
export type CustomSchedule = z.infer<typeof CustomScheduleSchema>;

/**
 * Validates an Always or custom weekly protection schedule.
 * @since 0.1.0 Initial implementation.
 */
export const ScheduleSchema = z.discriminatedUnion( 'mode', [
	AlwaysScheduleSchema,
	CustomScheduleSchema,
] );

/**
 * Always or custom weekly protection schedule.
 * @since 0.1.0 Initial implementation.
 */
export type Schedule = z.infer<typeof ScheduleSchema>;

/**
 * Validates one nonempty same-day normalized schedule window.
 * @since 0.1.0 Initial implementation.
 */
export const NormalizedScheduleWindowSchema = z.object( {
	weekday: WeekdaySchema,
	startMinute: ScheduleStartMinuteSchema,
	endMinute: ScheduleEndMinuteSchema,
} ).strict().superRefine( ( window, context ) => {
	if ( window.startMinute >= window.endMinute ) {
		context.addIssue( {
			code: 'custom',
			message: 'Normalized schedule windows must increase within one weekday.',
			path: [ 'endMinute' ],
		} );
	}
} );

/**
 * One nonempty same-day normalized schedule window.
 * @since 0.1.0 Initial implementation.
 */
export type NormalizedScheduleWindow = z.infer<typeof NormalizedScheduleWindowSchema>;

/**
 * Validates a normalized custom schedule in deterministic merged order.
 * @since 0.1.0 Initial implementation.
 */
export const NormalizedCustomScheduleSchema = z.object( {
	mode: z.enum( [ ScheduleMode.CUSTOM ] ),
	windows: z.array( NormalizedScheduleWindowSchema ).min( 1 ),
} ).strict().superRefine( ( schedule, context ) => {
	let previousWindow: z.infer<typeof NormalizedScheduleWindowSchema> | undefined;

	for ( const [ index, window ] of schedule.windows.entries() ) {
		if ( previousWindow === undefined ) {
			previousWindow = window;
			continue;
		}

		if ( WeekdayOrder[ window.weekday ] < WeekdayOrder[ previousWindow.weekday ] ) {
			context.addIssue( {
				code: 'custom',
				message: 'Normalized schedule windows must use deterministic weekday order.',
				path: [ 'windows', index ],
			} );
			continue;
		}

		if ( window.weekday === previousWindow.weekday && window.startMinute <= previousWindow.endMinute ) {
			context.addIssue( {
				code: 'custom',
				message: 'Normalized schedule windows must already merge overlap and adjacency.',
				path: [ 'windows', index ],
			} );
		}

		previousWindow = window;
	}
} );

/**
 * Normalized custom schedule in deterministic merged order.
 * @since 0.1.0 Initial implementation.
 */
export type NormalizedCustomSchedule = z.infer<typeof NormalizedCustomScheduleSchema>;

/**
 * Validates a normalized Always or custom weekly schedule.
 * @since 0.1.0 Initial implementation.
 */
export const NormalizedScheduleSchema = z.discriminatedUnion( 'mode', [
	AlwaysScheduleSchema,
	NormalizedCustomScheduleSchema,
] );

/**
 * Normalized Always or custom weekly schedule.
 * @since 0.1.0 Initial implementation.
 */
export type NormalizedSchedule = z.infer<typeof NormalizedScheduleSchema>;
