import { z } from 'zod';
import {
	AllowanceIdSchema,
	PageIdSchema,
	ParticipantIdSchema,
	RetainedNavigationDestinationSchema,
	WaitIdSchema,
} from './protection-value';
import {
	AllowanceWarningDecisionType,
	PresentAllowanceWarningDecisionSchema,
	RemoveAllowanceWarningDecisionSchema,
} from './allowance-warning';

/**
 * Declarative effects returned by protection-state transitions.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionDecisionType = {
	PRESENT_WAITING: 'present-waiting',
	PRESENT_READY: 'present-ready',
	RELEASE_NAVIGATION: 'release-navigation',
	DISMISS_INTERRUPTION: 'dismiss-interruption',
	...AllowanceWarningDecisionType,
} as const;

/**
 * Validates a declarative protection-decision discriminator.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionDecisionTypeSchema = z.enum( ProtectionDecisionType );

/**
 * Declarative protection-decision discriminator.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionDecisionType = z.infer<typeof ProtectionDecisionTypeSchema>;

/**
 * Validates a decision to present the waiting experience.
 * @since 0.1.0 Initial implementation.
 */
export const PresentWaitingDecisionSchema = z.object( {
	type: z.enum( [ ProtectionDecisionType.PRESENT_WAITING ] ),
	participantId: ParticipantIdSchema,
	pageId: PageIdSchema,
	waitId: WaitIdSchema,
} ).strict();

/**
 * Decision to present the Waiting experience.
 * @since 0.1.0 Initial implementation.
 */
export type PresentWaitingDecision = z.infer<typeof PresentWaitingDecisionSchema>;

/**
 * Validates a decision to present the Ready experience.
 * @since 0.1.0 Initial implementation.
 */
export const PresentReadyDecisionSchema = z.object( {
	type: z.enum( [ ProtectionDecisionType.PRESENT_READY ] ),
	participantId: ParticipantIdSchema,
	pageId: PageIdSchema,
	allowanceId: AllowanceIdSchema,
} ).strict();

/**
 * Decision to present the Ready experience.
 * @since 0.1.0 Initial implementation.
 */
export type PresentReadyDecision = z.infer<typeof PresentReadyDecisionSchema>;

/**
 * Validates a decision to release a retained navigation.
 * @since 0.1.0 Initial implementation.
 */
export const ReleaseNavigationDecisionSchema = z.object( {
	type: z.enum( [ ProtectionDecisionType.RELEASE_NAVIGATION ] ),
	participantId: ParticipantIdSchema,
	pageId: PageIdSchema,
	retainedDestination: RetainedNavigationDestinationSchema,
} ).strict();

/**
 * Decision to release a retained navigation.
 * @since 0.1.0 Initial implementation.
 */
export type ReleaseNavigationDecision = z.infer<typeof ReleaseNavigationDecisionSchema>;

/**
 * Validates a decision to dismiss the current interruption.
 * @since 0.1.0 Initial implementation.
 */
export const DismissInterruptionDecisionSchema = z.object( {
	type: z.enum( [ ProtectionDecisionType.DISMISS_INTERRUPTION ] ),
	participantId: ParticipantIdSchema,
	pageId: PageIdSchema,
} ).strict();

/**
 * Decision to dismiss the current interruption.
 * @since 0.1.0 Initial implementation.
 */
export type DismissInterruptionDecision = z.infer<typeof DismissInterruptionDecisionSchema>;

/**
 * Validates a declarative decision returned by a protection-state transition.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionDecisionSchema = z.discriminatedUnion( 'type', [
	PresentWaitingDecisionSchema,
	PresentReadyDecisionSchema,
	ReleaseNavigationDecisionSchema,
	DismissInterruptionDecisionSchema,
	PresentAllowanceWarningDecisionSchema,
	RemoveAllowanceWarningDecisionSchema,
] );

/**
 * Declarative decision returned by a protection-state transition.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionDecision = z.infer<typeof ProtectionDecisionSchema>;
