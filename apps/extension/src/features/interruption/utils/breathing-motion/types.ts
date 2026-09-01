/**
 * Visible breathing phases supported by the interruption presentation.
 * @since 0.1.0 Initial implementation.
 */
export const BreathingMotionPhase = {
	INHALE: 'inhale',
	EXHALE: 'exhale',
} as const;

/**
 * Visible breathing phase supported by the interruption presentation.
 * @since 0.1.0 Initial implementation.
 */
export type BreathingMotionPhase = typeof BreathingMotionPhase[keyof typeof BreathingMotionPhase];

/**
 * Deterministic presentation values for one point in a captured wait.
 * @since 0.1.0 Initial implementation.
 */
export interface BreathingMotionFrame {
	breathProgress: number;
	complete: boolean;
	phase: BreathingMotionPhase;
	remainingMilliseconds: number;
}
