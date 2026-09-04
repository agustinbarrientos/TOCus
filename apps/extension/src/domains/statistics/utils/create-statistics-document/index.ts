import {
	StatisticsDocumentSchema,
	StatisticsDocumentVersion,
	type StatisticsDocument,
	type ScopeStatistics,
	type StatisticsTotals,
} from '../../types/statistics-document';
import { StatisticsGenerationIdSchema } from '../../types/statistics-value';
import { type ProtectionMeasurementRevision } from '../../../protection/types/protection-value';

/**
 * Creates a fresh set of zero-valued scope totals.
 * @return Five zero-valued statistics totals.
 * @since 0.1.0 Initial implementation.
 */
export function createEmptyStatisticsTotals(): StatisticsTotals {
	return {
		estimatedReclaimedMilliseconds: 0,
		focusedPauseMilliseconds: 0,
		reconsideredVisitCount: 0,
		completedWaitCount: 0,
		allowanceGrantedCount: 0,
	};
}

/**
 * Creates fresh statistics for one active or historical scope.
 * @param measurementRevision - Current revision, or undefined for a historical scope.
 * @return Zero-valued scope statistics.
 * @since 0.1.0 Initial implementation.
 */
export function createEmptyScopeStatistics(
	measurementRevision?: ProtectionMeasurementRevision,
): ScopeStatistics {
	return {
		totals: createEmptyStatisticsTotals(),
		...( measurementRevision === undefined
			? {}
			: { currentMeasurementRevision: measurementRevision } ),
	};
}

/**
 * Creates one empty local statistics document.
 * @param generationId - Unknown fresh statistics generation identifier.
 * @return Empty validated statistics document.
 * @throws {import('zod').ZodError} When the generation identifier is invalid.
 * @since 0.1.0 Initial implementation.
 */
export function createStatisticsDocument( generationId: unknown ): StatisticsDocument {
	return StatisticsDocumentSchema.parse( {
		schemaVersion: StatisticsDocumentVersion,
		generationId: StatisticsGenerationIdSchema.parse( generationId ),
		lastAppliedBatchId: null,
		scopes: {},
	} );
}
