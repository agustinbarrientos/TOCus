import { z } from 'zod';

/**
 * Validates a non-negative safe integer used by statistics persistence.
 * @since 0.1.0 Initial implementation.
 */
export const StatisticsNonNegativeSafeIntegerSchema = z.number()
	.int()
	.nonnegative()
	.max( Number.MAX_SAFE_INTEGER );

/**
 * Non-negative safe integer used by statistics persistence.
 * @since 0.1.0 Initial implementation.
 */
export type StatisticsNonNegativeSafeInteger = z.infer<
	typeof StatisticsNonNegativeSafeIntegerSchema
>;

/**
 * Validates a stable statistics generation identifier.
 * @since 0.1.0 Initial implementation.
 */
export const StatisticsGenerationIdSchema = z.string()
	.regex( /^[A-Za-z0-9_-]+$/ )
	.brand<'StatisticsGenerationId'>();

/**
 * Stable identifier separating one statistics generation from another.
 * @since 0.1.0 Initial implementation.
 */
export type StatisticsGenerationId = z.infer<typeof StatisticsGenerationIdSchema>;

/**
 * Validates one focus observation epoch identifier.
 * @since 0.1.0 Initial implementation.
 */
export const StatisticsFocusEpochIdSchema = z.string()
	.regex( /^[A-Za-z0-9_-]+$/ )
	.brand<'StatisticsFocusEpochId'>();

/**
 * Identifier separating focus observations across browser event boundaries.
 * @since 0.1.0 Initial implementation.
 */
export type StatisticsFocusEpochId = z.infer<
	typeof StatisticsFocusEpochIdSchema
>;
