import { z } from 'zod';

/**
 * Stable statuses returned by schedule evaluation.
 * @since 0.1.0 Initial implementation.
 */
export const ScheduleEvaluationStatus = {
	ACTIVE: 'active',
	INACTIVE: 'inactive',
	ERROR: 'error',
} as const;

/**
 * Validates a stable schedule-evaluation status.
 * @since 0.1.0 Initial implementation.
 */
export const ScheduleEvaluationStatusSchema = z.enum( ScheduleEvaluationStatus );

/**
 * Stable schedule-evaluation status.
 * @since 0.1.0 Initial implementation.
 */
export type ScheduleEvaluationStatus = z.infer<typeof ScheduleEvaluationStatusSchema>;

/**
 * Stable failure reasons returned by schedule evaluation.
 * @since 0.1.0 Initial implementation.
 */
export const ScheduleEvaluationFailureReason = {
	INVALID_TIME_ZONE: 'invalid-time-zone',
} as const;

/**
 * Validates a stable schedule-evaluation failure reason.
 * @since 0.1.0 Initial implementation.
 */
export const ScheduleEvaluationFailureReasonSchema = z.enum( ScheduleEvaluationFailureReason );

/**
 * Stable schedule-evaluation failure reason.
 * @since 0.1.0 Initial implementation.
 */
export type ScheduleEvaluationFailureReason = z.infer<typeof ScheduleEvaluationFailureReasonSchema>;

/**
 * Validates an active schedule-evaluation result.
 * @since 0.1.0 Initial implementation.
 */
const ActiveScheduleEvaluationSchema = z.object( {
	status: z.enum( [ ScheduleEvaluationStatus.ACTIVE ] ),
} ).strict();

/**
 * Validates an inactive schedule-evaluation result.
 * @since 0.1.0 Initial implementation.
 */
const InactiveScheduleEvaluationSchema = z.object( {
	status: z.enum( [ ScheduleEvaluationStatus.INACTIVE ] ),
} ).strict();

/**
 * Validates a failed schedule-evaluation result and its stable reason.
 * @since 0.1.0 Initial implementation.
 */
const ErrorScheduleEvaluationSchema = z.object( {
	status: z.enum( [ ScheduleEvaluationStatus.ERROR ] ),
	reason: ScheduleEvaluationFailureReasonSchema,
} ).strict();

/**
 * Validates an active, inactive, or failed schedule evaluation.
 * @since 0.1.0 Initial implementation.
 */
export const ScheduleEvaluationResultSchema = z.discriminatedUnion( 'status', [
	ActiveScheduleEvaluationSchema,
	InactiveScheduleEvaluationSchema,
	ErrorScheduleEvaluationSchema,
] );

/**
 * Active, inactive, or failed schedule evaluation.
 * @since 0.1.0 Initial implementation.
 */
export type ScheduleEvaluationResult = z.infer<typeof ScheduleEvaluationResultSchema>;
