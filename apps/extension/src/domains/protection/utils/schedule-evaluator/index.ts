import {
	ScheduleEvaluationFailureReason,
	ScheduleEvaluationStatus,
	type ScheduleEvaluationResult,
} from '../../types/schedule-evaluation';
import {
	NormalizedScheduleSchema,
	ScheduleMode,
	WeekdaySchema,
} from '../../types/protection-schedule';
import {
	FormattedScheduleHourSchema,
	FormattedScheduleMinuteSchema,
	ScheduleFormatterLocale,
	ScheduleFormatterOptions,
	ScheduleInstantSchema,
	TimeZoneInputSchema,
} from './types';

/**
 * Evaluates a normalized weekly schedule at one instant in an explicit time zone.
 * @param schedule - Unknown normalized schedule input.
 * @param instant - Unknown epoch-millisecond instant.
 * @param timeZone - Unknown IANA time-zone input.
 * @return An active or inactive result, or a stable invalid-time-zone error.
 * @throws {import('zod').ZodError} When the schedule or instant does not match its public contract.
 * @since 0.1.0 Initial implementation.
 */
export function evaluateSchedule( schedule: unknown, instant: unknown, timeZone: unknown ): ScheduleEvaluationResult {
	const parsedSchedule = NormalizedScheduleSchema.parse( schedule );
	const parsedInstant = ScheduleInstantSchema.parse( instant );
	const timeZoneResult = TimeZoneInputSchema.safeParse( timeZone );

	if ( ! timeZoneResult.success ) {
		return {
			status: ScheduleEvaluationStatus.ERROR,
			reason: ScheduleEvaluationFailureReason.INVALID_TIME_ZONE,
		};
	}

	let formatter: Intl.DateTimeFormat;

	try {
		formatter = new Intl.DateTimeFormat( ScheduleFormatterLocale, {
			...ScheduleFormatterOptions,
			timeZone: timeZoneResult.data,
		} );
	} catch {
		return {
			status: ScheduleEvaluationStatus.ERROR,
			reason: ScheduleEvaluationFailureReason.INVALID_TIME_ZONE,
		};
	}

	if ( parsedSchedule.mode === ScheduleMode.ALWAYS ) {
		return { status: ScheduleEvaluationStatus.ACTIVE };
	}

	const formattedParts = formatter.formatToParts( new Date( parsedInstant ) );
	const weekday = WeekdaySchema.parse( formattedParts.find( ( part ) => part.type === 'weekday' )?.value );
	const hour = FormattedScheduleHourSchema.parse( formattedParts.find( ( part ) => part.type === 'hour' )?.value );
	const minute = FormattedScheduleMinuteSchema.parse( formattedParts.find( ( part ) => part.type === 'minute' )?.value );
	const localMinute = hour * 60 + minute;
	const active = parsedSchedule.windows.some(
		( window ) =>
			window.weekday === weekday && window.startMinute <= localMinute && localMinute < window.endMinute,
	);

	return {
		status: active ? ScheduleEvaluationStatus.ACTIVE : ScheduleEvaluationStatus.INACTIVE,
	};
}

export {
	ScheduleInstantSchema,
	TimeZoneInputSchema,
	type ScheduleInstant,
	type TimeZoneInput,
} from './types';
