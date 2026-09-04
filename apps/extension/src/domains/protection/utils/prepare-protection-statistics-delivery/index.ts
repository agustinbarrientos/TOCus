import { ProtectionFactBatchSchema } from '../../types/protection-fact-batch';
import {
	ProtectionFactType,
	type ProtectionFact,
} from '../../types/protection-fact';
import {
	MaximumStoredProtectionStatisticsDeliveryBatchCount,
	StoredProtectionStatisticsDeliverySchema,
	StoredProtectionStatisticsDeliveryStatus,
	type StoredProtectionStatisticsDelivery,
} from '../../types/stored-protection-statistics-delivery';
import {
	ProtectionFactBatchIdSchema,
	ProtectionMeasurementRevisionSchema,
} from '../../types/protection-value';
import { type PrepareStatisticsDeliveryForTransitionInput } from './types';

/**
 * Returns one fact's observation time regardless of its kind-specific field name.
 * @param fact - Validated protection fact.
 * @return Fact observation time in epoch milliseconds.
 * @since 0.1.0 Initial implementation.
 */
function getProtectionFactObservationTime( fact: ProtectionFact ): number {
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
 * Returns a detached empty complete statistics-delivery value.
 * @return Empty complete durable statistics delivery.
 * @since 0.1.0 Initial implementation.
 */
export function createEmptyProtectionStatisticsDelivery(): StoredProtectionStatisticsDelivery {
	return StoredProtectionStatisticsDeliverySchema.parse( {
		status: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
		outbox: [],
	} );
}

/**
 * Clones durable statistics delivery without exposing coordinator-owned values.
 * @param delivery - Validated coordinator-owned delivery value.
 * @return Detached validated delivery value.
 * @since 0.1.0 Initial implementation.
 */
export function cloneProtectionStatisticsDelivery(
	delivery: StoredProtectionStatisticsDelivery,
): StoredProtectionStatisticsDelivery {
	return StoredProtectionStatisticsDeliverySchema.parse( delivery );
}

/**
 * Marks delivery incomplete while retaining every queued batch unchanged.
 * @param delivery - Current validated delivery value.
 * @return Detached incomplete delivery with the same outbox.
 * @since 0.1.0 Initial implementation.
 */
function markProtectionStatisticsDeliveryIncomplete(
	delivery: StoredProtectionStatisticsDelivery,
): StoredProtectionStatisticsDelivery {
	return StoredProtectionStatisticsDeliverySchema.parse( {
		status: StoredProtectionStatisticsDeliveryStatus.INCOMPLETE,
		outbox: delivery.outbox,
	} );
}

/**
 * Appends one validated fact batch or marks delivery incomplete while retaining queued batches.
 * @param input - Current delivery, emitted facts, revision, scope, and optional batch factory.
 * @return Next validated durable statistics delivery.
 * @since 0.1.0 Initial implementation.
 */
export function prepareStatisticsDeliveryForTransition(
	input: PrepareStatisticsDeliveryForTransitionInput,
): StoredProtectionStatisticsDelivery {
	if (
		input.delivery.status === StoredProtectionStatisticsDeliveryStatus.INCOMPLETE ||
		input.delivery.outbox.length >= MaximumStoredProtectionStatisticsDeliveryBatchCount
	) {
		return markProtectionStatisticsDeliveryIncomplete( input.delivery );
	}

	const revision = ProtectionMeasurementRevisionSchema.safeParse( input.measurementRevision );

	if ( ! revision.success ) {
		return markProtectionStatisticsDeliveryIncomplete( input.delivery );
	}

	try {
		const batchId = ProtectionFactBatchIdSchema.parse( input.createProtectionFactBatchId() );

		if ( input.delivery.outbox.some( ( batch ) => batch.batchId === batchId ) ) {
			return markProtectionStatisticsDeliveryIncomplete( input.delivery );
		}

		const observationTimes = input.facts.map( getProtectionFactObservationTime );
		const batch = ProtectionFactBatchSchema.parse( {
			batchId,
			scopeId: input.scopeId,
			measurementRevision: revision.data,
			observedAtEpochMilliseconds: observationTimes[ 0 ],
			facts: input.facts,
		} );

		return StoredProtectionStatisticsDeliverySchema.parse( {
			status: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
			outbox: [ ...input.delivery.outbox, batch ],
		} );
	} catch {
		return markProtectionStatisticsDeliveryIncomplete( input.delivery );
	}
}

export * from './types';
