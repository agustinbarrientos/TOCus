import { z, type RefinementCtx } from 'zod';
import { AllowanceDurationMillisecondsSchema } from './allowance-duration';
import {
	AllowanceIdSchema,
	DurationMillisecondsSchema,
	EpochMillisecondsSchema,
	FactIdSchema,
	LocalDateSchema,
	OwnerEpochSchema,
	ParticipantIdSchema,
	ProtectionScopeIdSchema,
	WaitIdSchema,
} from './protection-value';
import { QualifyingDepartureCauseSchema } from './protection-event';
import { WaitDurationMillisecondsSchema } from './wait-duration';

/**
 * Metric-bearing facts emitted by accepted state transitions.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionFactType = {
	PAUSE_TIME: 'pause-time',
	RECONSIDERED_VISIT: 'reconsidered-visit',
	COMPLETED_WAIT: 'completed-wait',
	ALLOWANCE_GRANTED: 'allowance-granted',
} as const;

/**
 * Validates a protection-fact discriminator.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionFactTypeSchema = z.enum( ProtectionFactType );

/**
 * Protection-fact discriminator.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionFactType = z.infer<typeof ProtectionFactTypeSchema>;

/**
 * Validates the fields shared by pause-time fact inputs and emitted facts.
 * @since 0.1.0 Initial implementation.
 */
const PauseTimeFactFieldsSchema = z.object( {
	scopeId: ProtectionScopeIdSchema,
	waitId: WaitIdSchema,
	ownerParticipantId: ParticipantIdSchema,
	ownerEpoch: OwnerEpochSchema.positive(),
	checkpointHighWaterMilliseconds: DurationMillisecondsSchema.positive(),
	acceptedDurationMilliseconds: DurationMillisecondsSchema.positive(),
	observedAtEpochMilliseconds: EpochMillisecondsSchema,
} ).strict();

/**
 * Fields shared by pause-time fact inputs and emitted facts.
 * @since 0.1.0 Initial implementation.
 */
type PauseTimeFactFields = z.infer<typeof PauseTimeFactFieldsSchema>;

/**
 * Adds pause-time consistency issues to one fact refinement context.
 * @param fact - Pause-time values being refined.
 * @param context - Zod refinement context receiving consistency issues.
 * @since 0.1.0 Initial implementation.
 */
function refinePauseTimeFact(
	fact: PauseTimeFactFields,
	context: RefinementCtx,
): void {
	if ( fact.acceptedDurationMilliseconds > fact.checkpointHighWaterMilliseconds ) {
		context.addIssue( {
			code: 'custom',
			message: 'Accepted pause time cannot exceed the cumulative checkpoint high-water.',
			path: [ 'acceptedDurationMilliseconds' ],
		} );
	}
}

/**
 * Validates a pause-time fact emitted for accepted wait progress.
 * @since 0.1.0 Initial implementation.
 */
export const PauseTimeFactSchema = PauseTimeFactFieldsSchema.extend( {
	type: z.enum( [ ProtectionFactType.PAUSE_TIME ] ),
	factId: FactIdSchema,
} ).superRefine( refinePauseTimeFact );

/**
 * Pause-time fact emitted for accepted wait progress.
 * @since 0.1.0 Initial implementation.
 */
export type PauseTimeFact = z.infer<typeof PauseTimeFactSchema>;

/**
 * Validates the domain values used to build a pause-time fact.
 * @since 0.1.0 Initial implementation.
 */
export const PauseTimeFactInputSchema = PauseTimeFactFieldsSchema.superRefine( refinePauseTimeFact );

/**
 * Domain values used to build a pause-time fact.
 * @since 0.1.0 Initial implementation.
 */
export type PauseTimeFactInput = z.infer<typeof PauseTimeFactInputSchema>;

/**
 * Validates a reconsidered-visit fact emitted for a qualifying departure.
 * @since 0.1.0 Initial implementation.
 */
export const ReconsideredVisitFactSchema = z.object( {
	type: z.enum( [ ProtectionFactType.RECONSIDERED_VISIT ] ),
	factId: FactIdSchema,
	scopeId: ProtectionScopeIdSchema,
	waitId: WaitIdSchema,
	participantId: ParticipantIdSchema,
	departureCause: QualifyingDepartureCauseSchema,
	observedAtEpochMilliseconds: EpochMillisecondsSchema,
} ).strict();

/**
 * Reconsidered-visit fact emitted for a qualifying departure.
 * @since 0.1.0 Initial implementation.
 */
export type ReconsideredVisitFact = z.infer<typeof ReconsideredVisitFactSchema>;

/**
 * Validates the domain values used to build a reconsidered-visit fact.
 * @since 0.1.0 Initial implementation.
 */
export const ReconsideredVisitFactInputSchema = ReconsideredVisitFactSchema.omit( { type: true, factId: true } );

/**
 * Domain values used to build a reconsidered-visit fact.
 * @since 0.1.0 Initial implementation.
 */
export type ReconsideredVisitFactInput = z.infer<typeof ReconsideredVisitFactInputSchema>;

/**
 * Validates a completed-wait fact.
 * @since 0.1.0 Initial implementation.
 */
export const CompletedWaitFactSchema = z.object( {
	type: z.enum( [ ProtectionFactType.COMPLETED_WAIT ] ),
	factId: FactIdSchema,
	scopeId: ProtectionScopeIdSchema,
	waitId: WaitIdSchema,
	capturedWaitDurationMilliseconds: WaitDurationMillisecondsSchema,
	completedAtEpochMilliseconds: EpochMillisecondsSchema,
	completionLocalDate: LocalDateSchema,
} ).strict();

/**
 * Completed-wait fact.
 * @since 0.1.0 Initial implementation.
 */
export type CompletedWaitFact = z.infer<typeof CompletedWaitFactSchema>;

/**
 * Validates the domain values used to build a completed-wait fact.
 * @since 0.1.0 Initial implementation.
 */
export const CompletedWaitFactInputSchema = CompletedWaitFactSchema.omit( { type: true, factId: true } );

/**
 * Domain values used to build a completed-wait fact.
 * @since 0.1.0 Initial implementation.
 */
export type CompletedWaitFactInput = z.infer<typeof CompletedWaitFactInputSchema>;

/**
 * Validates the fields shared by allowance-granted fact inputs and emitted facts.
 * @since 0.1.0 Initial implementation.
 */
const AllowanceGrantedFactFieldsSchema = z.object( {
	scopeId: ProtectionScopeIdSchema,
	allowanceId: AllowanceIdSchema,
	startedAtEpochMilliseconds: EpochMillisecondsSchema,
	expiresAtEpochMilliseconds: EpochMillisecondsSchema,
	allowanceDurationMilliseconds: AllowanceDurationMillisecondsSchema,
} ).strict();

/**
 * Fields shared by allowance-granted fact inputs and emitted facts.
 * @since 0.1.0 Initial implementation.
 */
type AllowanceGrantedFactFields = z.infer<typeof AllowanceGrantedFactFieldsSchema>;

/**
 * Adds allowance interval consistency issues to one fact refinement context.
 * @param fact - Allowance values being refined.
 * @param context - Zod refinement context receiving consistency issues.
 * @since 0.1.0 Initial implementation.
 */
function refineAllowanceGrantedFact(
	fact: AllowanceGrantedFactFields,
	context: RefinementCtx,
): void {
	const allowanceIntervalMilliseconds =
		fact.expiresAtEpochMilliseconds - fact.startedAtEpochMilliseconds;

	if ( ! AllowanceDurationMillisecondsSchema.safeParse( allowanceIntervalMilliseconds ).success ) {
		context.addIssue( {
			code: 'custom',
			message: 'Allowance fact interval must span one through sixty whole minutes.',
			path: [ 'expiresAtEpochMilliseconds' ],
		} );
	}

	if ( allowanceIntervalMilliseconds !== fact.allowanceDurationMilliseconds ) {
		context.addIssue( {
			code: 'custom',
			message: 'Allowance fact duration must equal its expiry interval.',
			path: [ 'allowanceDurationMilliseconds' ],
		} );
	}
}

/**
 * Validates an allowance-granted fact.
 * @since 0.1.0 Initial implementation.
 */
export const AllowanceGrantedFactSchema = AllowanceGrantedFactFieldsSchema.extend( {
	type: z.enum( [ ProtectionFactType.ALLOWANCE_GRANTED ] ),
	factId: FactIdSchema,
} ).superRefine( refineAllowanceGrantedFact );

/**
 * Allowance-granted fact.
 * @since 0.1.0 Initial implementation.
 */
export type AllowanceGrantedFact = z.infer<typeof AllowanceGrantedFactSchema>;

/**
 * Validates the domain values used to build an allowance-granted fact.
 * @since 0.1.0 Initial implementation.
 */
export const AllowanceGrantedFactInputSchema = AllowanceGrantedFactFieldsSchema.superRefine(
	refineAllowanceGrantedFact,
);

/**
 * Domain values used to build an allowance-granted fact.
 * @since 0.1.0 Initial implementation.
 */
export type AllowanceGrantedFactInput = z.infer<typeof AllowanceGrantedFactInputSchema>;

/**
 * Validates a metric-bearing fact emitted by an accepted protection transition.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionFactSchema = z.discriminatedUnion( 'type', [
	PauseTimeFactSchema,
	ReconsideredVisitFactSchema,
	CompletedWaitFactSchema,
	AllowanceGrantedFactSchema,
] );

/**
 * Metric-bearing fact emitted by an accepted protection transition.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionFact = z.infer<typeof ProtectionFactSchema>;
