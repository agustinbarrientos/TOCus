import { z } from 'zod';
import {
	JoinSequenceSchema,
	PageIdSchema,
	ParticipantIdSchema,
	RetainedNavigationDestinationSchema,
} from './protection-value';

/**
 * Participant origins supported by protection transitions.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionParticipantOrigin = {
	NAVIGATION: 'navigation',
	ALLOWANCE_EXPIRY: 'allowance-expiry',
} as const;

/**
 * Validates a protection participant origin.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionParticipantOriginSchema = z.enum( ProtectionParticipantOrigin );

/**
 * Origin that attached a participant to a shared wait.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionParticipantOrigin = z.infer<typeof ProtectionParticipantOriginSchema>;

/**
 * Validates a participant created from a protected navigation attempt.
 * @since 0.1.0 Initial implementation.
 */
export const NavigationProtectionParticipantSchema = z.object( {
	origin: z.enum( [ ProtectionParticipantOrigin.NAVIGATION ] ),
	participantId: ParticipantIdSchema,
	pageId: PageIdSchema,
	retainedDestination: RetainedNavigationDestinationSchema,
	focusEligible: z.boolean(),
	joinSequence: JoinSequenceSchema,
} ).strict();

/**
 * Navigation-origin participant retained by a protection transaction.
 * @since 0.1.0 Initial implementation.
 */
export type NavigationProtectionParticipant = z.infer<typeof NavigationProtectionParticipantSchema>;

/**
 * Validates a participant created when an allowance expires.
 * @since 0.1.0 Initial implementation.
 */
export const AllowanceExpiryProtectionParticipantSchema = z.object( {
	origin: z.enum( [ ProtectionParticipantOrigin.ALLOWANCE_EXPIRY ] ),
	participantId: ParticipantIdSchema,
	pageId: PageIdSchema,
	retainedDestination: z.null(),
	focusEligible: z.boolean(),
	joinSequence: JoinSequenceSchema,
} ).strict();

/**
 * Allowance-expiry-origin participant retained by a protection transaction.
 * @since 0.1.0 Initial implementation.
 */
export type AllowanceExpiryProtectionParticipant = z.infer<
	typeof AllowanceExpiryProtectionParticipantSchema
>;

/**
 * Validates one participant retained by Waiting or Allowance state.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionParticipantSchema = z.discriminatedUnion( 'origin', [
	NavigationProtectionParticipantSchema,
	AllowanceExpiryProtectionParticipantSchema,
] );

/**
 * Participant retained by Waiting or Allowance state.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionParticipant = z.infer<typeof ProtectionParticipantSchema>;

/**
 * Validates a participant supplied with a protected visit attempt.
 * @since 0.1.0 Initial implementation.
 */
export const VisitAttemptParticipantSchema = z.object( {
	origin: z.enum( [ ProtectionParticipantOrigin.NAVIGATION ] ),
	participantId: ParticipantIdSchema,
	pageId: PageIdSchema,
	retainedDestination: RetainedNavigationDestinationSchema,
	focusEligible: z.boolean(),
} ).strict();

/**
 * Navigation-origin participant supplied with a protected visit attempt.
 * @since 0.1.0 Initial implementation.
 */
export type VisitAttemptParticipant = z.infer<typeof VisitAttemptParticipantSchema>;
