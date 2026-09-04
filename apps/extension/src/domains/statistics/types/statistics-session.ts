import { z, type RefinementCtx } from 'zod';
import {
	AllowanceIdSchema,
	ProtectionMeasurementRevisionSchema,
	ProtectionScopeIdSchema,
	SessionContinuityIdSchema,
} from '../../protection/types/protection-value';
import {
	StatisticsFocusEpochIdSchema,
	StatisticsGenerationIdSchema,
	StatisticsNonNegativeSafeIntegerSchema,
} from './statistics-value';

/**
 * Current focus epoch document version.
 * @since 0.1.0 Initial implementation.
 */
export const StatisticsFocusEpochDocumentVersion = 1;

/**
 * Validates the current focus epoch document version.
 * @since 0.1.0 Initial implementation.
 */
const StatisticsFocusEpochDocumentVersionSchema = z.number().int().nonnegative().refine(
	( value ) => value === StatisticsFocusEpochDocumentVersion,
	{ message: 'Statistics focus epoch document version is not supported.' },
);

/**
 * Validates one session-persisted focus observation epoch.
 * @since 0.1.0 Initial implementation.
 */
export const StatisticsFocusEpochDocumentSchema = z.object( {
	schemaVersion: StatisticsFocusEpochDocumentVersionSchema,
	focusEpochId: StatisticsFocusEpochIdSchema,
} ).strict();

/**
 * Session-persisted focus observation epoch.
 * @since 0.1.0 Initial implementation.
 */
export type StatisticsFocusEpochDocument = z.infer<
	typeof StatisticsFocusEpochDocumentSchema
>;

/**
 * Current session statistics document version.
 * @since 0.1.0 Initial implementation.
 */
export const StatisticsSessionDocumentVersion = 1;

/**
 * Validates the current session statistics document version.
 * @since 0.1.0 Initial implementation.
 */
const StatisticsSessionDocumentVersionSchema = z.number().int().nonnegative().refine(
	( value ) => value === StatisticsSessionDocumentVersion,
	{ message: 'Statistics session document version is not supported.' },
);

/**
 * Validates the identity shared by one piece of session focus work.
 * @since 0.1.0 Initial implementation.
 */
export const StatisticsSessionWorkIdentitySchema = z.object( {
	generationId: StatisticsGenerationIdSchema,
	scopeId: ProtectionScopeIdSchema,
	measurementRevision: ProtectionMeasurementRevisionSchema,
	allowanceId: AllowanceIdSchema,
} ).strict();

/**
 * Identity shared by one piece of session focus work.
 * @since 0.1.0 Initial implementation.
 */
export type StatisticsSessionWorkIdentity = z.infer<
	typeof StatisticsSessionWorkIdentitySchema
>;

/**
 * Validates one active focus anchor.
 * @since 0.1.0 Initial implementation.
 */
export const StatisticsFocusAnchorSchema = StatisticsSessionWorkIdentitySchema.extend( {
	sessionContinuityId: SessionContinuityIdSchema,
	focusEpochId: StatisticsFocusEpochIdSchema,
	focusedAtEpochMilliseconds: StatisticsNonNegativeSafeIntegerSchema,
} ).strict();

/**
 * Active focus anchor retained in session storage.
 * @since 0.1.0 Initial implementation.
 */
export type StatisticsFocusAnchor = z.infer<typeof StatisticsFocusAnchorSchema>;

/**
 * Validates the unrefined shape of one frozen pending focus interval.
 * @since 0.1.0 Initial implementation.
 */
const StatisticsPendingFocusIntervalFieldsSchema = StatisticsSessionWorkIdentitySchema.extend( {
	startedAtEpochMilliseconds: StatisticsNonNegativeSafeIntegerSchema,
	endedAtEpochMilliseconds: StatisticsNonNegativeSafeIntegerSchema,
} ).strict();

/**
 * Unrefined frozen pending focus interval values.
 * @since 0.1.0 Initial implementation.
 */
type StatisticsPendingFocusIntervalFields = z.infer<
	typeof StatisticsPendingFocusIntervalFieldsSchema
>;

/**
 * Adds pending focus interval consistency issues to one refinement context.
 * @param interval - Pending focus interval being refined.
 * @param context - Zod refinement context receiving consistency issues.
 * @since 0.1.0 Initial implementation.
 */
function refineStatisticsPendingFocusInterval(
	interval: StatisticsPendingFocusIntervalFields,
	context: RefinementCtx,
): void {
	if ( interval.endedAtEpochMilliseconds < interval.startedAtEpochMilliseconds ) {
		context.addIssue( {
			code: 'custom',
			message: 'A pending focus interval cannot end before it starts.',
			path: [ 'endedAtEpochMilliseconds' ],
		} );
	}
}

/**
 * Validates one frozen pending focus interval.
 * @since 0.1.0 Initial implementation.
 */
export const StatisticsPendingFocusIntervalSchema = StatisticsPendingFocusIntervalFieldsSchema.superRefine(
	refineStatisticsPendingFocusInterval,
);

/**
 * Frozen pending focus interval retained until durable aggregation succeeds.
 * @since 0.1.0 Initial implementation.
 */
export type StatisticsPendingFocusInterval = z.infer<
	typeof StatisticsPendingFocusIntervalSchema
>;

/**
 * Validates the unrefined shape of one compact session statistics document.
 * @since 0.1.0 Initial implementation.
 */
const StatisticsSessionDocumentFieldsSchema = z.object( {
	schemaVersion: StatisticsSessionDocumentVersionSchema,
	focusAnchor: StatisticsFocusAnchorSchema.optional(),
	pendingInterval: StatisticsPendingFocusIntervalSchema.optional(),
} ).strict();

/**
 * Unrefined compact session statistics document values.
 * @since 0.1.0 Initial implementation.
 */
type StatisticsSessionDocumentFields = z.infer<
	typeof StatisticsSessionDocumentFieldsSchema
>;

/**
 * Omits absent optional work from one session statistics document.
 * @param document - Refined session statistics values.
 * @return Canonical session document without owned undefined properties.
 * @since 0.1.0 Initial implementation.
 */
function canonicalizeStatisticsSessionDocument(
	document: StatisticsSessionDocumentFields,
): StatisticsSessionDocumentFields {
	return {
		schemaVersion: document.schemaVersion,
		...( document.focusAnchor === undefined
			? {}
			: { focusAnchor: document.focusAnchor } ),
		...( document.pendingInterval === undefined
			? {}
			: { pendingInterval: document.pendingInterval } ),
	};
}

/**
 * Validates one compact session statistics document.
 * @since 0.1.0 Initial implementation.
 */
export const StatisticsSessionDocumentSchema = StatisticsSessionDocumentFieldsSchema.transform(
	canonicalizeStatisticsSessionDocument,
);

/**
 * Compact session statistics document with at most one anchor and pending interval.
 * @since 0.1.0 Initial implementation.
 */
export type StatisticsSessionDocument = z.infer<typeof StatisticsSessionDocumentSchema>;
