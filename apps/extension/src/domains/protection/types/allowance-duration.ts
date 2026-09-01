import type { z } from 'zod';
import { DurationMillisecondsSchema } from './protection-value';

const ONE_MINUTE_MILLISECONDS = 60_000;
const SIXTY_MINUTES_MILLISECONDS = 3_600_000;

/**
 * Validates an allowance duration of one through sixty whole minutes in milliseconds.
 * @since 0.1.0 Initial implementation.
 */
export const AllowanceDurationMillisecondsSchema = DurationMillisecondsSchema
	.min( ONE_MINUTE_MILLISECONDS )
	.max( SIXTY_MINUTES_MILLISECONDS )
	.multipleOf( ONE_MINUTE_MILLISECONDS );

/**
 * Allowance duration of one through sixty whole minutes in milliseconds.
 * @since 0.1.0 Initial implementation.
 */
export type AllowanceDurationMilliseconds = z.infer<typeof AllowanceDurationMillisecondsSchema>;
