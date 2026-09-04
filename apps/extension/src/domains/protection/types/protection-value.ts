import { z } from 'zod';

/**
 * Validates the shared ASCII syntax used by stable domain identifiers.
 * @since 0.1.0 Initial implementation.
 */
const StableIdentifierSchema = z.string().regex( /^[A-Za-z0-9_-]+$/ );

/**
 * Validates a stable protection-scope identifier that cannot be an integer-like object key.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionScopeIdSchema = StableIdentifierSchema
	.regex( /[A-Za-z_-]/ )
	.brand<'ProtectionScopeId'>();

/**
 * Stable identifier for the shared default protection scope.
 * @since 0.1.0 Initial implementation.
 */
export const DefaultProtectionScopeId = ProtectionScopeIdSchema.parse( 'scope_default' );

/**
 * Stable identifier for one protection scope.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionScopeId = z.infer<typeof ProtectionScopeIdSchema>;

/**
 * Validates an opaque revision that identifies one protection scope's measurement contract.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionMeasurementRevisionSchema = StableIdentifierSchema
	.brand<'ProtectionMeasurementRevision'>();

/**
 * Opaque revision for one protection scope's measurement contract.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionMeasurementRevision = z.infer<typeof ProtectionMeasurementRevisionSchema>;

/**
 * Creates one globally unique stable measurement revision.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionMeasurementRevisionFactory = () => unknown;

/**
 * Validates a stable browser-page identifier.
 * @since 0.1.0 Initial implementation.
 */
export const PageIdSchema = StableIdentifierSchema.brand<'PageId'>();

/**
 * Stable identifier for one browser page.
 * @since 0.1.0 Initial implementation.
 */
export type PageId = z.infer<typeof PageIdSchema>;

/**
 * Validates a stable wait-participant identifier.
 * @since 0.1.0 Initial implementation.
 */
export const ParticipantIdSchema = StableIdentifierSchema.brand<'ParticipantId'>();

/**
 * Stable identifier for one wait participant.
 * @since 0.1.0 Initial implementation.
 */
export type ParticipantId = z.infer<typeof ParticipantIdSchema>;

/**
 * Validates a stable wait identifier.
 * @since 0.1.0 Initial implementation.
 */
export const WaitIdSchema = StableIdentifierSchema.brand<'WaitId'>();

/**
 * Stable identifier for one shared wait.
 * @since 0.1.0 Initial implementation.
 */
export type WaitId = z.infer<typeof WaitIdSchema>;

/**
 * Validates a stable allowance identifier.
 * @since 0.1.0 Initial implementation.
 */
export const AllowanceIdSchema = StableIdentifierSchema.brand<'AllowanceId'>();

/**
 * Stable identifier for one wall-clock allowance.
 * @since 0.1.0 Initial implementation.
 */
export type AllowanceId = z.infer<typeof AllowanceIdSchema>;

/**
 * Validates a stable domain-fact identifier.
 * @since 0.1.0 Initial implementation.
 */
export const FactIdSchema = StableIdentifierSchema.brand<'FactId'>();

/**
 * Stable identifier for one emitted domain fact.
 * @since 0.1.0 Initial implementation.
 */
export type FactId = z.infer<typeof FactIdSchema>;

/**
 * Validates a stable protection-fact batch identifier.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionFactBatchIdSchema = StableIdentifierSchema.brand<'ProtectionFactBatchId'>();

/**
 * Stable identifier for one durable protection-fact batch.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionFactBatchId = z.infer<typeof ProtectionFactBatchIdSchema>;

/**
 * Validates a stable browser-session continuity identifier.
 * @since 0.1.0 Initial implementation.
 */
export const SessionContinuityIdSchema = StableIdentifierSchema.brand<'SessionContinuityId'>();

/**
 * Stable identifier proving one continuous browser session.
 * @since 0.1.0 Initial implementation.
 */
export type SessionContinuityId = z.infer<typeof SessionContinuityIdSchema>;

/**
 * Validates a non-negative whole Unix epoch value in milliseconds.
 * @since 0.1.0 Initial implementation.
 */
export const EpochMillisecondsSchema = z.number().int().nonnegative();

/**
 * Non-negative Unix epoch value in milliseconds.
 * @since 0.1.0 Initial implementation.
 */
export type EpochMilliseconds = z.infer<typeof EpochMillisecondsSchema>;

/**
 * Validates a non-negative whole duration in milliseconds.
 * @since 0.1.0 Initial implementation.
 */
export const DurationMillisecondsSchema = z.number().int().nonnegative();

/**
 * Non-negative duration in milliseconds.
 * @since 0.1.0 Initial implementation.
 */
export type DurationMilliseconds = z.infer<typeof DurationMillisecondsSchema>;

/**
 * Validates a non-negative ownership-generation counter.
 * @since 0.1.0 Initial implementation.
 */
export const OwnerEpochSchema = z.number().int().nonnegative();

/**
 * Ownership-generation counter for one shared wait.
 * @since 0.1.0 Initial implementation.
 */
export type OwnerEpoch = z.infer<typeof OwnerEpochSchema>;

/**
 * Validates a non-negative participant join-order value.
 * @since 0.1.0 Initial implementation.
 */
export const JoinSequenceSchema = z.number().int().nonnegative();

/**
 * Stable participant join-order value within one shared wait.
 * @since 0.1.0 Initial implementation.
 */
export type JoinSequence = z.infer<typeof JoinSequenceSchema>;

/**
 * Validates a retained HTTP(S) navigation destination.
 * @since 0.1.0 Initial implementation.
 */
export const RetainedNavigationDestinationSchema = z.url( { protocol: /^https?$/ } );

/**
 * Validated retained HTTP(S) navigation destination.
 * @since 0.1.0 Initial implementation.
 */
export type RetainedNavigationDestination = z.infer<typeof RetainedNavigationDestinationSchema>;
/**
 * Validates a real ISO calendar date in YYYY-MM-DD form.
 * @since 0.1.0 Initial implementation.
 */
export const LocalDateSchema = z
	.string()
	.regex( /^\d{4}-\d{2}-\d{2}$/ )
	.refine( ( value ) => {
		const parsedDate = new Date( `${ value }T00:00:00.000Z` );
		return Number.isFinite( parsedDate.getTime() ) && parsedDate.toISOString().slice( 0, 10 ) === value;
	} )
	.brand<'LocalDate'>();

/**
 * Validated ISO calendar date in YYYY-MM-DD form.
 * @since 0.1.0 Initial implementation.
 */
export type LocalDate = z.infer<typeof LocalDateSchema>;
