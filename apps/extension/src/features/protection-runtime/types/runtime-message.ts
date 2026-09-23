import { z } from 'zod';
import {
	AllowanceIdSchema,
	DurationMillisecondsSchema,
	EpochMillisecondsSchema,
} from '../../../domains/protection/types/protection-value';

/**
 * Dedicated command sent to an interruption document before releasing it.
 * @since 1.0.0 Initial implementation.
 */
export const InterruptionNavigationReplacementMessageType = {
	REPLACE: 'replace-interruption-navigation',
} as const;

/**
 * Validates the exact source document and HTTP(S) destination selected by the background.
 * @since 1.0.0 Initial implementation.
 */
export const InterruptionNavigationReplacementRequestSchema = z.object( {
	type: z.literal( InterruptionNavigationReplacementMessageType.REPLACE ),
	sourceUrl: z.string(),
	url: z.string(),
} ).strict();

/**
 * Background-to-page command that preserves native history during an authorized release.
 * @since 1.0.0 Initial implementation.
 */
export type InterruptionNavigationReplacementRequest = z.infer<
	typeof InterruptionNavigationReplacementRequestSchema
>;

/**
 * Validates the acknowledgement emitted before the interruption document replaces itself.
 * @since 1.0.0 Initial implementation.
 */
export const InterruptionNavigationReplacementResponseSchema = z.object( {
	replaced: z.literal( true ),
} ).strict();

/**
 * Positive acknowledgement from the exact interruption document selected for release.
 * @since 1.0.0 Initial implementation.
 */
export type InterruptionNavigationReplacementResponse = z.infer<
	typeof InterruptionNavigationReplacementResponseSchema
>;

/**
 * Validates the destination-resolution handshake before a redirect document mounts its UI.
 * The destination is taken from the browser sender, never supplied as a message field.
 * @since 1.0.0 Initial implementation.
 */
export const NavigationRedirectRequestSchema = z.object( {
	type: z.literal( 'resolve-navigation-redirect' ),
} ).strict();

/**
 * Destination permitted by authoritative navigation reconciliation, or an unavailable result.
 * @since 1.0.0 Initial implementation.
 */
export interface NavigationRedirectResponse {
	/** Exact replacement document; the page also checks it against its own original destination. */
	url: string | null;
}

/**
 * Requests supported by the extension-owned interruption page.
 * @since 1.0.0 Initial implementation.
 */
export const InterruptionPageRequestType = {
	CHECKPOINT: 'checkpoint',
	CONNECT: 'connect',
	CONTINUE: 'continue',
	RECOVER: 'recover',
	SYNCHRONIZE: 'synchronize',
} as const;

/**
 * Validates an interruption-page request discriminator.
 * @since 1.0.0 Initial implementation.
 */
export const InterruptionPageRequestTypeSchema = z.enum( InterruptionPageRequestType );

/**
 * Interruption-page request discriminator.
 * @since 1.0.0 Initial implementation.
 */
export type InterruptionPageRequestType = z.infer<typeof InterruptionPageRequestTypeSchema>;

/**
 * Validates an interruption-page connection request.
 * @since 1.0.0 Initial implementation.
 */
export const ConnectInterruptionPageRequestSchema = z.object( {
	type: z.enum( [ InterruptionPageRequestType.CONNECT ] ),
	documentVisible: z.boolean(),
} ).strict();

/**
 * Interruption-page connection request.
 * @since 1.0.0 Initial implementation.
 */
export type ConnectInterruptionPageRequest = z.infer<typeof ConnectInterruptionPageRequestSchema>;

/**
 * Validates an explicit interruption-page runtime recovery request.
 * @since 1.0.0 Initial implementation.
 */
export const RecoverInterruptionPageRequestSchema = z.object( {
	type: z.enum( [ InterruptionPageRequestType.RECOVER ] ),
	documentVisible: z.boolean(),
} ).strict();

/**
 * Explicit interruption-page runtime recovery request.
 * @since 1.0.0 Initial implementation.
 */
export type RecoverInterruptionPageRequest = z.infer<typeof RecoverInterruptionPageRequestSchema>;

/**
 * Validates an interruption-page synchronization request.
 * @since 1.0.0 Initial implementation.
 */
export const SynchronizeInterruptionPageRequestSchema = z.object( {
	type: z.enum( [ InterruptionPageRequestType.SYNCHRONIZE ] ),
	documentVisible: z.boolean(),
} ).strict();

/**
 * Interruption-page synchronization request.
 * @since 1.0.0 Initial implementation.
 */
export type SynchronizeInterruptionPageRequest = z.infer<typeof SynchronizeInterruptionPageRequestSchema>;

/**
 * Validates an interruption-page progress checkpoint.
 * @since 1.0.0 Initial implementation.
 */
export const CheckpointInterruptionPageRequestSchema = z.object( {
	type: z.enum( [ InterruptionPageRequestType.CHECKPOINT ] ),
	documentVisible: z.boolean(),
	displayedFocusedDurationMilliseconds: DurationMillisecondsSchema,
} ).strict();

/**
 * Interruption-page progress checkpoint.
 * @since 1.0.0 Initial implementation.
 */
export type CheckpointInterruptionPageRequest = z.infer<typeof CheckpointInterruptionPageRequestSchema>;

/**
 * Validates an interruption-page Continue request.
 * @since 1.0.0 Initial implementation.
 */
export const ContinueInterruptionPageRequestSchema = z.object( {
	type: z.enum( [ InterruptionPageRequestType.CONTINUE ] ),
	documentVisible: z.boolean(),
} ).strict();

/**
 * Interruption-page Continue request.
 * @since 1.0.0 Initial implementation.
 */
export type ContinueInterruptionPageRequest = z.infer<typeof ContinueInterruptionPageRequestSchema>;

/**
 * Validates every request accepted from an interruption page.
 * @since 1.0.0 Initial implementation.
 */
export const InterruptionPageRequestSchema = z.discriminatedUnion( 'type', [
	ConnectInterruptionPageRequestSchema,
	RecoverInterruptionPageRequestSchema,
	SynchronizeInterruptionPageRequestSchema,
	CheckpointInterruptionPageRequestSchema,
	ContinueInterruptionPageRequestSchema,
] );

/**
 * Request accepted from an interruption page.
 * @since 1.0.0 Initial implementation.
 */
export type InterruptionPageRequest = z.infer<typeof InterruptionPageRequestSchema>;

/**
 * Protected-page requests that reconcile authoritative wall-clock state.
 * @since 1.0.0 Initial implementation.
 */
export const ProtectionClockRequestType = {
	RECONCILE_ALLOWANCE_EXPIRY: 'reconcile-allowance-expiry',
} as const;

/**
 * Validates a protected-page clock-reconciliation request discriminator.
 * @since 1.0.0 Initial implementation.
 */
export const ProtectionClockRequestTypeSchema = z.enum( ProtectionClockRequestType );

/**
 * Protected-page clock-reconciliation request discriminator.
 * @since 1.0.0 Initial implementation.
 */
export type ProtectionClockRequestType = z.infer<typeof ProtectionClockRequestTypeSchema>;

/**
 * Validates a local allowance-expiry reconciliation request.
 * @since 1.0.0 Initial implementation.
 */
export const ProtectionClockRequestSchema = z.object( {
	type: ProtectionClockRequestTypeSchema,
	allowanceId: AllowanceIdSchema,
} ).strict();

/**
 * Allowance-keyed request for authoritative wall-clock reconciliation.
 * @since 1.0.0 Initial implementation.
 */
export type ProtectionClockRequest = z.infer<typeof ProtectionClockRequestSchema>;

/**
 * Presentation states returned to the interruption page.
 * @since 1.0.0 Initial implementation.
 */
export const InterruptionPageResponseState = {
	RELEASED: 'released',
	READY: 'ready',
	READY_EXPIRED: 'ready-expired',
	UNAVAILABLE: 'unavailable',
	WAITING: 'waiting',
} as const;

/**
 * Validates an interruption-page response discriminator.
 * @since 1.0.0 Initial implementation.
 */
export const InterruptionPageResponseStateSchema = z.enum( InterruptionPageResponseState );

/**
 * Interruption-page response discriminator.
 * @since 1.0.0 Initial implementation.
 */
export type InterruptionPageResponseState = z.infer<typeof InterruptionPageResponseStateSchema>;

/**
 * Validates an authoritative Waiting presentation.
 * @since 1.0.0 Initial implementation.
 */
export const WaitingInterruptionPageResponseSchema = z.object( {
	state: z.enum( [ InterruptionPageResponseState.WAITING ] ),
	capturedWaitDurationMilliseconds: DurationMillisecondsSchema,
	focusedProgressMilliseconds: DurationMillisecondsSchema,
	progressing: z.boolean(),
} ).strict();

/**
 * Authoritative Waiting presentation.
 * @since 1.0.0 Initial implementation.
 */
export type WaitingInterruptionPageResponse = z.infer<typeof WaitingInterruptionPageResponseSchema>;

/**
 * Validates an authoritative Ready presentation.
 * @since 1.0.0 Initial implementation.
 */
export const ReadyInterruptionPageResponseSchema = z.object( {
	state: z.enum( [ InterruptionPageResponseState.READY ] ),
	allowanceExpiresAtEpochMilliseconds: EpochMillisecondsSchema.nullable(),
} ).strict();

/**
 * Authoritative Ready presentation.
 * @since 1.0.0 Initial implementation.
 */
export type ReadyInterruptionPageResponse = z.infer<typeof ReadyInterruptionPageResponseSchema>;

/**
 * Validates a Ready page whose visit window has elapsed.
 * @since 1.0.0 Initial implementation.
 */
export const ReadyExpiredInterruptionPageResponseSchema = z.object( {
	state: z.enum( [ InterruptionPageResponseState.READY_EXPIRED ] ),
} ).strict();

/**
 * Ready page whose visit window has elapsed.
 * @since 1.0.0 Initial implementation.
 */
export type ReadyExpiredInterruptionPageResponse = z.infer<typeof ReadyExpiredInterruptionPageResponseSchema>;

/**
 * Validates an interruption page without recoverable runtime context.
 * @since 1.0.0 Initial implementation.
 */
export const UnavailableInterruptionPageResponseSchema = z.object( {
	state: z.enum( [ InterruptionPageResponseState.UNAVAILABLE ] ),
} ).strict();

/**
 * Interruption page without recoverable runtime context.
 * @since 1.0.0 Initial implementation.
 */
export type UnavailableInterruptionPageResponse = z.infer<typeof UnavailableInterruptionPageResponseSchema>;

/**
 * Validates an acknowledgement that the participant's interruption was released.
 * @since 1.0.0 Initial implementation.
 */
export const ReleasedInterruptionPageResponseSchema = z.object( {
	state: z.enum( [ InterruptionPageResponseState.RELEASED ] ),
} ).strict();

/**
 * Acknowledgement that the participant's interruption was released.
 * @since 1.0.0 Initial implementation.
 */
export type ReleasedInterruptionPageResponse = z.infer<typeof ReleasedInterruptionPageResponseSchema>;

/**
 * Validates every response returned to an interruption page.
 * @since 1.0.0 Initial implementation.
 */
export const InterruptionPageResponseSchema = z.discriminatedUnion( 'state', [
	ReleasedInterruptionPageResponseSchema,
	WaitingInterruptionPageResponseSchema,
	ReadyInterruptionPageResponseSchema,
	ReadyExpiredInterruptionPageResponseSchema,
	UnavailableInterruptionPageResponseSchema,
] );

/**
 * Response returned to an interruption page.
 * @since 1.0.0 Initial implementation.
 */
export type InterruptionPageResponse = z.infer<typeof InterruptionPageResponseSchema>;
