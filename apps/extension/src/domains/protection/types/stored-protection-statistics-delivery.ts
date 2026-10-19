import { z, type RefinementCtx } from 'zod';
import { ProtectionFactBatchSchema } from './protection-fact-batch';
import { ContinuedVisitFactInputSchema } from './protection-fact';
import { CanonicalHostSchema } from './protected-site-rule';
import { EpochMillisecondsSchema, LocalDateSchema, ProtectionMeasurementRevisionSchema } from './protection-value';

/**
 * Exact paused navigation participant whose browser release may be acknowledged once.
 * @since 1.0.0 Initial implementation.
 */
export const ProtectionContinuationIdentitySchema = ContinuedVisitFactInputSchema.pick( {
	scopeId: true, allowanceId: true, participantId: true, pageId: true,
} );
/**
 * Bounded delivery work contains a configured host, never a retained destination URL.
 * @since 1.0.0 Initial implementation.
 */
export const PendingProtectionContinuationSchema = ProtectionContinuationIdentitySchema.extend( {
	siteHost: CanonicalHostSchema,
	measurementRevision: ProtectionMeasurementRevisionSchema,
} );
/**
 * Browser acceptance observed before asynchronous statistics delivery.
 * @since 1.0.0 Initial implementation.
 */
export const ProtectionContinuationAcceptanceSchema = ProtectionContinuationIdentitySchema.extend( {
	observedAtEpochMilliseconds: EpochMillisecondsSchema,
	observedLocalDate: LocalDateSchema,
	observedLocalHour: z.number().int().min( 0 ).max( 23 ),
} );
/**
 * Captured browser acceptance metadata before ancillary cleanup or asynchronous delivery.
 * @since 1.0.0 Initial implementation.
 */
export type ProtectionContinuationAcceptance = z.infer<typeof ProtectionContinuationAcceptanceSchema>;
/**
 * Current bounded release work, removed atomically when its accepted fact is queued.
 * @since 1.0.0 Initial implementation.
 */
export type PendingProtectionContinuation = z.infer<typeof PendingProtectionContinuationSchema>;

/**
 * Maximum protection-fact batches retained for durable statistics delivery.
 * @since 1.0.0 Initial implementation.
 */
export const MaximumStoredProtectionStatisticsDeliveryBatchCount = 512;

/**
 * Durable statistics-delivery completeness states.
 * @since 1.0.0 Initial implementation.
 */
export const StoredProtectionStatisticsDeliveryStatus = {
	COMPLETE: 'complete',
	INCOMPLETE: 'incomplete',
} as const;

/**
 * Validates a durable statistics-delivery completeness state.
 * @since 1.0.0 Initial implementation.
 */
export const StoredProtectionStatisticsDeliveryStatusSchema = z.enum(
	StoredProtectionStatisticsDeliveryStatus,
);

/**
 * Durable statistics-delivery completeness state.
 * @since 1.0.0 Initial implementation.
 */
export type StoredProtectionStatisticsDeliveryStatus = z.infer<
	typeof StoredProtectionStatisticsDeliveryStatusSchema
>;

/**
 * Validates the unrefined shape of durable statistics delivery.
 * @since 1.0.0 Initial implementation.
 */
const StoredProtectionStatisticsDeliveryFieldsSchema = z.object( {
	status: StoredProtectionStatisticsDeliveryStatusSchema,
	outbox: z.array( ProtectionFactBatchSchema )
		.max( MaximumStoredProtectionStatisticsDeliveryBatchCount ),
	/** Absent in older valid documents and whenever no browser release is pending. */
	pendingContinuations: z.array( PendingProtectionContinuationSchema )
		.max( MaximumStoredProtectionStatisticsDeliveryBatchCount ).optional(),
} ).strict();

/**
 * Unrefined durable statistics-delivery values.
 * @since 1.0.0 Initial implementation.
 */
type StoredProtectionStatisticsDeliveryFields = z.infer<
	typeof StoredProtectionStatisticsDeliveryFieldsSchema
>;

/**
 * Adds duplicate batch-identifier issues to one delivery refinement context.
 * @param delivery - Durable delivery value being refined.
 * @param context - Zod refinement context receiving duplicate issues.
 * @since 1.0.0 Initial implementation.
 */
function refineStoredProtectionStatisticsDelivery(
	delivery: StoredProtectionStatisticsDeliveryFields,
	context: RefinementCtx,
): void {
	const batchIds = new Set<string>();
	const continuations = new Set<string>();
	for ( const pending of delivery.pendingContinuations ?? [] ) {
		const identity = JSON.stringify( [
			pending.scopeId, pending.allowanceId, pending.participantId, pending.pageId,
		] );
		if ( continuations.has( identity ) ) {
			context.addIssue( { code: 'custom', message: 'Pending continuation identities must be unique.' } );
		}
		continuations.add( identity );
	}

	delivery.outbox.forEach( ( batch, index ) => {
		if ( batchIds.has( batch.batchId ) ) {
			context.addIssue( {
				code: 'custom',
				message: 'Statistics-delivery batch identifiers must be unique.',
				path: [ 'outbox', index, 'batchId' ],
			} );
		}

		batchIds.add( batch.batchId );
	} );
}

/**
 * Validates durable statistics delivery with a bounded FIFO outbox of unique batches.
 * @since 1.0.0 Initial implementation.
 */
export const StoredProtectionStatisticsDeliverySchema =
	StoredProtectionStatisticsDeliveryFieldsSchema.superRefine(
		refineStoredProtectionStatisticsDelivery,
	);

/**
 * Durable statistics delivery with a bounded FIFO outbox of unique batches.
 * @since 1.0.0 Initial implementation.
 */
export type StoredProtectionStatisticsDelivery = z.infer<
	typeof StoredProtectionStatisticsDeliverySchema
>;
