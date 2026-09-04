import type { z } from 'zod';
import { DurationMillisecondsSchema } from './protection-value';

/**
 * Minimum valid allowance duration and whole-minute interval in milliseconds.
 * @since 0.1.0 Initial implementation.
 */
export const AllowanceDurationMinimumMilliseconds = 60_000;

/**
 * Maximum valid allowance duration in milliseconds.
 * @since 0.1.0 Initial implementation.
 */
export const AllowanceDurationMaximumMilliseconds = 3_600_000;

/**
 * Validates an allowance duration of one through sixty whole minutes in milliseconds.
 * @since 0.1.0 Initial implementation.
 */
export const AllowanceDurationMillisecondsSchema = DurationMillisecondsSchema
	.min( AllowanceDurationMinimumMilliseconds )
	.max( AllowanceDurationMaximumMilliseconds )
	.multipleOf( AllowanceDurationMinimumMilliseconds );

/**
 * Allowance duration of one through sixty whole minutes in milliseconds.
 * @since 0.1.0 Initial implementation.
 */
export type AllowanceDurationMilliseconds = z.infer<typeof AllowanceDurationMillisecondsSchema>;
