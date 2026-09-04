import { z, type RefinementCtx } from 'zod';
import { ProtectionFactBatchSchema } from '../../protection/types/protection-fact-batch';
import {
	AllowanceIdSchema,
	ProtectionMeasurementRevisionSchema,
	ProtectionScopeIdSchema,
	type ProtectionMeasurementRevision,
} from '../../protection/types/protection-value';
import { StatisticsGenerationIdSchema, StatisticsNonNegativeSafeIntegerSchema } from './statistics-value';

/**
 * Closed vocabulary of statistics reducer operations.
 * @since 0.1.0 Initial implementation.
 */
export const StatisticsOperationType = {
	APPLY_FACT_BATCH: 'apply-fact-batch',
	RECORD_FOCUSED_INTERVAL: 'record-focused-interval',
	FINALIZE_ACTIVE_ALLOWANCE: 'finalize-active-allowance',
	RECONCILE_MEASUREMENT_REVISIONS: 'reconcile-measurement-revisions',
	RESET: 'reset',
} as const;

/**
 * Validates one statistics reducer operation discriminator.
 * @since 0.1.0 Initial implementation.
 */
export const StatisticsOperationTypeSchema = z.enum( StatisticsOperationType );

/**
 * Statistics reducer operation discriminator.
 * @since 0.1.0 Initial implementation.
 */
export type StatisticsOperationType = z.infer<typeof StatisticsOperationTypeSchema>;

/**
 * Validates one current scope measurement-revision entry.
 * @since 0.1.0 Initial implementation.
 */
const StatisticsMeasurementRevisionEntrySchema = z.tuple( [
	ProtectionScopeIdSchema,
	ProtectionMeasurementRevisionSchema,
] );

/**
 * One current scope measurement-revision entry.
 * @since 0.1.0 Initial implementation.
 */
type StatisticsMeasurementRevisionEntry = z.infer<
	typeof StatisticsMeasurementRevisionEntrySchema
>;

/**
 * Extracts own entries from one plain measurement-revision record input.
 * @param input - Unknown measurement-revision record input.
 * @return Own entries, or null for a non-plain record.
 * @since 0.1.0 Initial implementation.
 */
function extractStatisticsMeasurementRevisionEntries( input: unknown ): unknown {
	if ( typeof input !== 'object' || input === null || Array.isArray( input ) ) {
		return null;
	}

	const prototype: unknown = Object.getPrototypeOf( input );

	return prototype === Object.prototype || prototype === null
		? Object.entries( input )
		: null;
}

/**
 * Creates one prototype-safe measurement-revision record.
 * @param entries - Validated measurement-revision entries.
 * @return Current revisions indexed by their exact scope identifiers.
 * @since 0.1.0 Initial implementation.
 */
function createStatisticsMeasurementRevisionRecord(
	entries: StatisticsMeasurementRevisionEntry[],
): Record<string, ProtectionMeasurementRevision> {
	return Object.fromEntries( entries );
}

/**
 * Validates a complete map of current protection-scope measurement revisions.
 * @since 0.1.0 Initial implementation.
 */
export const StatisticsMeasurementRevisionsByScopeSchema = z.preprocess(
	extractStatisticsMeasurementRevisionEntries,
	z.array( StatisticsMeasurementRevisionEntrySchema ),
).transform( createStatisticsMeasurementRevisionRecord );

/**
 * Complete map of current protection-scope measurement revisions.
 * @since 0.1.0 Initial implementation.
 */
export type StatisticsMeasurementRevisionsByScope = z.infer<
	typeof StatisticsMeasurementRevisionsByScopeSchema
>;

/**
 * Validates one durable FIFO-head fact-batch application.
 * @since 0.1.0 Initial implementation.
 */
export const ApplyStatisticsFactBatchOperationSchema = z.object( {
	type: z.enum( [ StatisticsOperationType.APPLY_FACT_BATCH ] ),
	batch: ProtectionFactBatchSchema,
} ).strict();

/**
 * Durable FIFO-head fact-batch application.
 * @since 0.1.0 Initial implementation.
 */
export type ApplyStatisticsFactBatchOperation = z.infer<
	typeof ApplyStatisticsFactBatchOperationSchema
>;

/**
 * Validates the unrefined focused-interval operation shape.
 * @since 0.1.0 Initial implementation.
 */
const RecordFocusedIntervalOperationFieldsSchema = z.object( {
	type: z.enum( [ StatisticsOperationType.RECORD_FOCUSED_INTERVAL ] ),
	generationId: StatisticsGenerationIdSchema,
	scopeId: ProtectionScopeIdSchema,
	measurementRevision: ProtectionMeasurementRevisionSchema,
	allowanceId: AllowanceIdSchema,
	startedAtEpochMilliseconds: StatisticsNonNegativeSafeIntegerSchema,
	endedAtEpochMilliseconds: StatisticsNonNegativeSafeIntegerSchema,
} ).strict();

/**
 * Unrefined focused-interval operation values.
 * @since 0.1.0 Initial implementation.
 */
type RecordFocusedIntervalOperationFields = z.infer<
	typeof RecordFocusedIntervalOperationFieldsSchema
>;

/**
 * Adds focused-interval consistency issues to one refinement context.
 * @param operation - Focused-interval operation being refined.
 * @param context - Zod refinement context receiving consistency issues.
 * @since 0.1.0 Initial implementation.
 */
function refineRecordFocusedIntervalOperation(
	operation: RecordFocusedIntervalOperationFields,
	context: RefinementCtx,
): void {
	if ( operation.endedAtEpochMilliseconds < operation.startedAtEpochMilliseconds ) {
		context.addIssue( {
			code: 'custom',
			message: 'A focused interval cannot end before it starts.',
			path: [ 'endedAtEpochMilliseconds' ],
		} );
	}
}

/**
 * Validates one focused allowance interval checkpoint.
 * @since 0.1.0 Initial implementation.
 */
export const RecordFocusedIntervalOperationSchema = RecordFocusedIntervalOperationFieldsSchema.superRefine(
	refineRecordFocusedIntervalOperation,
);

/**
 * Focused allowance interval checkpoint.
 * @since 0.1.0 Initial implementation.
 */
export type RecordFocusedIntervalOperation = z.infer<
	typeof RecordFocusedIntervalOperationSchema
>;

/**
 * Validates one active allowance finalization operation.
 * @since 0.1.0 Initial implementation.
 */
export const FinalizeActiveAllowanceOperationSchema = z.object( {
	type: z.enum( [ StatisticsOperationType.FINALIZE_ACTIVE_ALLOWANCE ] ),
	generationId: StatisticsGenerationIdSchema,
	scopeId: ProtectionScopeIdSchema,
	measurementRevision: ProtectionMeasurementRevisionSchema,
	allowanceId: AllowanceIdSchema,
	finalizedAtEpochMilliseconds: StatisticsNonNegativeSafeIntegerSchema,
} ).strict();

/**
 * Active allowance finalization operation.
 * @since 0.1.0 Initial implementation.
 */
export type FinalizeActiveAllowanceOperation = z.infer<
	typeof FinalizeActiveAllowanceOperationSchema
>;

/**
 * Validates one complete measurement-revision reconciliation operation.
 * @since 0.1.0 Initial implementation.
 */
export const ReconcileMeasurementRevisionsOperationSchema = z.object( {
	type: z.enum( [ StatisticsOperationType.RECONCILE_MEASUREMENT_REVISIONS ] ),
	measurementRevisionsByScope: StatisticsMeasurementRevisionsByScopeSchema,
} ).strict();

/**
 * Complete measurement-revision reconciliation operation.
 * @since 0.1.0 Initial implementation.
 */
export type ReconcileMeasurementRevisionsOperation = z.infer<
	typeof ReconcileMeasurementRevisionsOperationSchema
>;

/**
 * Validates one statistics reset operation.
 * @since 0.1.0 Initial implementation.
 */
export const ResetStatisticsOperationSchema = z.object( {
	type: z.enum( [ StatisticsOperationType.RESET ] ),
	generationId: StatisticsGenerationIdSchema,
	measurementRevisionsByScope: StatisticsMeasurementRevisionsByScopeSchema,
} ).strict();

/**
 * Statistics reset operation under one fresh generation.
 * @since 0.1.0 Initial implementation.
 */
export type ResetStatisticsOperation = z.infer<typeof ResetStatisticsOperationSchema>;

/**
 * Validates one operation accepted by the deterministic statistics reducer.
 * @since 0.1.0 Initial implementation.
 */
export const StatisticsOperationSchema = z.discriminatedUnion( 'type', [
	ApplyStatisticsFactBatchOperationSchema,
	RecordFocusedIntervalOperationSchema,
	FinalizeActiveAllowanceOperationSchema,
	ReconcileMeasurementRevisionsOperationSchema,
	ResetStatisticsOperationSchema,
] );

/**
 * Operation accepted by the deterministic statistics reducer.
 * @since 0.1.0 Initial implementation.
 */
export type StatisticsOperation = z.infer<typeof StatisticsOperationSchema>;
