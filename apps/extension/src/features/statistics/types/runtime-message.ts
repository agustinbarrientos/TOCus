import { z } from 'zod';

/**
 * Requests supported by the local statistics runtime.
 * @since 0.1.0 Initial implementation.
 */
export const StatisticsRuntimeRequestType = {
	READ_STATISTICS: 'read-statistics',
	RESET_STATISTICS: 'reset-statistics',
} as const;

/**
 * Validates a local statistics runtime request discriminator.
 * @since 0.1.0 Initial implementation.
 */
export const StatisticsRuntimeRequestTypeSchema = z.enum( StatisticsRuntimeRequestType );

/**
 * Local statistics runtime request discriminator.
 * @since 0.1.0 Initial implementation.
 */
export type StatisticsRuntimeRequestType = z.infer<typeof StatisticsRuntimeRequestTypeSchema>;

/**
 * Validates a request for the current all-time statistics projection.
 * @since 0.1.0 Initial implementation.
 */
export const ReadStatisticsRequestSchema = z.object( {
	type: z.enum( [ StatisticsRuntimeRequestType.READ_STATISTICS ] ),
} ).strict();

/**
 * Request for the current all-time statistics projection.
 * @since 0.1.0 Initial implementation.
 */
export type ReadStatisticsRequest = z.infer<typeof ReadStatisticsRequestSchema>;

/**
 * Validates a request to reset local all-time statistics.
 * @since 0.1.0 Initial implementation.
 */
export const ResetStatisticsRequestSchema = z.object( {
	type: z.enum( [ StatisticsRuntimeRequestType.RESET_STATISTICS ] ),
} ).strict();

/**
 * Request to reset local all-time statistics.
 * @since 0.1.0 Initial implementation.
 */
export type ResetStatisticsRequest = z.infer<typeof ResetStatisticsRequestSchema>;

/**
 * Validates every request accepted by the local statistics runtime.
 * @since 0.1.0 Initial implementation.
 */
export const StatisticsRuntimeRequestSchema = z.discriminatedUnion( 'type', [
	ReadStatisticsRequestSchema,
	ResetStatisticsRequestSchema,
] );

/**
 * Request accepted by the local statistics runtime.
 * @since 0.1.0 Initial implementation.
 */
export type StatisticsRuntimeRequest = z.infer<typeof StatisticsRuntimeRequestSchema>;
