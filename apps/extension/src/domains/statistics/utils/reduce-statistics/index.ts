import { StatisticsDocumentSchema, type StatisticsDocument } from '../../types/statistics-document';
import {
	StatisticsOperationSchema,
	StatisticsOperationType,
	type StatisticsOperation,
} from '../../types/statistics-operation';
import { applyStatisticsFactBatch } from '../apply-statistics-fact-batch';
import { finalizeMatchingStatisticsAllowance } from '../finalize-statistics-allowance';
import { reconcileStatisticsMeasurementRevisions } from '../reconcile-statistics-measurement-revisions';
import { recordStatisticsFocusedInterval } from '../record-statistics-focused-interval';
import { resetStatistics } from '../reset-statistics';

/**
 * Dispatches one validated operation against a validated statistics document.
 * @param document - Current validated statistics document.
 * @param operation - Validated statistics operation.
 * @return Next statistics document.
 * @since 0.1.0 Initial implementation.
 */
function dispatchStatisticsOperation(
	document: StatisticsDocument,
	operation: StatisticsOperation,
): StatisticsDocument {
	switch ( operation.type ) {
		case StatisticsOperationType.APPLY_FACT_BATCH:
			return applyStatisticsFactBatch( document, operation );
		case StatisticsOperationType.RECORD_FOCUSED_INTERVAL:
			return recordStatisticsFocusedInterval( document, operation );
		case StatisticsOperationType.FINALIZE_ACTIVE_ALLOWANCE: {
			if ( document.generationId !== operation.generationId ) {
				return document;
			}

			const scope = Object.hasOwn( document.scopes, operation.scopeId )
				? document.scopes[ operation.scopeId ]
				: undefined;

			if ( scope === undefined ) {
				return document;
			}

			const nextScope = finalizeMatchingStatisticsAllowance( scope, operation );

			if ( nextScope === scope ) {
				return document;
			}

			return {
				...document,
				scopes: {
					...document.scopes,
					[ operation.scopeId ]: nextScope,
				},
			};
		}
		case StatisticsOperationType.RECONCILE_MEASUREMENT_REVISIONS:
			return reconcileStatisticsMeasurementRevisions( document, operation );
		case StatisticsOperationType.RESET:
			return resetStatistics( document, operation );
	}
}

/**
 * Applies one validated operation without mutating its inputs.
 * @param document - Unknown local statistics document input.
 * @param operation - Unknown statistics operation input.
 * @return Validated next statistics document.
 * @throws {import('zod').ZodError} When an input or computed result violates its contract.
 * @throws {RangeError} When a valid operation violates arithmetic or lifecycle invariants.
 * @since 0.1.0 Initial implementation.
 */
export function reduceStatistics( document: unknown, operation: unknown ): StatisticsDocument {
	const parsedDocument = StatisticsDocumentSchema.parse( document );
	const parsedOperation = StatisticsOperationSchema.parse( operation );

	return StatisticsDocumentSchema.parse(
		dispatchStatisticsOperation( parsedDocument, parsedOperation ),
	);
}
