import { WaitDurationMillisecondsSchema } from '../../types/wait-duration';
import {
	BreathingCycleMaximumMilliseconds,
	BreathingInhaleProportion,
	BreathingPlanSchema,
	type BreathingPlan,
} from './types';

/**
 * Creates a complete breathing plan for a captured wait duration.
 * @param durationMilliseconds - Unknown captured wait-duration input.
 * @return A breathing plan containing only complete cycles.
 * @throws {import('zod').ZodError} When the duration does not match the wait-duration contract.
 * @since 0.1.0 Initial implementation.
 */
export function createBreathingPlan( durationMilliseconds: unknown ): BreathingPlan {
	const parsedDuration = WaitDurationMillisecondsSchema.parse( durationMilliseconds );
	const cycleCount = Math.ceil( parsedDuration / BreathingCycleMaximumMilliseconds );
	const cycleDurationMilliseconds = parsedDuration / cycleCount;
	const inhaleDurationMilliseconds = cycleDurationMilliseconds * BreathingInhaleProportion;
	const exhaleDurationMilliseconds = cycleDurationMilliseconds - inhaleDurationMilliseconds;
	const cycles = Array.from( { length: cycleCount }, () => ( {
		inhaleDurationMilliseconds,
		exhaleDurationMilliseconds,
	} ) );

	return BreathingPlanSchema.parse( {
		durationMilliseconds: parsedDuration,
		cycles,
	} );
}

export {
	BreathingCycleSchema,
	BreathingPlanSchema,
	type BreathingCycle,
	type BreathingPlan,
} from './types';
