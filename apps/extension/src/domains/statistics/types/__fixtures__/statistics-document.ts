import {
	ScopeStatisticsSchema,
	StatisticsDocumentSchema,
	type ScopeStatistics,
	type StatisticsDocument,
} from '../statistics-document';

/**
 * Creates valid current statistics for the default scope.
 * @return Fresh current scope statistics fixture.
 * @since 0.1.0 Initial implementation.
 */
export function createMockScopeStatistics(): ScopeStatistics {
	return ScopeStatisticsSchema.parse( {
		totals: {
			estimatedReclaimedMilliseconds: 0,
			focusedPauseMilliseconds: 0,
			reconsideredVisitCount: 0,
			completedWaitCount: 0,
			allowanceGrantedCount: 0,
		},
		currentMeasurementRevision: 'revision_1',
	} );
}

/**
 * Creates valid active statistics for the default scope.
 * @return Fresh active scope statistics fixture.
 * @since 0.1.0 Initial implementation.
 */
export function createMockActiveScopeStatistics(): ScopeStatistics {
	return ScopeStatisticsSchema.parse( {
		...createMockScopeStatistics(),
		activeAllowance: {
			allowanceId: 'allowance_1',
			measurementRevision: 'revision_1',
			startedAtEpochMilliseconds: 100_000,
			expiresAtEpochMilliseconds: 400_000,
			confirmedFocusedUseMilliseconds: 0,
			accountedThroughEpochMilliseconds: 100_000,
		},
	} );
}

/**
 * Creates one valid statistics document with a current default scope.
 * @return Fresh statistics document fixture.
 * @since 0.1.0 Initial implementation.
 */
export function createMockStatisticsDocument(): StatisticsDocument {
	return StatisticsDocumentSchema.parse( {
		schemaVersion: 1,
		generationId: 'generation_1',
		lastAppliedBatchId: null,
		scopes: {
			scope_default: createMockScopeStatistics(),
		},
	} );
}

/**
 * Creates one valid statistics document with an active default-scope allowance.
 * @return Fresh active statistics document fixture.
 * @since 0.1.0 Initial implementation.
 */
export function createMockActiveStatisticsDocument(): StatisticsDocument {
	return StatisticsDocumentSchema.parse( {
		...createMockStatisticsDocument(),
		scopes: {
			scope_default: createMockActiveScopeStatistics(),
		},
	} );
}
