import { StoredProtectionStatisticsDeliveryStatus } from '../../../../../domains/protection/types/stored-protection-statistics-delivery';
import { ProtectionStorageEnvelopeSchema } from '../../../../../domains/protection/services/protection-storage';
import { StoredDurableProtectionStateSchema } from '../../../../../domains/protection/types/stored-protection-state';

/**
 * Creates a durable storage envelope with an optional running allowance.
 * @param allowance - Running allowance fields, or null when no interval exists.
 * @return Validated durable protection storage envelope.
 * @since 0.1.0 Initial implementation.
 */
export function createAllowanceStorageEnvelope( allowance: Record<string, unknown> | null = null ) {
	return ProtectionStorageEnvelopeSchema.parse( {
		snapshotId: '00000000-0000-4000-8000-000000000001',
		document: StoredDurableProtectionStateSchema.parse( {
			schemaVersion: 2,
			statisticsDelivery: { status: StoredProtectionStatisticsDeliveryStatus.COMPLETE, outbox: [] },
			scopes: {
				'scope-default': {
					ladder: { completedWaits: 1, greatestObservedLocalDate: '2026-09-05' },
					...( allowance === null ? {} : { allowance } ),
				},
			},
		} ),
	} );
}
