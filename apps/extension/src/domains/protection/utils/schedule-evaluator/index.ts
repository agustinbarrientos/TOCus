import {
	ScheduleEvaluationFailureReason,
	ScheduleEvaluationStatus,
	type ScheduleEvaluationResult,
} from '../../types/schedule-evaluation';
import {
	NormalizedScheduleSchema,
	ScheduleMode,
	WeekdaySchema,
	type NormalizedSchedule,
	type Weekday,
} from '../../types/protection-schedule';
import {
	FormattedScheduleHourSchema,
	FormattedScheduleMinuteSchema,
	NormalizedScheduleListSchema,
	ScheduleFormatterLocale,
	ScheduleFormatterOptions,
	ScheduleInstantSchema,
	TimeZoneInputSchema,
	type TimeZoneInput,
} from './types';

const MILLISECONDS_PER_MINUTE = 60_000;
const MINUTES_PER_WEEK = 10_080;
const SCHEDULE_TRANSITION_SEARCH_MILLISECONDS = 15 * 24 * 60 * MILLISECONDS_PER_MINUTE;
const MAXIMUM_DATE_EPOCH_MILLISECONDS = 8_640_000_000_000_000;

/**
 * Creates the deterministic formatter shared by one schedule operation.
 * @param timeZone - Validated IANA time-zone identifier.
 * @return Date-time formatter, or null when the runtime rejects the time zone.
 * @since 0.1.0 Initial implementation.
 */
function createScheduleFormatter( timeZone: TimeZoneInput ): Intl.DateTimeFormat | null {
	try {
		return new Intl.DateTimeFormat( ScheduleFormatterLocale, {
			...ScheduleFormatterOptions,
			timeZone,
		} );
	} catch {
		return null;
	}
}

/**
 * Extracts one deterministic local weekday and minute from an epoch instant.
 * @param instant - Validated epoch-millisecond instant.
 * @param formatter - Formatter bound to the requested time zone.
 * @return Local weekday and minute from midnight.
 * @since 0.1.0 Initial implementation.
 */
function getLocalSchedulePosition(
	instant: number,
	formatter: Intl.DateTimeFormat,
): readonly [ weekday: Weekday, minute: number ] {
	const formattedParts = formatter.formatToParts( new Date( instant ) );
	const weekday = WeekdaySchema.parse( formattedParts.find( ( part ) => part.type === 'weekday' )?.value );
	const hour = FormattedScheduleHourSchema.parse( formattedParts.find( ( part ) => part.type === 'hour' )?.value );
	const minute = FormattedScheduleMinuteSchema.parse( formattedParts.find( ( part ) => part.type === 'minute' )?.value );

	return [ weekday, hour * 60 + minute ];
}

/**
 * Reports whether one validated schedule is active at a local weekly position.
 * @param schedule - Validated normalized schedule.
 * @param weekday - Local weekday at the evaluated instant.
 * @param localMinute - Local minute from midnight at the evaluated instant.
 * @return Whether the schedule is active at the local weekly position.
 * @since 0.1.0 Initial implementation.
 */
function isScheduleActive(
	schedule: NormalizedSchedule,
	weekday: Weekday,
	localMinute: number,
): boolean {
	if ( schedule.mode === ScheduleMode.ALWAYS ) {
		return true;
	}

	return schedule.windows.some(
		( window ) =>
			window.weekday === weekday && window.startMinute <= localMinute && localMinute < window.endMinute,
	);
}

/**
 * Reports whether a normalized custom schedule covers every minute of the week.
 * @param schedule - Validated normalized schedule.
 * @return Whether the schedule can never change state.
 * @since 0.1.0 Initial implementation.
 */
function isPermanentlyActive( schedule: NormalizedSchedule ): boolean {
	if ( schedule.mode === ScheduleMode.ALWAYS ) {
		return true;
	}

	return schedule.windows.reduce(
		( coveredMinutes, window ) => coveredMinutes + window.endMinute - window.startMinute,
		0,
	) === MINUTES_PER_WEEK;
}

/**
 * Reports whether any schedule differs from its status at the search origin.
 * @param schedules - Transition-capable normalized schedules.
 * @param initialStatuses - Activity status for each schedule at the search origin.
 * @param instant - Candidate epoch-millisecond instant.
 * @param formatter - Formatter bound to the requested time zone.
 * @return Whether at least one schedule changed status.
 * @since 0.1.0 Initial implementation.
 */
function hasScheduleStatusChanged(
	schedules: ReadonlyArray<NormalizedSchedule>,
	initialStatuses: ReadonlyArray<boolean>,
	instant: number,
	formatter: Intl.DateTimeFormat,
): boolean {
	const [ weekday, localMinute ] = getLocalSchedulePosition( instant, formatter );

	return schedules.some(
		( schedule, index ) => isScheduleActive( schedule, weekday, localMinute ) !== initialStatuses[ index ],
	);
}

/**
 * Locates the first changed millisecond inside one known transition bracket.
 * @param schedules - Transition-capable normalized schedules.
 * @param initialStatuses - Activity status for each schedule at the search origin.
 * @param unchangedInstant - Latest instant known to retain every initial status.
 * @param changedInstant - Earliest sampled instant known to contain a changed status.
 * @param formatter - Formatter bound to the requested time zone.
 * @return First epoch millisecond where at least one schedule changed.
 * @since 0.1.0 Initial implementation.
 */
function findFirstChangedInstant(
	schedules: ReadonlyArray<NormalizedSchedule>,
	initialStatuses: ReadonlyArray<boolean>,
	unchangedInstant: number,
	changedInstant: number,
	formatter: Intl.DateTimeFormat,
): number {
	let lowerBound = unchangedInstant + 1;
	let upperBound = changedInstant;

	while ( lowerBound < upperBound ) {
		const candidate = lowerBound + Math.floor( ( upperBound - lowerBound ) / 2 );

		if ( hasScheduleStatusChanged( schedules, initialStatuses, candidate, formatter ) ) {
			upperBound = candidate;
		} else {
			lowerBound = candidate + 1;
		}
	}

	return lowerBound;
}

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

	const formatter = createScheduleFormatter( timeZoneResult.data );

	if ( formatter === null ) {
		return {
			status: ScheduleEvaluationStatus.ERROR,
			reason: ScheduleEvaluationFailureReason.INVALID_TIME_ZONE,
		};
	}

	const [ weekday, localMinute ] = getLocalSchedulePosition( parsedInstant, formatter );

	return {
		status: isScheduleActive( parsedSchedule, weekday, localMinute )
			? ScheduleEvaluationStatus.ACTIVE
			: ScheduleEvaluationStatus.INACTIVE,
	};
}

/**
 * Finds the earliest future instant when any normalized schedule changes activity.
 * @param schedules - Unknown normalized schedule collection.
 * @param instant - Unknown epoch-millisecond search origin.
 * @param timeZone - Unknown IANA time-zone input.
 * @return Earliest transition deadline, or null when no transition can be found safely.
 * @throws {import('zod').ZodError} When the schedules or instant do not match their public contracts.
 * @since 0.1.0 Initial implementation.
 */
export function getNextScheduleTransitionDeadline(
	schedules: unknown,
	instant: unknown,
	timeZone: unknown,
): number | null {
	const parsedSchedules = NormalizedScheduleListSchema.parse( schedules );
	const parsedInstant = ScheduleInstantSchema.parse( instant );
	const timeZoneResult = TimeZoneInputSchema.safeParse( timeZone );

	if ( ! timeZoneResult.success ) {
		return null;
	}

	const formatter = createScheduleFormatter( timeZoneResult.data );

	if ( formatter === null ) {
		return null;
	}

	const transitionSchedules = parsedSchedules.filter( ( schedule ) => ! isPermanentlyActive( schedule ) );

	if ( transitionSchedules.length === 0 || parsedInstant === MAXIMUM_DATE_EPOCH_MILLISECONDS ) {
		return null;
	}

	const [ initialWeekday, initialLocalMinute ] = getLocalSchedulePosition( parsedInstant, formatter );
	const initialStatuses = transitionSchedules.map(
		( schedule ) => isScheduleActive( schedule, initialWeekday, initialLocalMinute ),
	);
	const searchLimit = Math.min(
		parsedInstant + SCHEDULE_TRANSITION_SEARCH_MILLISECONDS,
		MAXIMUM_DATE_EPOCH_MILLISECONDS,
	);
	let previousInstant = parsedInstant;
	let candidateInstant = Math.min(
		( Math.floor( parsedInstant / MILLISECONDS_PER_MINUTE ) + 1 ) * MILLISECONDS_PER_MINUTE,
		searchLimit,
	);

	while ( candidateInstant > previousInstant && candidateInstant <= searchLimit ) {
		if ( hasScheduleStatusChanged( transitionSchedules, initialStatuses, candidateInstant, formatter ) ) {
			return findFirstChangedInstant(
				transitionSchedules,
				initialStatuses,
				previousInstant,
				candidateInstant,
				formatter,
			);
		}

		previousInstant = candidateInstant;
		candidateInstant = Math.min( candidateInstant + MILLISECONDS_PER_MINUTE, searchLimit );
	}

	return null;
}

export {
	ScheduleInstantSchema,
	TimeZoneInputSchema,
	type NormalizedScheduleList,
	type ScheduleInstant,
	type TimeZoneInput,
} from './types';
