import { z } from 'zod';
import { ProtectionDecisionSchema } from '../../types/protection-decision';
import { ProtectionFactSchema } from '../../types/protection-fact';
import { type ProtectionState } from '../../types/protection-state';
import { type StoredProtectionStatisticsDelivery } from '../../types/stored-protection-statistics-delivery';
import {
	EpochMillisecondsSchema,
	type SessionContinuityId,
} from '../../types/protection-value';
import {
	ProtectionStateReconciliationRequirementSchema,
	ReadyProtectionStateRestoreObservationSchema,
} from '../../utils/restore-protection-state';
import { type ProtectionStorageService } from '../protection-storage';

/**
 * Outcomes of protection coordinator initialization.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionCoordinatorInitializationStatus = {
	READY: 'ready',
	RECONCILIATION_REQUIRED: 'reconciliation-required',
	FAILED: 'failed',
} as const;

/**
 * Validates a protection coordinator initialization outcome.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionCoordinatorInitializationStatusSchema = z.enum(
	ProtectionCoordinatorInitializationStatus,
);

/**
 * Protection coordinator initialization outcome.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionCoordinatorInitializationStatus = z.infer<
	typeof ProtectionCoordinatorInitializationStatusSchema
>;

/**
 * Outcomes of one protection coordinator dispatch.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionCoordinatorDispatchStatus = {
	APPLIED: 'applied',
	REJECTED: 'rejected',
} as const;

/**
 * Validates one protection coordinator dispatch outcome.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionCoordinatorDispatchStatusSchema = z.enum( ProtectionCoordinatorDispatchStatus );

/**
 * Protection coordinator dispatch outcome.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionCoordinatorDispatchStatus = z.infer<typeof ProtectionCoordinatorDispatchStatusSchema>;

/**
 * Stable reasons for rejected coordinator operations.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionCoordinatorFailureReason = {
	STORAGE_READ_FAILED: 'storage-read-failed',
	STORAGE_WRITE_FAILED: 'storage-write-failed',
	INVALID_DURABLE_STATE: 'invalid-durable-state',
	NOT_INITIALIZED: 'not-initialized',
	UNKNOWN_SCOPE: 'unknown-scope',
	INVALID_EVENT: 'invalid-event',
} as const;

/**
 * Validates a stable coordinator operation failure reason.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionCoordinatorFailureReasonSchema = z.enum( ProtectionCoordinatorFailureReason );

/**
 * Stable coordinator operation failure reason.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionCoordinatorFailureReason = z.infer<typeof ProtectionCoordinatorFailureReasonSchema>;

/**
 * Validates explicit observations supplied during coordinator initialization.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionCoordinatorInitializationInputSchema = z.object( {
	nowEpochMilliseconds: EpochMillisecondsSchema,
	readyObservations: z.array( ReadyProtectionStateRestoreObservationSchema ),
} ).strict();

/**
 * Explicit observations supplied during coordinator initialization.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionCoordinatorInitializationInput = z.infer<
	typeof ProtectionCoordinatorInitializationInputSchema
>;

/**
 * Validates an empty coordinator result collection.
 * @since 0.1.0 Initial implementation.
 */
const EmptyProtectionCoordinatorCollectionSchema = z.tuple( [] );

/**
 * Validates completed coordinator initialization.
 * @since 0.1.0 Initial implementation.
 */
const ReadyProtectionCoordinatorInitializationResultSchema = z.object( {
	status: z.enum( [ ProtectionCoordinatorInitializationStatus.READY ] ),
	decisions: z.array( ProtectionDecisionSchema ),
	facts: EmptyProtectionCoordinatorCollectionSchema,
	requirements: EmptyProtectionCoordinatorCollectionSchema,
} ).strict();

/**
 * Validates initialization with unresolved Ready observations.
 * @since 0.1.0 Initial implementation.
 */
const ReconciliationProtectionCoordinatorInitializationResultSchema = z.object( {
	status: z.enum( [ ProtectionCoordinatorInitializationStatus.RECONCILIATION_REQUIRED ] ),
	decisions: z.array( ProtectionDecisionSchema ),
	facts: EmptyProtectionCoordinatorCollectionSchema,
	requirements: z.array( ProtectionStateReconciliationRequirementSchema ).min( 1 ),
} ).strict();

/**
 * Validates failed coordinator initialization.
 * @since 0.1.0 Initial implementation.
 */
const FailedProtectionCoordinatorInitializationResultSchema = z.object( {
	status: z.enum( [ ProtectionCoordinatorInitializationStatus.FAILED ] ),
	reason: z.enum( [
		ProtectionCoordinatorFailureReason.STORAGE_READ_FAILED,
		ProtectionCoordinatorFailureReason.STORAGE_WRITE_FAILED,
		ProtectionCoordinatorFailureReason.INVALID_DURABLE_STATE,
	] ),
	decisions: EmptyProtectionCoordinatorCollectionSchema,
	facts: EmptyProtectionCoordinatorCollectionSchema,
	requirements: EmptyProtectionCoordinatorCollectionSchema,
} ).strict();

/**
 * Validates every protection coordinator initialization result.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionCoordinatorInitializationResultSchema = z.discriminatedUnion( 'status', [
	ReadyProtectionCoordinatorInitializationResultSchema,
	ReconciliationProtectionCoordinatorInitializationResultSchema,
	FailedProtectionCoordinatorInitializationResultSchema,
] );

/**
 * Complete protection coordinator initialization result.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionCoordinatorInitializationResult = z.infer<
	typeof ProtectionCoordinatorInitializationResultSchema
>;

/**
 * Validates one persisted protection event result.
 * @since 0.1.0 Initial implementation.
 */
const AppliedProtectionCoordinatorDispatchResultSchema = z.object( {
	status: z.enum( [ ProtectionCoordinatorDispatchStatus.APPLIED ] ),
	decisions: z.array( ProtectionDecisionSchema ),
	facts: z.array( ProtectionFactSchema ),
} ).strict();

/**
 * Validates one rejected protection event result.
 * @since 0.1.0 Initial implementation.
 */
const RejectedProtectionCoordinatorDispatchResultSchema = z.object( {
	status: z.enum( [ ProtectionCoordinatorDispatchStatus.REJECTED ] ),
	reason: z.enum( [
		ProtectionCoordinatorFailureReason.STORAGE_WRITE_FAILED,
		ProtectionCoordinatorFailureReason.NOT_INITIALIZED,
		ProtectionCoordinatorFailureReason.UNKNOWN_SCOPE,
		ProtectionCoordinatorFailureReason.INVALID_EVENT,
	] ),
	decisions: EmptyProtectionCoordinatorCollectionSchema,
	facts: EmptyProtectionCoordinatorCollectionSchema,
} ).strict();

/**
 * Validates every protection coordinator dispatch result.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionCoordinatorDispatchResultSchema = z.discriminatedUnion( 'status', [
	AppliedProtectionCoordinatorDispatchResultSchema,
	RejectedProtectionCoordinatorDispatchResultSchema,
] );

/**
 * Complete protection coordinator dispatch result.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionCoordinatorDispatchResult = z.infer<typeof ProtectionCoordinatorDispatchResultSchema>;

/**
 * Detached runtime states indexed by protection scope.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionCoordinatorStateSnapshot = Readonly<Record<string, ProtectionState>>;

/**
 * Detached durable statistics delivery returned by the protection coordinator.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionCoordinatorStatisticsDeliverySnapshot = StoredProtectionStatisticsDelivery;

/**
 * Immutable FIFO boundary captured after one authoritative protection operation.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionCoordinatorStatisticsDeliveryBoundary {
	lastBatchId: StoredProtectionStatisticsDelivery[ 'outbox' ][ number ][ 'batchId' ] | null;
}

/**
 * Collects current browser observations and creates one event while coordinator serialization is held.
 * @param statesByScope - Detached current states available to atomic event preparation.
 * @return Unknown event value, which may be asynchronous.
 * @since 0.1.0 Initial implementation.
 */
export type PrepareProtectionEvent = (
	statesByScope: ProtectionCoordinatorStateSnapshot,
) => unknown;

/**
 * Dependencies used by one protection coordinator instance.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionCoordinatorOptions {
	storage: ProtectionStorageService;

	/**
	 * Creates a fresh browser-session continuity identifier.
	 * @return Fresh continuity identifier.
	 * @since 0.1.0 Initial implementation.
	 */
	createSessionContinuityId(): string;

	/**
	 * Creates a fresh protection-fact batch identifier.
	 * @return Unknown identifier value for validation at the coordinator boundary.
	 * @since 0.1.0 Initial implementation.
	 */
	createProtectionFactBatchId(): unknown;
}

/**
 * Serialized protection runtime operations.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionCoordinator {
	/**
	 * Acknowledges and durably removes one exact head statistics-delivery batch.
	 * @param batchId - Unknown candidate head batch identifier.
	 * @return True only after the matching head is durably removed.
	 * @throws {Error} When durable-only persistence rejects unexpectedly.
	 * @since 0.1.0 Initial implementation.
	 */
	acknowledgeStatisticsDeliveryBatch( batchId: unknown ): Promise<boolean>;

	/**
	 * Completes one empty incomplete statistics-delivery reset.
	 * @return True only after the completion is durably stored.
	 * @throws {Error} When durable-only persistence rejects unexpectedly.
	 * @since 0.1.0 Initial implementation.
	 */
	completeStatisticsDeliveryReset(): Promise<boolean>;

	/**
	 * Returns detached statistics delivery after every earlier queued operation has settled.
	 * @return Current durable delivery, or null before successful initialization.
	 * @since 0.1.0 Initial implementation.
	 */
	getStatisticsDelivery(): Promise<ProtectionCoordinatorStatisticsDeliverySnapshot | null>;

	/**
	 * Captures the current durable-delivery tail without waiting for observational statistics work.
	 * @return Current FIFO boundary, or null before successful initialization.
	 * @since 0.1.0 Initial implementation.
	 */
	getStatisticsDeliveryBoundary(): ProtectionCoordinatorStatisticsDeliveryBoundary | null;

	/**
	 * Returns the current browser-session continuity identifier without entering the queue.
	 * @return Current continuity identifier, or null before successful initialization.
	 * @since 0.1.0 Initial implementation.
	 */
	getSessionContinuityId(): SessionContinuityId | null;

	/**
	 * Clears queued statistics facts under an incomplete durable reset marker.
	 * @return True only after the incomplete empty delivery is durably stored.
	 * @throws {Error} When durable-only persistence rejects unexpectedly.
	 * @since 0.1.0 Initial implementation.
	 */
	resetStatisticsDelivery(): Promise<boolean>;

	/**
	 * Returns a detached snapshot after every earlier queued operation has settled.
	 * @return Current runtime states, or null before successful initialization.
	 * @since 0.1.0 Initial implementation.
	 */
	getStates(): Promise<ProtectionCoordinatorStateSnapshot | null>;

	/**
	 * Restores and normalizes persisted protection state.
	 * @param input - Unknown initialization observations.
	 * @return Validated initialization result after persistence.
	 * @throws {Error} When input validation or a domain invariant fails unexpectedly.
	 * @since 0.1.0 Initial implementation.
	 */
	initialize( input: unknown ): Promise<ProtectionCoordinatorInitializationResult>;

	/**
	 * Prepares, applies, and persists one protection event inside the serialized queue.
	 * @param prepareEvent - Deferred event preparation with current browser observations.
	 * @param measurementRevision - Optional measurement revision used only when the transition emits facts.
	 * @return Validated dispatch result after persistence.
	 * @throws {Error} When event preparation rejects or a domain invariant fails unexpectedly.
	 * @since 0.1.0 Initial implementation.
	 */
	dispatch(
		prepareEvent: PrepareProtectionEvent,
		measurementRevision?: unknown,
	): Promise<ProtectionCoordinatorDispatchResult>;
}
