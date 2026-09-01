import { z } from 'zod';
import { WaitDurationMillisecondsSchema } from '../../types/wait-duration';

/**
 * Maximum duration of one complete breathing cycle.
 * @since 0.1.0 Initial implementation.
 */
export const BreathingCycleMaximumMilliseconds = 10_000;

/**
 * Share of each breathing cycle devoted to inhalation.
 * @since 0.1.0 Initial implementation.
 */
export const BreathingInhaleProportion = 0.4;

/**
 * Validates one complete inhale and exhale cycle.
 * @since 0.1.0 Initial implementation.
 */
export const BreathingCycleSchema = z.object( {
	inhaleDurationMilliseconds: z.number().positive().max( BreathingCycleMaximumMilliseconds ),
	exhaleDurationMilliseconds: z.number().positive().max( BreathingCycleMaximumMilliseconds ),
} ).strict().superRefine( ( cycle, context ) => {
	const totalDurationMilliseconds =
		cycle.inhaleDurationMilliseconds + cycle.exhaleDurationMilliseconds;
	const expectedInhaleDurationMilliseconds =
		totalDurationMilliseconds * BreathingInhaleProportion;
	const expectedExhaleDurationMilliseconds =
		totalDurationMilliseconds - expectedInhaleDurationMilliseconds;

	if ( totalDurationMilliseconds > BreathingCycleMaximumMilliseconds ) {
		context.addIssue( {
			code: 'custom',
			message: 'A complete breathing cycle cannot exceed ten seconds.',
			path: [],
		} );
	}

	if (
		cycle.inhaleDurationMilliseconds !== expectedInhaleDurationMilliseconds ||
		cycle.exhaleDurationMilliseconds !== expectedExhaleDurationMilliseconds
	) {
		context.addIssue( {
			code: 'custom',
			message: 'A complete breathing cycle must use its exact 40/60 phase allocation.',
			path: [],
		} );
	}
} );

/**
 * One complete inhale and exhale cycle.
 * @since 0.1.0 Initial implementation.
 */
export type BreathingCycle = z.infer<typeof BreathingCycleSchema>;

/**
 * Validates a complete breathing plan for one wait.
 * @since 0.1.0 Initial implementation.
 */
export const BreathingPlanSchema = z.object( {
	durationMilliseconds: WaitDurationMillisecondsSchema,
	cycles: z.array( BreathingCycleSchema ).min( 1 ).max( 6 ),
} ).strict().superRefine( ( plan, context ) => {
	const expectedCycleCount = Math.ceil(
		plan.durationMilliseconds / BreathingCycleMaximumMilliseconds,
	);

	if ( plan.cycles.length !== expectedCycleCount ) {
		context.addIssue( {
			code: 'custom',
			message: 'Cycle count must match the captured wait duration.',
			path: [ 'cycles' ],
		} );

		return;
	}

	const expectedCycleDurationMilliseconds = plan.durationMilliseconds / expectedCycleCount;
	const expectedInhaleDurationMilliseconds =
		expectedCycleDurationMilliseconds * BreathingInhaleProportion;
	const expectedExhaleDurationMilliseconds =
		expectedCycleDurationMilliseconds - expectedInhaleDurationMilliseconds;

	plan.cycles.forEach( ( cycle, index ) => {
		if (
			cycle.inhaleDurationMilliseconds !== expectedInhaleDurationMilliseconds ||
			cycle.exhaleDurationMilliseconds !== expectedExhaleDurationMilliseconds
		) {
			context.addIssue( {
				code: 'custom',
				message: 'Every cycle must use the equal 40/60 share of the captured wait.',
				path: [ 'cycles', index ],
			} );
		}
	} );
} );

/**
 * Complete breathing plan whose durationMilliseconds is the authoritative captured total and whose phase numbers are its deterministic floating-point allocation.
 * @since 0.1.0 Initial implementation.
 */
export type BreathingPlan = z.infer<typeof BreathingPlanSchema>;
