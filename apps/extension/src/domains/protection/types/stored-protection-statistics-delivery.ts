import { z, type RefinementCtx } from 'zod';
import { ProtectionFactBatchSchema } from './protection-fact-batch';

/**
 * Maximum protection-fact batches retained for durable statistics delivery.
 * @since 0.1.0 Initial implementation.
 */
export const MaximumStoredProtectionStatisticsDeliveryBatchCount = 512;

/**
 * Durable statistics-delivery completeness states.
 * @since 0.1.0 Initial implementation.
 */
export const StoredProtectionStatisticsDeliveryStatus = {
	COMPLETE: 'complete',
	INCOMPLETE: 'incomplete',
} as const;

/**
 * Validates a durable statistics-delivery completeness state.
 * @since 0.1.0 Initial implementation.
 */
export const StoredProtectionStatisticsDeliveryStatusSchema = z.enum(
	StoredProtectionStatisticsDeliveryStatus,
);

/**
 * Durable statistics-delivery completeness state.
 * @since 0.1.0 Initial implementation.
 */
export type StoredProtectionStatisticsDeliveryStatus = z.infer<
	typeof StoredProtectionStatisticsDeliveryStatusSchema
>;

/**
 * Validates the unrefined shape of durable statistics delivery.
 * @since 0.1.0 Initial implementation.
 */
const StoredProtectionStatisticsDeliveryFieldsSchema = z.object( {
	status: StoredProtectionStatisticsDeliveryStatusSchema,
	outbox: z.array( ProtectionFactBatchSchema )
		.max( MaximumStoredProtectionStatisticsDeliveryBatchCount ),
} ).strict();

/**
 * Unrefined durable statistics-delivery values.
 * @since 0.1.0 Initial implementation.
 */
type StoredProtectionStatisticsDeliveryFields = z.infer<
	typeof StoredProtectionStatisticsDeliveryFieldsSchema
>;

/**
 * Adds duplicate batch-identifier issues to one delivery refinement context.
 * @param delivery - Durable delivery value being refined.
 * @param context - Zod refinement context receiving duplicate issues.
 * @since 0.1.0 Initial implementation.
 */
function refineStoredProtectionStatisticsDelivery(
	delivery: StoredProtectionStatisticsDeliveryFields,
	context: RefinementCtx,
): void {
	const batchIds = new Set<string>();

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
 * @since 0.1.0 Initial implementation.
 */
export const StoredProtectionStatisticsDeliverySchema =
	StoredProtectionStatisticsDeliveryFieldsSchema.superRefine(
		refineStoredProtectionStatisticsDelivery,
	);

/**
 * Durable statistics delivery with a bounded FIFO outbox of unique batches.
 * @since 0.1.0 Initial implementation.
 */
export type StoredProtectionStatisticsDelivery = z.infer<
	typeof StoredProtectionStatisticsDeliverySchema
>;
