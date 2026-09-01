import { createBreathingPlan } from '../../../../domains/protection/utils/breathing-plan-calculator';
import {
	BreathingMotionPhase,
	type BreathingMotionFrame,
} from './types';

/**
 * Restricts a numeric value to an inclusive range.
 * @param value - Value to restrict.
 * @param minimum - Inclusive lower bound.
 * @param maximum - Inclusive upper bound.
 * @return Restricted value.
 */
function clamp( value: number, minimum: number, maximum: number ): number {
	return Math.max( minimum, Math.min( maximum, value ) );
}

/**
 * Applies the approved endpoint-resting Natural curve to normalized progress.
 * @param progress - Normalized linear phase progress.
 * @return Smoothed phase progress.
 */
function applyNaturalCurve( progress: number ): number {
	return 0.5 - 0.5 * Math.cos( Math.PI * clamp( progress, 0, 1 ) );
}

/**
 * Calculates one deterministic Natural breathing frame within a captured wait.
 * @param elapsedMilliseconds - Current focused visual progress.
 * @param waitDurationMilliseconds - Captured complete-wait duration.
 * @param reducedMotion - Whether continuous sphere movement is disabled.
 * @return Current phase, sphere progress, remaining duration, and completion status.
 * @throws {import('zod').ZodError} When the wait duration is outside the protection-domain contract.
 * @since 0.1.0 Initial implementation.
 */
export function getBreathingMotionFrame(
	elapsedMilliseconds: number,
	waitDurationMilliseconds: number,
	reducedMotion = false,
): BreathingMotionFrame {
	const plan = createBreathingPlan( waitDurationMilliseconds );
	const elapsed = clamp( elapsedMilliseconds, 0, plan.durationMilliseconds );
	const remainingMilliseconds = plan.durationMilliseconds - elapsed;

	if ( remainingMilliseconds === 0 ) {
		return {
			breathProgress: 0,
			complete: true,
			phase: BreathingMotionPhase.EXHALE,
			remainingMilliseconds,
		};
	}

	const cycleDurationMilliseconds = plan.durationMilliseconds / plan.cycles.length;
	const currentCycleIndex = Math.min(
		Math.floor( elapsed / cycleDurationMilliseconds ),
		plan.cycles.length - 1,
	);
	const cycleElapsedMilliseconds = elapsed - currentCycleIndex * cycleDurationMilliseconds;
	const currentCycle = plan.cycles.reduce( ( selectedCycle, cycle, cycleIndex ) =>
		cycleIndex === currentCycleIndex ? cycle : selectedCycle,
	);

	const inhaleDurationMilliseconds = currentCycle.inhaleDurationMilliseconds;
	const exhaleDurationMilliseconds = currentCycle.exhaleDurationMilliseconds;
	const inhaling = cycleElapsedMilliseconds < inhaleDurationMilliseconds;
	const phaseProgress = inhaling
		? cycleElapsedMilliseconds / inhaleDurationMilliseconds
		: ( cycleElapsedMilliseconds - inhaleDurationMilliseconds ) / exhaleDurationMilliseconds;
	const easedProgress = applyNaturalCurve( phaseProgress );

	return {
		breathProgress: reducedMotion ? 0 : inhaling ? easedProgress : 1 - easedProgress,
		complete: false,
		phase: inhaling ? BreathingMotionPhase.INHALE : BreathingMotionPhase.EXHALE,
		remainingMilliseconds,
	};
}

export {
	BreathingMotionPhase,
	type BreathingMotionFrame,
} from './types';
