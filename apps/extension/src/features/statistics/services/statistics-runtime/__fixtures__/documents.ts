import { TestEmptyProtectionConfiguration } from '../../../../../domains/protection/types/__fixtures__/protection-configuration';
import { createAllowanceState } from '../../../../../domains/protection/types/__fixtures__/protection-state';
import {
	ProtectionFactBatchSchema,
} from '../../../../../domains/protection/types/protection-fact-batch';
import {
	ProtectionConfigurationDocumentSchema,
	type ProtectionConfigurationDocument,
} from '../../../../../domains/protection/types/protected-site-configuration';
import {
	SessionContinuityIdSchema,
} from '../../../../../domains/protection/types/protection-value';
import {
	AllowanceProtectionStateSchema,
} from '../../../../../domains/protection/types/protection-state';
import {
	StatisticsDocumentSchema,
	type StatisticsDocument,
} from '../../../../../domains/statistics/types/statistics-document';
import {
	StatisticsSessionDocumentSchema,
	type StatisticsSessionDocument,
} from '../../../../../domains/statistics/types/statistics-session';
import {
	StatisticsFocusEpochIdSchema,
} from '../../../../../domains/statistics/types/statistics-value';

/**
 * Deterministic current time used by statistics-runtime tests.
 * @since 0.1.0 Initial implementation.
 */
export const TEST_NOW_EPOCH_MILLISECONDS = 1_800_000_200_000;

/**
 * Browser-session continuity used by the primary statistics-runtime test instance.
 * @since 0.1.0 Initial implementation.
 */
export const TEST_SESSION_CONTINUITY_ID = SessionContinuityIdSchema.parse( 'session_current' );

/**
 * Focus epoch used by the primary statistics-runtime test instance.
 * @since 0.1.0 Initial implementation.
 */
export const TEST_FOCUS_EPOCH_ID = StatisticsFocusEpochIdSchema.parse( 'focus_epoch_current' );

/**
 * Reuses the current generation identifier for an invalid reset scenario.
 * @return Existing statistics generation identifier.
 * @since 0.1.0 Initial implementation.
 */
export function reuseCurrentGenerationId(): string {
	return 'generation_test';
}

/**
 * Complete current configuration used by statistics-runtime tests.
 * @since 0.1.0 Initial implementation.
 */
export const TEST_CONFIGURATION = ProtectionConfigurationDocumentSchema.parse( {
	...TestEmptyProtectionConfiguration,
	sites: [ {
		identityHost: 'example.com',
		rule: {
			host: 'example.com',
			includeSubdomains: true,
			scopeId: 'scope_default',
		},
	} ],
	measurementRevisionsByScope: { scope_default: 'revision_current' },
} );

/**
 * Creates a valid local statistics document for one current scope.
 * @param scopeId - Exact current scope identifier.
 * @param measurementRevision - Current measurement revision.
 * @return Valid local statistics document.
 * @since 0.1.0 Initial implementation.
 */
export function createStatisticsDocument(
	scopeId = 'scope_default',
	measurementRevision = 'revision_old',
): StatisticsDocument {
	return StatisticsDocumentSchema.parse( {
		schemaVersion: 1,
		generationId: 'generation_test',
		lastAppliedBatchId: null,
		scopes: Object.fromEntries( [ [ scopeId, {
			totals: {
				estimatedReclaimedMilliseconds: 0,
				focusedPauseMilliseconds: 0,
				reconsideredVisitCount: 0,
				completedWaitCount: 0,
				allowanceGrantedCount: 0,
			},
			currentMeasurementRevision: measurementRevision,
		} ] ] ),
	} );
}

/**
 * Creates one valid reconsidered-visit fact batch.
 * @param batchId - Stable batch identifier.
 * @param scopeId - Exact batch scope.
 * @param measurementRevision - Revision captured with the fact.
 * @param observedAtEpochMilliseconds - Shared batch observation time.
 * @return Valid protection-fact batch.
 * @since 0.1.0 Initial implementation.
 */
export function createReconsideredBatch(
	batchId: string,
	scopeId = 'scope_default',
	measurementRevision = 'revision_current',
	observedAtEpochMilliseconds = TEST_NOW_EPOCH_MILLISECONDS,
) {
	return ProtectionFactBatchSchema.parse( {
		batchId,
		scopeId,
		measurementRevision,
		observedAtEpochMilliseconds,
		facts: [ {
			type: 'reconsidered-visit',
			factId: `fact_${ batchId }`,
			scopeId,
			waitId: `wait_${ batchId }`,
			participantId: `participant_${ batchId }`,
			departureCause: 'active-session-tab-close',
			observedAtEpochMilliseconds,
		} ],
	} );
}

/**
 * Creates one valid allowance-granted fact batch.
 * @param batchId - Stable batch identifier.
 * @param allowanceId - Stable allowance identifier.
 * @param startedAtEpochMilliseconds - Allowance start time and batch observation time.
 * @param scopeId - Exact batch scope.
 * @param measurementRevision - Revision captured with the fact.
 * @return Valid protection-fact batch.
 * @since 0.1.0 Initial implementation.
 */
export function createAllowanceBatch(
	batchId: string,
	allowanceId: string,
	startedAtEpochMilliseconds: number,
	scopeId = 'scope_default',
	measurementRevision = 'revision_current',
) {
	return ProtectionFactBatchSchema.parse( {
		batchId,
		scopeId,
		measurementRevision,
		observedAtEpochMilliseconds: startedAtEpochMilliseconds,
		facts: [ {
			type: 'allowance-granted',
			factId: `fact_${ batchId }`,
			scopeId,
			allowanceId,
			startedAtEpochMilliseconds,
			expiresAtEpochMilliseconds: startedAtEpochMilliseconds + 300_000,
			allowanceDurationMilliseconds: 300_000,
		} ],
	} );
}

/**
 * Creates local statistics with one active current allowance measurement.
 * @param scopeId - Exact active scope identifier.
 * @param measurementRevision - Current measurement revision.
 * @param allowanceId - Stable active allowance identifier.
 * @param startedAtEpochMilliseconds - Active allowance start time.
 * @param confirmedFocusedUseMilliseconds - Already persisted focused use.
 * @param accountedThroughEpochMilliseconds - End of already accounted focus.
 * @return Valid active local statistics document.
 * @since 0.1.0 Initial implementation.
 */
export function createActiveStatisticsDocument(
	scopeId = 'scope_default',
	measurementRevision = 'revision_current',
	allowanceId = 'allowance_current',
	startedAtEpochMilliseconds = TEST_NOW_EPOCH_MILLISECONDS - 120_000,
	confirmedFocusedUseMilliseconds = 0,
	accountedThroughEpochMilliseconds = startedAtEpochMilliseconds,
): StatisticsDocument {
	const document = createStatisticsDocument( scopeId, measurementRevision );
	const scope = document.scopes[ scopeId ];

	if ( scope === undefined ) {
		throw new Error( 'Expected an active statistics scope fixture.' );
	}

	return StatisticsDocumentSchema.parse( {
		...document,
		scopes: Object.fromEntries( [ [ scopeId, {
			...scope,
			activeAllowance: {
				allowanceId,
				measurementRevision,
				startedAtEpochMilliseconds,
				expiresAtEpochMilliseconds: startedAtEpochMilliseconds + 300_000,
				confirmedFocusedUseMilliseconds,
				accountedThroughEpochMilliseconds,
			},
		} ] ] ),
	} );
}

/**
 * Creates one protection allowance state matching an active statistics measurement.
 * @param scopeId - Exact active scope identifier.
 * @param allowanceId - Stable active allowance identifier.
 * @param startedAtEpochMilliseconds - Active allowance start time.
 * @return Valid protection allowance state.
 * @since 0.1.0 Initial implementation.
 */
export function createMatchingAllowanceState(
	scopeId = 'scope_default',
	allowanceId = 'allowance_current',
	startedAtEpochMilliseconds = TEST_NOW_EPOCH_MILLISECONDS - 120_000,
) {
	return AllowanceProtectionStateSchema.parse( {
		...createAllowanceState(),
		scopeId,
		allowanceId,
		startedAtEpochMilliseconds,
		expiresAtEpochMilliseconds: startedAtEpochMilliseconds + 300_000,
	} );
}

/**
 * Creates compatible session work with one active focus anchor.
 * @param focusedAtEpochMilliseconds - Time the matching allowance became focused.
 * @param scopeId - Exact active scope identifier.
 * @param measurementRevision - Current measurement revision.
 * @param allowanceId - Stable active allowance identifier.
 * @param sessionContinuityId - Browser session allowed to continue the live anchor.
 * @param focusEpochId - Focus epoch allowed to continue the live anchor.
 * @return Valid session document carrying one focus anchor.
 * @since 0.1.0 Initial implementation.
 */
export function createFocusSession(
	focusedAtEpochMilliseconds: number,
	scopeId = 'scope_default',
	measurementRevision = 'revision_current',
	allowanceId = 'allowance_current',
	sessionContinuityId = TEST_SESSION_CONTINUITY_ID,
	focusEpochId = TEST_FOCUS_EPOCH_ID,
): StatisticsSessionDocument {
	return StatisticsSessionDocumentSchema.parse( {
		schemaVersion: 1,
		focusAnchor: {
			sessionContinuityId,
			focusEpochId,
			generationId: 'generation_test',
			scopeId,
			measurementRevision,
			allowanceId,
			focusedAtEpochMilliseconds,
		},
	} );
}

/**
 * Creates compatible session work with one frozen interval and optional next anchor.
 * @param startedAtEpochMilliseconds - Frozen interval start time.
 * @param endedAtEpochMilliseconds - Frozen interval end time.
 * @param nextFocusedAtEpochMilliseconds - Next anchor time, or null for no anchor.
 * @param scopeId - Exact active scope identifier.
 * @param measurementRevision - Current measurement revision.
 * @param allowanceId - Stable active allowance identifier.
 * @param sessionContinuityId - Browser session allowed to continue the optional live anchor.
 * @param focusEpochId - Focus epoch allowed to continue the optional live anchor.
 * @return Valid session document carrying frozen work.
 * @since 0.1.0 Initial implementation.
 */
export function createPendingSession(
	startedAtEpochMilliseconds: number,
	endedAtEpochMilliseconds: number,
	nextFocusedAtEpochMilliseconds: number | null = endedAtEpochMilliseconds,
	scopeId = 'scope_default',
	measurementRevision = 'revision_current',
	allowanceId = 'allowance_current',
	sessionContinuityId = TEST_SESSION_CONTINUITY_ID,
	focusEpochId = TEST_FOCUS_EPOCH_ID,
): StatisticsSessionDocument {
	const identity = {
		generationId: 'generation_test',
		scopeId,
		measurementRevision,
		allowanceId,
	};

	return StatisticsSessionDocumentSchema.parse( {
		schemaVersion: 1,
		pendingInterval: {
			...identity,
			startedAtEpochMilliseconds,
			endedAtEpochMilliseconds,
		},
		...( nextFocusedAtEpochMilliseconds === null
			? {}
			: {
				focusAnchor: {
					...identity,
					sessionContinuityId,
					focusEpochId,
					focusedAtEpochMilliseconds: nextFocusedAtEpochMilliseconds,
				},
			} ),
	} );
}

/**
 * Creates a configuration with two independently measured protected scopes.
 * @return Valid two-scope protection configuration.
 * @since 0.1.0 Initial implementation.
 */
export function createTwoScopeConfiguration(): ProtectionConfigurationDocument {
	const defaultSchedule = TEST_CONFIGURATION.schedulesByScope.scope_default;

	if ( defaultSchedule === undefined ) {
		throw new Error( 'Expected the default schedule fixture.' );
	}

	return ProtectionConfigurationDocumentSchema.parse( {
		...TEST_CONFIGURATION,
		sites: [
			...TEST_CONFIGURATION.sites,
			{
				identityHost: 'other.example',
				rule: {
					host: 'other.example',
					includeSubdomains: false,
					scopeId: 'scope_other',
				},
			},
		],
		schedulesByScope: {
			...TEST_CONFIGURATION.schedulesByScope,
			scope_other: defaultSchedule,
		},
		measurementRevisionsByScope: {
			scope_default: 'revision_current',
			scope_other: 'revision_other',
		},
	} );
}

/**
 * Creates local statistics with active measurements in two protected scopes.
 * @return Valid two-scope active statistics document.
 * @since 0.1.0 Initial implementation.
 */
export function createTwoScopeActiveStatisticsDocument(): StatisticsDocument {
	const first = createActiveStatisticsDocument();
	const second = createActiveStatisticsDocument(
		'scope_other',
		'revision_other',
		'allowance_other',
	);

	return StatisticsDocumentSchema.parse( {
		...first,
		scopes: {
			...first.scopes,
			...second.scopes,
		},
	} );
}
