import { type StatisticsDocument } from '../../types/statistics-document';
import { type RecordFocusedIntervalOperation } from '../../types/statistics-operation';
import { addStatisticsValues } from '../add-statistics-values';

/**
 * Records the unaccounted overlap of one focused allowance interval.
 * @param document - Current validated statistics document.
 * @param operation - Validated focused-interval operation.
 * @return Updated statistics document, or the original document for stale work.
 * @since 0.1.0 Initial implementation.
 */
export function recordStatisticsFocusedInterval(
	document: StatisticsDocument,
	operation: RecordFocusedIntervalOperation,
): StatisticsDocument {
	const scope = Object.hasOwn( document.scopes, operation.scopeId )
		? document.scopes[ operation.scopeId ]
		: undefined;
	const activeAllowance = scope?.activeAllowance;

	if (
		document.generationId !== operation.generationId ||
		scope?.currentMeasurementRevision !== operation.measurementRevision ||
		activeAllowance === undefined ||
		activeAllowance.measurementRevision !== operation.measurementRevision ||
		activeAllowance.allowanceId !== operation.allowanceId
	) {
		return document;
	}

	const accountedFromEpochMilliseconds = Math.max(
		operation.startedAtEpochMilliseconds,
		activeAllowance.startedAtEpochMilliseconds,
		activeAllowance.accountedThroughEpochMilliseconds,
	);
	const accountedThroughEpochMilliseconds = Math.min(
		operation.endedAtEpochMilliseconds,
		activeAllowance.expiresAtEpochMilliseconds,
	);

	if ( accountedThroughEpochMilliseconds <= accountedFromEpochMilliseconds ) {
		return document;
	}

	const focusedIncrement = accountedThroughEpochMilliseconds - accountedFromEpochMilliseconds;

	return {
		...document,
		scopes: {
			...document.scopes,
			[ operation.scopeId ]: {
				...scope,
				activeAllowance: {
					...activeAllowance,
					confirmedFocusedUseMilliseconds: addStatisticsValues(
						activeAllowance.confirmedFocusedUseMilliseconds,
						focusedIncrement,
					),
					accountedThroughEpochMilliseconds,
				},
			},
		},
	};
}
