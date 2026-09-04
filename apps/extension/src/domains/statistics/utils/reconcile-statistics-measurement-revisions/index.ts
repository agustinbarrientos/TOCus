import { type StatisticsDocument, type ScopeStatistics } from '../../types/statistics-document';
import { type ReconcileMeasurementRevisionsOperation } from '../../types/statistics-operation';
import { type ProtectionMeasurementRevision } from '../../../protection/types/protection-value';
import { createEmptyScopeStatistics } from '../create-statistics-document';

/**
 * Reconciles one retained scope against its current measurement revision.
 * @param scope - Retained current or historical scope statistics.
 * @param measurementRevision - Current revision, or undefined when the scope is inactive.
 * @return Reconciled scope statistics with historical totals preserved.
 * @since 0.1.0 Initial implementation.
 */
function reconcileScopeStatistics(
	scope: ScopeStatistics,
	measurementRevision?: ProtectionMeasurementRevision,
): ScopeStatistics {
	if ( measurementRevision === undefined ) {
		return {
			totals: scope.totals,
			...( scope.hasFinalizedBaseline === true
				? { hasFinalizedBaseline: true }
				: {} ),
			...( scope.latestBaseline === undefined
				? {}
				: { latestBaseline: scope.latestBaseline } ),
		};
	}

	if ( scope.currentMeasurementRevision === measurementRevision ) {
		return scope;
	}

	return {
		totals: scope.totals,
		...( scope.hasFinalizedBaseline === true
			? { hasFinalizedBaseline: true }
			: {} ),
		currentMeasurementRevision: measurementRevision,
		...( scope.latestBaseline === undefined
			? {}
			: { latestBaseline: scope.latestBaseline } ),
	};
}

/**
 * Reconciles every retained and current scope measurement revision.
 * @param document - Current validated statistics document.
 * @param operation - Validated complete revision-map operation.
 * @return Reconciled statistics document.
 * @since 0.1.0 Initial implementation.
 */
export function reconcileStatisticsMeasurementRevisions(
	document: StatisticsDocument,
	operation: ReconcileMeasurementRevisionsOperation,
): StatisticsDocument {
	const scopes = new Map<string, ScopeStatistics>();

	for ( const [ scopeId, scope ] of Object.entries( document.scopes ) ) {
		const measurementRevision = Object.hasOwn(
			operation.measurementRevisionsByScope,
			scopeId,
		)
			? operation.measurementRevisionsByScope[ scopeId ]
			: undefined;

		scopes.set( scopeId, reconcileScopeStatistics(
			scope,
			measurementRevision,
		) );
	}

	for ( const [ scopeId, measurementRevision ] of Object.entries(
		operation.measurementRevisionsByScope,
	) ) {
		if ( ! scopes.has( scopeId ) ) {
			scopes.set( scopeId, createEmptyScopeStatistics( measurementRevision ) );
		}
	}

	return { ...document, scopes: Object.fromEntries( scopes ) };
}
