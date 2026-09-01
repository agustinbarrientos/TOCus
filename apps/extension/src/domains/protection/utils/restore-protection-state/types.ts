import { z } from 'zod';
import {
	AllowanceIdSchema,
	EpochMillisecondsSchema,
	PageIdSchema,
	ParticipantIdSchema,
	ProtectionScopeIdSchema,
	SessionContinuityIdSchema,
} from '../../types/protection-value';
import { ProtectionDecisionSchema } from '../../types/protection-decision';
import { FreshParticipantObservationSchema } from '../../types/protection-event';
import { ProtectionStateSchema } from '../../types/protection-state';
import {
	ParsedStoredProtectionStateSchema,
	StoredProtectionStateFailureReasonSchema,
} from '../parse-stored-protection-state';

/**
 * Explicit modes for restoring runtime protection state.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionStateRestoreMode = {
	NEW_SESSION: 'new-session',
	CONTINUED_SESSION: 'continued-session',
} as const;

/**
 * Validates an explicit runtime protection-state restore mode.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionStateRestoreModeSchema = z.enum( ProtectionStateRestoreMode );

/**
 * Explicit runtime protection-state restore mode.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionStateRestoreMode = z.infer<typeof ProtectionStateRestoreModeSchema>;

/**
 * Outcomes produced by runtime protection-state restoration.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionStateRestoreStatus = {
	RESTORED: 'restored',
	RECONCILIATION_REQUIRED: 'reconciliation-required',
	FAILURE: 'failure',
} as const;

/**
 * Validates a runtime protection-state restoration outcome.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionStateRestoreStatusSchema = z.enum( ProtectionStateRestoreStatus );

/**
 * Runtime protection-state restoration outcome.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionStateRestoreStatus = z.infer<typeof ProtectionStateRestoreStatusSchema>;

/**
 * Stable reasons that one Ready participant still needs reconciliation.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionStateReconciliationRequirementReason = {
	OBSERVATION_UNAVAILABLE: 'observation-unavailable',
	OBSERVATION_REJECTED: 'observation-rejected',
} as const;

/**
 * Validates a stable Ready reconciliation requirement reason.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionStateReconciliationRequirementReasonSchema = z.enum(
	ProtectionStateReconciliationRequirementReason,
);

/**
 * Stable reason that one Ready participant still needs reconciliation.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionStateReconciliationRequirementReason = z.infer<
	typeof ProtectionStateReconciliationRequirementReasonSchema
>;

/**
 * Validates runtime protection states indexed by their scope identifiers.
 * @since 0.1.0 Initial implementation.
 */
const RestoredProtectionStatesByScopeSchema = z.preprocess(
	( input ) => {
		if ( typeof input !== 'object' || input === null || Array.isArray( input ) ) {
			return null;
		}

		const prototype: unknown = Object.getPrototypeOf( input );

		if ( prototype !== Object.prototype && prototype !== null ) {
			return null;
		}

		return Object.entries( input );
	},
	z.array( z.tuple( [ ProtectionScopeIdSchema, ProtectionStateSchema ] ) ),
).transform( ( entries ) => Object.fromEntries( entries ) ).superRefine( ( statesByScope, context ) => {
	Object.entries( statesByScope ).forEach( ( [ scopeId, state ] ) => {
		if ( scopeId !== state.scopeId ) {
			context.addIssue( {
				code: 'custom',
				message: 'A restored-state record key must equal its contained scope identifier.',
				path: [ scopeId, 'scopeId' ],
			} );
		}
	} );
} );

/**
 * Validates one fresh Ready observation with durable transaction identity.
 * @since 0.1.0 Initial implementation.
 */
export const ReadyProtectionStateRestoreObservationSchema = z.object( {
	scopeId: ProtectionScopeIdSchema,
	allowanceId: AllowanceIdSchema,
	observation: FreshParticipantObservationSchema,
} ).strict();

/**
 * Fresh Ready observation with durable transaction identity.
 * @since 0.1.0 Initial implementation.
 */
export type ReadyProtectionStateRestoreObservation = z.infer<
	typeof ReadyProtectionStateRestoreObservationSchema
>;

/**
 * Validates uniquely identified Ready observations supplied during restoration.
 * @since 0.1.0 Initial implementation.
 */
const ReadyProtectionStateRestoreObservationsSchema = z.array(
	ReadyProtectionStateRestoreObservationSchema,
).superRefine( ( observations, context ) => {
	const identities = new Set<string>();

	observations.forEach( ( readyObservation, index ) => {
		const identity = JSON.stringify( [
			readyObservation.scopeId,
			readyObservation.allowanceId,
			readyObservation.observation.participantId,
			readyObservation.observation.pageId,
		] );

		if ( identities.has( identity ) ) {
			context.addIssue( {
				code: 'custom',
				message: 'Ready observation identities must be unique.',
				path: [ index ],
			} );
		}

		identities.add( identity );
	} );
} );

/**
 * Validates a new-session runtime protection-state restore input.
 * @since 0.1.0 Initial implementation.
 */
const NewSessionProtectionStateRestoreInputSchema = z.object( {
	mode: z.enum( [ ProtectionStateRestoreMode.NEW_SESSION ] ),
	parsedState: ParsedStoredProtectionStateSchema,
	nowEpochMilliseconds: EpochMillisecondsSchema,
} ).strict();

/**
 * Validates a continued-session runtime protection-state restore input.
 * @since 0.1.0 Initial implementation.
 */
const ContinuedSessionProtectionStateRestoreInputSchema = z.object( {
	mode: z.enum( [ ProtectionStateRestoreMode.CONTINUED_SESSION ] ),
	parsedState: ParsedStoredProtectionStateSchema,
	nowEpochMilliseconds: EpochMillisecondsSchema,
	sessionContinuityId: SessionContinuityIdSchema,
	readyObservations: ReadyProtectionStateRestoreObservationsSchema,
} ).strict();

/**
 * Validates an explicit runtime protection-state restore input.
 * @since 0.1.0 Initial implementation.
 */
export const RestoreProtectionStateInputSchema = z.discriminatedUnion( 'mode', [
	NewSessionProtectionStateRestoreInputSchema,
	ContinuedSessionProtectionStateRestoreInputSchema,
] );

/**
 * Explicit runtime protection-state restore input.
 * @since 0.1.0 Initial implementation.
 */
export type RestoreProtectionStateInput = z.infer<typeof RestoreProtectionStateInputSchema>;

/**
 * Validates one unresolved Ready reconciliation requirement.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionStateReconciliationRequirementSchema = z.object( {
	scopeId: ProtectionScopeIdSchema,
	allowanceId: AllowanceIdSchema,
	participantId: ParticipantIdSchema,
	pageId: PageIdSchema,
	reason: ProtectionStateReconciliationRequirementReasonSchema,
} ).strict();

/**
 * Unresolved Ready reconciliation requirement.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionStateReconciliationRequirement = z.infer<
	typeof ProtectionStateReconciliationRequirementSchema
>;

/**
 * Validates an empty restoration collection.
 * @since 0.1.0 Initial implementation.
 */
const EmptyProtectionStateRestoreCollectionSchema = z.tuple( [] );

/**
 * Validates an empty runtime-state mapping.
 * @since 0.1.0 Initial implementation.
 */
const EmptyRestoredProtectionStatesByScopeSchema = RestoredProtectionStatesByScopeSchema.refine(
	( statesByScope ) => Object.keys( statesByScope ).length === 0,
);

/**
 * Validates a successful runtime protection-state restore result.
 * @since 0.1.0 Initial implementation.
 */
const RestoredProtectionStateResultSchema = z.object( {
	status: z.enum( [ ProtectionStateRestoreStatus.RESTORED ] ),
	statesByScope: RestoredProtectionStatesByScopeSchema,
	decisions: z.array( ProtectionDecisionSchema ),
	facts: EmptyProtectionStateRestoreCollectionSchema,
	requirements: EmptyProtectionStateRestoreCollectionSchema,
} ).strict();

/**
 * Validates a runtime protection-state result requiring reconciliation.
 * @since 0.1.0 Initial implementation.
 */
const ReconciliationRequiredProtectionStateResultSchema = z.object( {
	status: z.enum( [ ProtectionStateRestoreStatus.RECONCILIATION_REQUIRED ] ),
	statesByScope: RestoredProtectionStatesByScopeSchema,
	decisions: z.array( ProtectionDecisionSchema ),
	facts: EmptyProtectionStateRestoreCollectionSchema,
	requirements: z.array( ProtectionStateReconciliationRequirementSchema ).min( 1 ),
} ).strict();

/**
 * Validates a failed runtime protection-state restore result.
 * @since 0.1.0 Initial implementation.
 */
const FailedProtectionStateRestoreResultSchema = z.object( {
	status: z.enum( [ ProtectionStateRestoreStatus.FAILURE ] ),
	reason: StoredProtectionStateFailureReasonSchema,
	statesByScope: EmptyRestoredProtectionStatesByScopeSchema,
	decisions: EmptyProtectionStateRestoreCollectionSchema,
	facts: EmptyProtectionStateRestoreCollectionSchema,
	requirements: EmptyProtectionStateRestoreCollectionSchema,
} ).strict();

/**
 * Validates every runtime protection-state restore result with structurally empty facts.
 * @since 0.1.0 Initial implementation.
 */
export const RestoreProtectionStateResultSchema = z.discriminatedUnion( 'status', [
	RestoredProtectionStateResultSchema,
	ReconciliationRequiredProtectionStateResultSchema,
	FailedProtectionStateRestoreResultSchema,
] );

/**
 * Complete runtime protection-state restore result.
 * @since 0.1.0 Initial implementation.
 */
export type RestoreProtectionStateResult = z.infer<typeof RestoreProtectionStateResultSchema>;
