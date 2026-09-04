import { z } from 'zod';
import { StatisticsNonNegativeSafeIntegerSchema } from './statistics-value';

/**
 * Availability states for the global all-time statistics projection.
 * @since 0.1.0 Initial implementation.
 */
export const StatisticsProjectionStatus = {
	AVAILABLE: 'available',
	UNAVAILABLE: 'unavailable',
} as const;

/**
 * Validates a statistics projection availability state.
 * @since 0.1.0 Initial implementation.
 */
export const StatisticsProjectionStatusSchema = z.enum( StatisticsProjectionStatus );

/**
 * Statistics projection availability state.
 * @since 0.1.0 Initial implementation.
 */
export type StatisticsProjectionStatus = z.infer<typeof StatisticsProjectionStatusSchema>;

/**
 * Validates an available global all-time statistics projection.
 * @since 0.1.0 Initial implementation.
 */
export const AvailableStatisticsProjectionSchema = z.object( {
	status: z.enum( [ StatisticsProjectionStatus.AVAILABLE ] ),
	estimatedReclaimedMilliseconds: StatisticsNonNegativeSafeIntegerSchema.nullable(),
	focusedPauseMilliseconds: StatisticsNonNegativeSafeIntegerSchema,
	reconsideredVisitCount: StatisticsNonNegativeSafeIntegerSchema,
	completedWaitCount: StatisticsNonNegativeSafeIntegerSchema,
	allowanceGrantedCount: StatisticsNonNegativeSafeIntegerSchema,
} ).strict();

/**
 * Available global all-time statistics projection.
 * @since 0.1.0 Initial implementation.
 */
export type AvailableStatisticsProjection = z.infer<
	typeof AvailableStatisticsProjectionSchema
>;

/**
 * Validates an unavailable statistics projection.
 * @since 0.1.0 Initial implementation.
 */
export const UnavailableStatisticsProjectionSchema = z.object( {
	status: z.enum( [ StatisticsProjectionStatus.UNAVAILABLE ] ),
} ).strict();

/**
 * Unavailable statistics projection without fabricated values.
 * @since 0.1.0 Initial implementation.
 */
export type UnavailableStatisticsProjection = z.infer<
	typeof UnavailableStatisticsProjectionSchema
>;

/**
 * Validates an available or unavailable statistics projection.
 * @since 0.1.0 Initial implementation.
 */
export const StatisticsProjectionSchema = z.discriminatedUnion( 'status', [
	AvailableStatisticsProjectionSchema,
	UnavailableStatisticsProjectionSchema,
] );

/**
 * Available or unavailable statistics projection.
 * @since 0.1.0 Initial implementation.
 */
export type StatisticsProjection = z.infer<typeof StatisticsProjectionSchema>;
