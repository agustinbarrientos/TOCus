import { z } from 'zod';
import {
	AllowanceIdSchema,
	EpochMillisecondsSchema,
} from '../../../domains/protection/types/protection-value';

/**
 * Commands exchanged with an authorized protected top-level document.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectedPageMessageType = {
	GET_PRESENTATION_STATUS: 'get-protected-page-presentation-status',
	REMOVE_ALLOWANCE_EXPIRY_GUARD: 'remove-allowance-expiry-guard',
	REMOVE_ALLOWANCE_WARNING: 'remove-allowance-warning',
	REMOVE_INTERRUPTION_LAYER: 'remove-interruption-layer',
	PRESENT_ALLOWANCE_WARNING: 'present-allowance-warning',
	PRESENT_INTERRUPTION_LAYER: 'present-interruption-layer',
	SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD: 'synchronize-allowance-expiry-guard',
} as const;

/**
 * Validates a protected-page command discriminator.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectedPageMessageTypeSchema = z.enum( ProtectedPageMessageType );

/**
 * Protected-page command discriminator.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectedPageMessageType = z.infer<typeof ProtectedPageMessageTypeSchema>;

/**
 * Validates a request for the current protected-page presentation status.
 * @since 0.1.0 Initial implementation.
 */
export const GetProtectedPagePresentationStatusMessageSchema = z.object( {
	type: z.enum( [ ProtectedPageMessageType.GET_PRESENTATION_STATUS ] ),
} ).strict();

/**
 * Request for the current protected-page presentation status.
 * @since 0.1.0 Initial implementation.
 */
export type GetProtectedPagePresentationStatusMessage = z.infer<
	typeof GetProtectedPagePresentationStatusMessageSchema
>;

/**
 * Validates a command to present the quiet final allowance warning.
 * @since 0.1.0 Initial implementation.
 */
export const PresentAllowanceWarningMessageSchema = z.object( {
	type: z.enum( [ ProtectedPageMessageType.PRESENT_ALLOWANCE_WARNING ] ),
	allowanceId: AllowanceIdSchema,
	expiresAtEpochMilliseconds: EpochMillisecondsSchema,
} ).strict();

/**
 * Command to present the quiet final allowance warning.
 * @since 0.1.0 Initial implementation.
 */
export type PresentAllowanceWarningMessage = z.infer<typeof PresentAllowanceWarningMessageSchema>;

/**
 * Validates a command to remove one exact allowance warning.
 * @since 0.1.0 Initial implementation.
 */
export const RemoveAllowanceWarningMessageSchema = z.object( {
	type: z.enum( [ ProtectedPageMessageType.REMOVE_ALLOWANCE_WARNING ] ),
	allowanceId: AllowanceIdSchema,
} ).strict();

/**
 * Command to remove one exact allowance warning.
 * @since 0.1.0 Initial implementation.
 */
export type RemoveAllowanceWarningMessage = z.infer<typeof RemoveAllowanceWarningMessageSchema>;

/**
 * Validates a command to arm one allowance-keyed local expiry guard and optional warning boundary.
 * @since 0.1.0 Initial implementation.
 */
export const SynchronizeAllowanceExpiryGuardMessageSchema = z.object( {
	type: z.enum( [ ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD ] ),
	allowanceId: AllowanceIdSchema,
	expiresAtEpochMilliseconds: EpochMillisecondsSchema,
	warningStartsAtEpochMilliseconds: z.union( [ EpochMillisecondsSchema, z.null() ] ),
	warningEndsAtEpochMilliseconds: z.union( [ EpochMillisecondsSchema, z.null() ] ),
} ).strict().superRefine( ( message, context ) => {
	if (
		( message.warningStartsAtEpochMilliseconds === null ) !==
		( message.warningEndsAtEpochMilliseconds === null )
	) {
		context.addIssue( {
			code: 'custom',
			message: 'Warning boundaries must both be present or both be absent.',
			path: [ 'warningEndsAtEpochMilliseconds' ],
		} );
		return;
	}

	if (
		message.warningStartsAtEpochMilliseconds !== null &&
		message.warningEndsAtEpochMilliseconds !== null &&
		message.warningStartsAtEpochMilliseconds >= message.warningEndsAtEpochMilliseconds
	) {
		context.addIssue( {
			code: 'custom',
			message: 'The warning end must follow its start.',
			path: [ 'warningEndsAtEpochMilliseconds' ],
		} );
	}

	if (
		message.warningEndsAtEpochMilliseconds !== null &&
		message.warningEndsAtEpochMilliseconds > message.expiresAtEpochMilliseconds
	) {
		context.addIssue( {
			code: 'custom',
			message: 'The warning cannot outlive its allowance.',
			path: [ 'warningEndsAtEpochMilliseconds' ],
		} );
	}
} );

/**
 * Command to arm one allowance-keyed local expiry guard and optional warning boundary.
 * @since 0.1.0 Initial implementation.
 */
export type SynchronizeAllowanceExpiryGuardMessage = z.infer<
	typeof SynchronizeAllowanceExpiryGuardMessageSchema
>;

/**
 * Validates a command to clear the current local allowance-expiry guard.
 * @since 0.1.0 Initial implementation.
 */
export const RemoveAllowanceExpiryGuardMessageSchema = z.object( {
	type: z.enum( [ ProtectedPageMessageType.REMOVE_ALLOWANCE_EXPIRY_GUARD ] ),
} ).strict();

/**
 * Command to clear the current local allowance-expiry guard.
 * @since 0.1.0 Initial implementation.
 */
export type RemoveAllowanceExpiryGuardMessage = z.infer<typeof RemoveAllowanceExpiryGuardMessageSchema>;

/**
 * Validates a command to present the non-destructive interruption layer.
 * @since 0.1.0 Initial implementation.
 */
export const PresentInterruptionLayerMessageSchema = z.object( {
	type: z.enum( [ ProtectedPageMessageType.PRESENT_INTERRUPTION_LAYER ] ),
} ).strict();

/**
 * Command to present the non-destructive interruption layer.
 * @since 0.1.0 Initial implementation.
 */
export type PresentInterruptionLayerMessage = z.infer<typeof PresentInterruptionLayerMessageSchema>;

/**
 * Validates a command to remove the non-destructive interruption layer.
 * @since 0.1.0 Initial implementation.
 */
export const RemoveInterruptionLayerMessageSchema = z.object( {
	type: z.enum( [ ProtectedPageMessageType.REMOVE_INTERRUPTION_LAYER ] ),
} ).strict();

/**
 * Command to remove the non-destructive interruption layer.
 * @since 0.1.0 Initial implementation.
 */
export type RemoveInterruptionLayerMessage = z.infer<typeof RemoveInterruptionLayerMessageSchema>;

/**
 * Validates every command accepted by an authorized protected page.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectedPageMessageSchema = z.discriminatedUnion( 'type', [
	GetProtectedPagePresentationStatusMessageSchema,
	PresentAllowanceWarningMessageSchema,
	RemoveAllowanceWarningMessageSchema,
	SynchronizeAllowanceExpiryGuardMessageSchema,
	RemoveAllowanceExpiryGuardMessageSchema,
	PresentInterruptionLayerMessageSchema,
	RemoveInterruptionLayerMessageSchema,
] );

/**
 * Command accepted by an authorized protected page.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectedPageMessage = z.infer<typeof ProtectedPageMessageSchema>;

/**
 * Validates the non-sensitive presentation status returned by a protected page.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectedPagePresentationStatusSchema = z.object( {
	allowanceWarningId: z.union( [ AllowanceIdSchema, z.null() ] ),
	interruptionLayerPresented: z.boolean(),
} ).strict();

/**
 * Non-sensitive presentation status returned by a protected page.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectedPagePresentationStatus = z.infer<typeof ProtectedPagePresentationStatusSchema>;
