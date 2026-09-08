import type { z } from 'zod';
import { DurationMillisecondsSchema } from './protection-value';

const ONE_SECOND_MILLISECONDS = 1_000;
const TEN_SECONDS_MILLISECONDS = 10_000;
const ONE_HUNDRED_TWENTY_SECONDS_MILLISECONDS = 120_000;

/**
 * Validates a captured wait duration in milliseconds.
 * @since 0.1.0 Initial implementation.
 */
export const WaitDurationMillisecondsSchema = DurationMillisecondsSchema
	.min( TEN_SECONDS_MILLISECONDS )
	.max( ONE_HUNDRED_TWENTY_SECONDS_MILLISECONDS )
	.multipleOf( ONE_SECOND_MILLISECONDS );

/**
 * Captured wait duration in milliseconds.
 * @since 0.1.0 Initial implementation.
 */
export type WaitDurationMilliseconds = z.infer<typeof WaitDurationMillisecondsSchema>;
