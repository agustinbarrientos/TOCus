import { z } from 'zod';
import {
	AllowanceIdSchema,
	EpochMillisecondsSchema,
	PageIdSchema,
	ProtectionScopeIdSchema,
} from './protection-value';
import { ProtectedUrlMatchResultSchema } from './protected-url-match';
import { ScheduleEvaluationResultSchema } from './schedule-evaluation';

/**
 * Duration of the quiet warning window before allowance expiry.
 * @since 0.1.0 Initial implementation.
 */
export const AllowanceWarningDurationMilliseconds = 10_000;

/**
 * Warning-specific declarative decision discriminators used inside the allowance-warning leaf.
 * @since 0.1.0 Initial implementation.
 */
export const AllowanceWarningDecisionType = {
	PRESENT_ALLOWANCE_WARNING: 'present-allowance-warning',
	REMOVE_ALLOWANCE_WARNING: 'remove-allowance-warning',
} as const;

/**
 * Validates a warning-specific declarative decision discriminator.
 * @since 0.1.0 Initial implementation.
 */
export const AllowanceWarningDecisionTypeSchema = z.enum( AllowanceWarningDecisionType );

/**
 * Warning-specific declarative decision discriminator.
 * @since 0.1.0 Initial implementation.
 */
export type AllowanceWarningDecisionType = z.infer<typeof AllowanceWarningDecisionTypeSchema>;

/**
 * Validates the current page observation used to derive warning presentation.
 * @since 0.1.0 Initial implementation.
 */
export const AllowanceWarningInputSchema = z.object( {
	scopeId: ProtectionScopeIdSchema,
	allowanceId: AllowanceIdSchema,
	pageId: PageIdSchema,
	nowEpochMilliseconds: EpochMillisecondsSchema,
	focusEligible: z.boolean(),
	match: ProtectedUrlMatchResultSchema,
	schedule: ScheduleEvaluationResultSchema,
	isWarningPresented: z.boolean(),
} ).strict();

/**
 * Current page observation used to derive warning presentation.
 * @since 0.1.0 Initial implementation.
 */
export type AllowanceWarningInput = z.infer<typeof AllowanceWarningInputSchema>;

/**
 * Validates a decision to present the allowance-expiry warning.
 * @since 0.1.0 Initial implementation.
 */
export const PresentAllowanceWarningDecisionSchema = z.object( {
	type: z.enum( [ AllowanceWarningDecisionType.PRESENT_ALLOWANCE_WARNING ] ),
	pageId: PageIdSchema,
	allowanceId: AllowanceIdSchema,
	expiresAtEpochMilliseconds: EpochMillisecondsSchema,
} ).strict();

/**
 * Decision to present the allowance-expiry warning.
 * @since 0.1.0 Initial implementation.
 */
export type PresentAllowanceWarningDecision = z.infer<typeof PresentAllowanceWarningDecisionSchema>;

/**
 * Validates a decision to remove the allowance-expiry warning.
 * @since 0.1.0 Initial implementation.
 */
export const RemoveAllowanceWarningDecisionSchema = z.object( {
	type: z.enum( [ AllowanceWarningDecisionType.REMOVE_ALLOWANCE_WARNING ] ),
	pageId: PageIdSchema,
	allowanceId: AllowanceIdSchema,
} ).strict();

/**
 * Decision to remove the allowance-expiry warning.
 * @since 0.1.0 Initial implementation.
 */
export type RemoveAllowanceWarningDecision = z.infer<typeof RemoveAllowanceWarningDecisionSchema>;

/**
 * Validates a derived allowance-warning presentation decision.
 * @since 0.1.0 Initial implementation.
 */
export const AllowanceWarningDecisionSchema = z.discriminatedUnion( 'type', [
	PresentAllowanceWarningDecisionSchema,
	RemoveAllowanceWarningDecisionSchema,
] );

/**
 * Derived allowance-warning presentation decision.
 * @since 0.1.0 Initial implementation.
 */
export type AllowanceWarningDecision = z.infer<typeof AllowanceWarningDecisionSchema>;
