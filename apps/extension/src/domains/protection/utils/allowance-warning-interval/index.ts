import { AllowanceWarningDurationMilliseconds } from '../../types/allowance-warning';
import { NormalizedScheduleSchema } from '../../types/protection-schedule';
import { EpochMillisecondsSchema } from '../../types/protection-value';
import { ScheduleEvaluationStatus } from '../../types/schedule-evaluation';
import {
	evaluateSchedule,
	getNextScheduleTransitionDeadline,
} from '../schedule-evaluator';
import { type AllowanceWarningInterval } from './types';

/**
 * Calculates the schedule-active portion of one allowance's final warning window.
 * @param schedule - Unknown normalized schedule input.
 * @param expiresAtEpochMilliseconds - Unknown allowance-expiry instant.
 * @param timeZone - Unknown IANA time-zone input.
 * @return Inclusive start and exclusive end, or null when the warning is never eligible.
 * @throws {import('zod').ZodError} When the schedule or expiry does not match its public contract.
 * @since 0.1.0 Initial implementation.
 */
export function calculateAllowanceWarningInterval(
	schedule: unknown,
	expiresAtEpochMilliseconds: unknown,
	timeZone: unknown,
): AllowanceWarningInterval | null {
	const parsedSchedule = NormalizedScheduleSchema.parse( schedule );
	const parsedExpiry = EpochMillisecondsSchema.parse( expiresAtEpochMilliseconds );
	const warningStartsAtEpochMilliseconds = Math.max(
		0,
		parsedExpiry - AllowanceWarningDurationMilliseconds,
	);
	const scheduleAtWarningStart = evaluateSchedule(
		parsedSchedule,
		warningStartsAtEpochMilliseconds,
		timeZone,
	);

	if ( scheduleAtWarningStart.status === ScheduleEvaluationStatus.ERROR ) {
		return null;
	}

	const transitionDeadline = getNextScheduleTransitionDeadline(
		[ parsedSchedule ],
		warningStartsAtEpochMilliseconds,
		timeZone,
	);

	if ( transitionDeadline === null || transitionDeadline >= parsedExpiry ) {
		return scheduleAtWarningStart.status === ScheduleEvaluationStatus.ACTIVE
			? {
				startsAtEpochMilliseconds: warningStartsAtEpochMilliseconds,
				endsAtEpochMilliseconds: parsedExpiry,
			}
			: null;
	}

	return scheduleAtWarningStart.status === ScheduleEvaluationStatus.ACTIVE
		? {
			startsAtEpochMilliseconds: warningStartsAtEpochMilliseconds,
			endsAtEpochMilliseconds: transitionDeadline,
		}
		: {
			startsAtEpochMilliseconds: transitionDeadline,
			endsAtEpochMilliseconds: parsedExpiry,
		};
}

export * from './types';
