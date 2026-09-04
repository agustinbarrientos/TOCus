import { type ScopeStatistics, type StatisticsDocument } from '../../types/statistics-document';
import { type ResetStatisticsOperation } from '../../types/statistics-operation';
import { createEmptyScopeStatistics } from '../create-statistics-document';

/**
 * Clears every statistic under a fresh generation and current revision map.
 * @param document - Current validated statistics document.
 * @param operation - Validated reset operation.
 * @return Fresh zero-valued statistics document with the replay fence preserved.
 * @throws {RangeError} When the supplied generation is not fresh.
 * @since 0.1.0 Initial implementation.
 */
export function resetStatistics(
	document: StatisticsDocument,
	operation: ResetStatisticsOperation,
): StatisticsDocument {
	if ( operation.generationId === document.generationId ) {
		throw new RangeError( 'Statistics reset requires a fresh generation identifier.' );
	}

	const scopes = new Map<string, ScopeStatistics>();

	for ( const [ scopeId, measurementRevision ] of Object.entries(
		operation.measurementRevisionsByScope,
	) ) {
		scopes.set( scopeId, createEmptyScopeStatistics( measurementRevision ) );
	}

	return {
		...document,
		generationId: operation.generationId,
		scopes: Object.fromEntries( scopes ),
	};
}
