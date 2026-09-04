import { z, type RefinementCtx } from 'zod';
import {
	AllowanceDurationMaximumMilliseconds,
	AllowanceDurationMillisecondsSchema,
} from '../../protection/types/allowance-duration';
import {
	AllowanceIdSchema,
	ProtectionFactBatchIdSchema,
	ProtectionMeasurementRevisionSchema,
	ProtectionScopeIdSchema,
} from '../../protection/types/protection-value';
import {
	StatisticsGenerationIdSchema,
	StatisticsNonNegativeSafeIntegerSchema,
} from './statistics-value';

/**
 * Current local statistics document version.
 * @since 0.1.0 Initial implementation.
 */
export const StatisticsDocumentVersion = 1;

/**
 * Validates the current local statistics document version.
 * @since 0.1.0 Initial implementation.
 */
const StatisticsDocumentVersionSchema = z.number().int().nonnegative().refine(
	( value ) => value === StatisticsDocumentVersion,
	{ message: 'Statistics document version is not supported.' },
);

/**
 * Validates the five accumulated values owned by one protection scope.
 * @since 0.1.0 Initial implementation.
 */
export const StatisticsTotalsSchema = z.object( {
	estimatedReclaimedMilliseconds: StatisticsNonNegativeSafeIntegerSchema,
	focusedPauseMilliseconds: StatisticsNonNegativeSafeIntegerSchema,
	reconsideredVisitCount: StatisticsNonNegativeSafeIntegerSchema,
	completedWaitCount: StatisticsNonNegativeSafeIntegerSchema,
	allowanceGrantedCount: StatisticsNonNegativeSafeIntegerSchema,
} ).strict();

/**
 * Five accumulated values owned by one protection scope.
 * @since 0.1.0 Initial implementation.
 */
export type StatisticsTotals = z.infer<typeof StatisticsTotalsSchema>;

/**
 * Validates the latest finalized allowance-use baseline for one scope revision.
 * @since 0.1.0 Initial implementation.
 */
export const StatisticsBaselineSchema = z.object( {
	measurementRevision: ProtectionMeasurementRevisionSchema,
	focusedUseMilliseconds: StatisticsNonNegativeSafeIntegerSchema.max(
		AllowanceDurationMaximumMilliseconds,
	),
} ).strict();

/**
 * Latest finalized allowance-use baseline for one scope revision.
 * @since 0.1.0 Initial implementation.
 */
export type StatisticsBaseline = z.infer<typeof StatisticsBaselineSchema>;

/**
 * Validates the unrefined shape of one active allowance measurement.
 * @since 0.1.0 Initial implementation.
 */
const ActiveAllowanceMeasurementFieldsSchema = z.object( {
	allowanceId: AllowanceIdSchema,
	measurementRevision: ProtectionMeasurementRevisionSchema,
	startedAtEpochMilliseconds: StatisticsNonNegativeSafeIntegerSchema,
	expiresAtEpochMilliseconds: StatisticsNonNegativeSafeIntegerSchema,
	confirmedFocusedUseMilliseconds: StatisticsNonNegativeSafeIntegerSchema,
	accountedThroughEpochMilliseconds: StatisticsNonNegativeSafeIntegerSchema,
} ).strict();

/**
 * Unrefined active allowance measurement values.
 * @since 0.1.0 Initial implementation.
 */
type ActiveAllowanceMeasurementFields = z.infer<
	typeof ActiveAllowanceMeasurementFieldsSchema
>;

/**
 * Adds allowance interval consistency issues to one refinement context.
 * @param measurement - Active allowance measurement being refined.
 * @param context - Zod refinement context receiving consistency issues.
 * @since 0.1.0 Initial implementation.
 */
function refineActiveAllowanceMeasurement(
	measurement: ActiveAllowanceMeasurementFields,
	context: RefinementCtx,
): void {
	const allowanceDurationMilliseconds =
		measurement.expiresAtEpochMilliseconds - measurement.startedAtEpochMilliseconds;

	if ( ! AllowanceDurationMillisecondsSchema.safeParse( allowanceDurationMilliseconds ).success ) {
		context.addIssue( {
			code: 'custom',
			message: 'An active allowance interval must span one through sixty whole minutes.',
			path: [ 'expiresAtEpochMilliseconds' ],
		} );
	}

	if (
		measurement.accountedThroughEpochMilliseconds < measurement.startedAtEpochMilliseconds ||
		measurement.accountedThroughEpochMilliseconds > measurement.expiresAtEpochMilliseconds
	) {
		context.addIssue( {
			code: 'custom',
			message: 'Accounted-through time must remain within the allowance interval.',
			path: [ 'accountedThroughEpochMilliseconds' ],
		} );
	}

	const accountedIntervalMilliseconds =
		measurement.accountedThroughEpochMilliseconds - measurement.startedAtEpochMilliseconds;

	if ( measurement.confirmedFocusedUseMilliseconds > accountedIntervalMilliseconds ) {
		context.addIssue( {
			code: 'custom',
			message: 'Confirmed use cannot exceed the accounted allowance interval.',
			path: [ 'confirmedFocusedUseMilliseconds' ],
		} );
	}
}

/**
 * Validates one active allowance measurement.
 * @since 0.1.0 Initial implementation.
 */
export const ActiveAllowanceMeasurementSchema = ActiveAllowanceMeasurementFieldsSchema.superRefine(
	refineActiveAllowanceMeasurement,
);

/**
 * Active allowance measurement retained across focus checkpoints.
 * @since 0.1.0 Initial implementation.
 */
export type ActiveAllowanceMeasurement = z.infer<typeof ActiveAllowanceMeasurementSchema>;

/**
 * Validates the unrefined persisted statistics for one protection scope.
 * @since 0.1.0 Initial implementation.
 */
const ScopeStatisticsFieldsSchema = z.object( {
	totals: StatisticsTotalsSchema,
	hasFinalizedBaseline: z.boolean().optional(),
	currentMeasurementRevision: ProtectionMeasurementRevisionSchema.optional(),
	latestBaseline: StatisticsBaselineSchema.optional(),
	activeAllowance: ActiveAllowanceMeasurementSchema.optional(),
} ).strict();

/**
 * Unrefined persisted statistics for one protection scope.
 * @since 0.1.0 Initial implementation.
 */
type ScopeStatisticsFields = z.infer<typeof ScopeStatisticsFieldsSchema>;

/**
 * Adds scope measurement consistency issues to one refinement context.
 * @param scope - Scope statistics being refined.
 * @param context - Zod refinement context receiving consistency issues.
 * @since 0.1.0 Initial implementation.
 */
function refineScopeStatistics(
	scope: ScopeStatisticsFields,
	context: RefinementCtx,
): void {
	if ( scope.currentMeasurementRevision === undefined ) {
		if ( scope.activeAllowance !== undefined ) {
			context.addIssue( {
				code: 'custom',
				message: 'An inactive scope cannot retain an active allowance.',
				path: [ 'activeAllowance' ],
			} );
		}

		return;
	}

	if (
		scope.activeAllowance !== undefined &&
		scope.activeAllowance.measurementRevision !== scope.currentMeasurementRevision
	) {
		context.addIssue( {
			code: 'custom',
			message: 'An active allowance must match the current measurement revision.',
			path: [ 'activeAllowance', 'measurementRevision' ],
		} );
	}
}

/**
 * Omits absent optional fields from one scope statistics value.
 * @param scope - Refined scope statistics values.
 * @return Canonical scope statistics without owned undefined properties.
 * @since 0.1.0 Initial implementation.
 */
function canonicalizeScopeStatistics( scope: ScopeStatisticsFields ): ScopeStatisticsFields {
	return {
		totals: scope.totals,
		...( scope.hasFinalizedBaseline === true || scope.latestBaseline !== undefined
			? { hasFinalizedBaseline: true }
			: {} ),
		...( scope.currentMeasurementRevision === undefined
			? {}
			: { currentMeasurementRevision: scope.currentMeasurementRevision } ),
		...( scope.latestBaseline === undefined
			? {}
			: { latestBaseline: scope.latestBaseline } ),
		...( scope.activeAllowance === undefined
			? {}
			: { activeAllowance: scope.activeAllowance } ),
	};
}

/**
 * Validates persisted statistics for one active or historical protection scope.
 * @since 0.1.0 Initial implementation.
 */
export const ScopeStatisticsSchema = ScopeStatisticsFieldsSchema.superRefine(
	refineScopeStatistics,
).transform( canonicalizeScopeStatistics );

/**
 * Persisted statistics for one active or historical protection scope.
 * @since 0.1.0 Initial implementation.
 */
export type ScopeStatistics = z.infer<typeof ScopeStatisticsSchema>;

/**
 * Validates one persisted scope-statistics record entry.
 * @since 0.1.0 Initial implementation.
 */
const StatisticsScopeEntrySchema = z.tuple( [
	ProtectionScopeIdSchema,
	ScopeStatisticsSchema,
] );

/**
 * One persisted scope-statistics record entry.
 * @since 0.1.0 Initial implementation.
 */
type StatisticsScopeEntry = z.infer<typeof StatisticsScopeEntrySchema>;

/**
 * Extracts own entries from one plain record input.
 * @param input - Unknown scope-statistics record input.
 * @return Own entries, or null for a non-plain record.
 * @since 0.1.0 Initial implementation.
 */
function extractStatisticsScopeEntries( input: unknown ): unknown {
	if ( typeof input !== 'object' || input === null || Array.isArray( input ) ) {
		return null;
	}

	const prototype: unknown = Object.getPrototypeOf( input );

	return prototype === Object.prototype || prototype === null
		? Object.entries( input )
		: null;
}

/**
 * Creates one prototype-safe scope-statistics record.
 * @param entries - Validated scope-statistics entries.
 * @return Scope statistics indexed by their exact identifiers.
 * @since 0.1.0 Initial implementation.
 */
function createStatisticsScopeRecord(
	entries: StatisticsScopeEntry[],
): Record<string, ScopeStatistics> {
	return Object.fromEntries( entries );
}

/**
 * Validates scope statistics indexed by exact supported scope identifiers.
 * @since 0.1.0 Initial implementation.
 */
const StatisticsScopesSchema = z.preprocess(
	extractStatisticsScopeEntries,
	z.array( StatisticsScopeEntrySchema ),
).transform( createStatisticsScopeRecord );

/**
 * Validates one aggregate-first local statistics document.
 * @since 0.1.0 Initial implementation.
 */
export const StatisticsDocumentSchema = z.object( {
	schemaVersion: StatisticsDocumentVersionSchema,
	generationId: StatisticsGenerationIdSchema,
	lastAppliedBatchId: ProtectionFactBatchIdSchema.nullable(),
	scopes: StatisticsScopesSchema,
} ).strict();

/**
 * Aggregate-first local statistics document.
 * @since 0.1.0 Initial implementation.
 */
export type StatisticsDocument = z.infer<typeof StatisticsDocumentSchema>;
