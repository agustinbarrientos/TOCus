import { z, type RefinementCtx } from 'zod';
import { ProtectionFactSchema, ProtectionFactType } from './protection-fact';
import {
	EpochMillisecondsSchema,
	ProtectionFactBatchIdSchema,
	ProtectionMeasurementRevisionSchema,
	ProtectionScopeIdSchema,
} from './protection-value';

/**
 * Validates the unrefined shape of one protection-fact batch.
 * @since 0.1.0 Initial implementation.
 */
const ProtectionFactBatchFieldsSchema = z.object( {
	batchId: ProtectionFactBatchIdSchema,
	scopeId: ProtectionScopeIdSchema,
	measurementRevision: ProtectionMeasurementRevisionSchema,
	observedAtEpochMilliseconds: EpochMillisecondsSchema,
	facts: z.array( ProtectionFactSchema ).min( 1 ),
} ).strict();

/**
 * Unrefined protection-fact batch values.
 * @since 0.1.0 Initial implementation.
 */
type ProtectionFactBatchFields = z.infer<typeof ProtectionFactBatchFieldsSchema>;

/**
 * Returns the transition timestamp carried by one protection fact.
 * @param fact - Protection fact being inspected.
 * @return Epoch timestamp carried by the fact.
 * @since 0.1.0 Initial implementation.
 */
function getFactObservedAtEpochMilliseconds(
	fact: ProtectionFactBatchFields[ 'facts' ][ number ],
): number {
	switch ( fact.type ) {
		case ProtectionFactType.PAUSE_TIME:
		case ProtectionFactType.RECONSIDERED_VISIT:
			return fact.observedAtEpochMilliseconds;
		case ProtectionFactType.COMPLETED_WAIT:
			return fact.completedAtEpochMilliseconds;
		case ProtectionFactType.ALLOWANCE_GRANTED:
			return fact.startedAtEpochMilliseconds;
	}
}

/**
 * Adds cross-fact consistency issues to one batch refinement context.
 * @param batch - Batch values being refined.
 * @param context - Zod refinement context receiving consistency issues.
 * @since 0.1.0 Initial implementation.
 */
function refineProtectionFactBatch(
	batch: ProtectionFactBatchFields,
	context: RefinementCtx,
): void {
	const factIds = new Set<string>();

	for ( const [ factIndex, fact ] of batch.facts.entries() ) {
		if ( fact.scopeId !== batch.scopeId ) {
			context.addIssue( {
				code: 'custom',
				message: 'Every fact must belong to the batch scope.',
				path: [ 'facts', factIndex, 'scopeId' ],
			} );
		}

		if ( factIds.has( fact.factId ) ) {
			context.addIssue( {
				code: 'custom',
				message: 'Fact identifiers must be unique within a batch.',
				path: [ 'facts', factIndex, 'factId' ],
			} );
		}

		if ( getFactObservedAtEpochMilliseconds( fact ) !== batch.observedAtEpochMilliseconds ) {
			context.addIssue( {
				code: 'custom',
				message: 'Every fact timestamp must equal the batch observation time.',
				path: [ 'facts', factIndex ],
			} );
		}

		factIds.add( fact.factId );
	}
}

/**
 * Validates one non-empty, same-scope collection of protection facts.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionFactBatchSchema = ProtectionFactBatchFieldsSchema.superRefine(
	refineProtectionFactBatch,
);

/**
 * Non-empty, same-scope protection facts captured for durable delivery.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionFactBatch = z.infer<typeof ProtectionFactBatchSchema>;
