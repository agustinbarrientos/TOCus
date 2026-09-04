import { type ProtectionFact } from '../../types/protection-fact';
import { type StoredProtectionStatisticsDelivery } from '../../types/stored-protection-statistics-delivery';
import { type ProtectionScopeId } from '../../types/protection-value';

/**
 * Inputs used to retain one fact-emitting transition for durable statistics delivery.
 * @since 0.1.0 Initial implementation.
 */
export interface PrepareStatisticsDeliveryForTransitionInput {
	delivery: StoredProtectionStatisticsDelivery;
	facts: readonly ProtectionFact[];
	scopeId: ProtectionScopeId;
	measurementRevision: unknown;
	/**
	 * Creates one unique protection-fact batch identifier.
	 * @return Unknown identifier input for boundary validation.
	 * @since 0.1.0 Initial implementation.
	 */
	createProtectionFactBatchId: () => unknown;
}
