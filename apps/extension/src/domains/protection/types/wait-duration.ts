import type { z } from 'zod';
import { DurationMillisecondsSchema } from './protection-value';

const FIVE_SECONDS_MILLISECONDS = 5_000;
const TEN_SECONDS_MILLISECONDS = 10_000;
const SIXTY_SECONDS_MILLISECONDS = 60_000;

/**
 * Validates a captured wait duration in milliseconds.
 * @since 0.1.0 Initial implementation.
 */
export const WaitDurationMillisecondsSchema = DurationMillisecondsSchema
	.min( TEN_SECONDS_MILLISECONDS )
	.max( SIXTY_SECONDS_MILLISECONDS )
	.multipleOf( FIVE_SECONDS_MILLISECONDS );

/**
 * Captured wait duration in milliseconds.
 * @since 0.1.0 Initial implementation.
 */
export type WaitDurationMilliseconds = z.infer<typeof WaitDurationMillisecondsSchema>;
