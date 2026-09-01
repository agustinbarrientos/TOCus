import { z } from 'zod';
import {
	AllowanceIdSchema,
	DurationMillisecondsSchema,
	EpochMillisecondsSchema,
	LocalDateSchema,
	OwnerEpochSchema,
	PageIdSchema,
	ParticipantIdSchema,
	ProtectionScopeIdSchema,
	RetainedNavigationDestinationSchema,
	WaitIdSchema,
} from './protection-value';
import { ProtectedUrlMatchResultSchema } from './protected-url-match';
import { ScheduleEvaluationResultSchema } from './schedule-evaluation';
import { VisitAttemptParticipantSchema } from './protection-participant';
import { ProtectionStateTargetSchema } from './protection-state';
import { TimingConfigurationSchema } from './timing-configuration';

/**
 * Validates a retained navigation destination or an explicit null value.
 * @since 0.1.0 Initial implementation.
 */
const NullableRetainedNavigationDestinationSchema = z.union( [ RetainedNavigationDestinationSchema, z.null() ] );

/**
 * Observable causes for a participant leaving protected state.
 * @since 0.1.0 Initial implementation.
 */
export const DepartureCause = {
	ACTIVE_SESSION_TAB_CLOSE: 'active-session-tab-close',
	ACTIVE_SESSION_WINDOW_CLOSE: 'active-session-window-close',
	BACK: 'back',
	NON_EXTENSION_TOP_LEVEL_NAVIGATION_AWAY: 'non-extension-top-level-navigation-away',
	REDIRECT: 'redirect',
	AUTHENTICATION_HANDOFF: 'authentication-handoff',
	PROGRAMMATIC_NAVIGATION: 'programmatic-navigation',
	BROWSER_ERROR_OR_RECOVERY: 'browser-error-or-recovery',
	SCHEDULE_DEACTIVATION: 'schedule-deactivation',
	PERMISSION_LOSS: 'permission-loss',
	BROWSER_TERMINATION: 'browser-termination',
	EXTENSION_TERMINATION: 'extension-termination',
	CONFIGURATION_CHANGE: 'configuration-change',
	STORAGE_FAILURE: 'storage-failure',
	UNKNOWN: 'unknown',
} as const;

/**
 * Validates an observable participant-departure cause.
 * @since 0.1.0 Initial implementation.
 */
export const DepartureCauseSchema = z.enum( DepartureCause );

/**
 * Observable cause for a participant leaving protected state.
 * @since 0.1.0 Initial implementation.
 */
export type DepartureCause = z.infer<typeof DepartureCauseSchema>;

/**
 * Departure causes that represent one reconsidered navigation visit.
 * @since 0.1.0 Initial implementation.
 */
export const QualifyingDepartureCause = {
	ACTIVE_SESSION_TAB_CLOSE: DepartureCause.ACTIVE_SESSION_TAB_CLOSE,
	ACTIVE_SESSION_WINDOW_CLOSE: DepartureCause.ACTIVE_SESSION_WINDOW_CLOSE,
	BACK: DepartureCause.BACK,
	NON_EXTENSION_TOP_LEVEL_NAVIGATION_AWAY: DepartureCause.NON_EXTENSION_TOP_LEVEL_NAVIGATION_AWAY,
} as const;

/**
 * Validates a departure cause that represents one reconsidered navigation visit.
 * @since 0.1.0 Initial implementation.
 */
export const QualifyingDepartureCauseSchema = z.enum( QualifyingDepartureCause );

/**
 * Departure cause that represents one reconsidered navigation visit.
 * @since 0.1.0 Initial implementation.
 */
export type QualifyingDepartureCause = z.infer<typeof QualifyingDepartureCauseSchema>;

/**
 * Candidate sources supplied to an allowance-expiry transaction.
 * @since 0.1.0 Initial implementation.
 */
export const AllowanceExpiryCandidateSource = {
	LIVE_PAGE: 'live-page',
	READY_PARTICIPANT: 'ready-participant',
} as const;

/**
 * Validates an allowance-expiry candidate source.
 * @since 0.1.0 Initial implementation.
 */
export const AllowanceExpiryCandidateSourceSchema = z.enum( AllowanceExpiryCandidateSource );

/**
 * Source of one allowance-expiry candidate observation.
 * @since 0.1.0 Initial implementation.
 */
export type AllowanceExpiryCandidateSource = z.infer<typeof AllowanceExpiryCandidateSourceSchema>;

/**
 * Events accepted by protection-state transitions.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionEventType = {
	VISIT_ATTEMPT: 'visit-attempt',
	PARTICIPANT_FOCUS_CHANGE: 'participant-focus-change',
	PROGRESS_CHECKPOINT: 'progress-checkpoint',
	PARTICIPANT_DEPARTURE: 'participant-departure',
	SCHEDULE_REEVALUATION: 'schedule-reevaluation',
	READY_CONTINUATION: 'ready-continuation',
	READY_RECONCILIATION: 'ready-reconciliation',
	ALLOWANCE_EXPIRY: 'allowance-expiry',
} as const;

/**
 * Validates a protection-event discriminator.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionEventTypeSchema = z.enum( ProtectionEventType );

/**
 * Protection-event discriminator.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionEventType = z.infer<typeof ProtectionEventTypeSchema>;

/**
 * Validates a protected visit-attempt event.
 * @since 0.1.0 Initial implementation.
 */
export const VisitAttemptEventSchema = z.object( {
	type: z.enum( [ ProtectionEventType.VISIT_ATTEMPT ] ),
	scopeId: ProtectionScopeIdSchema,
	participant: VisitAttemptParticipantSchema,
	schedule: ScheduleEvaluationResultSchema,
	observedLocalDate: LocalDateSchema,
	timingConfiguration: TimingConfigurationSchema,
	waitId: WaitIdSchema,
	nowEpochMilliseconds: EpochMillisecondsSchema,
} ).strict();

/**
 * Protected visit-attempt event handled by the waiting lifecycle.
 * @remarks Coordinators must serialize each participant lifecycle, treat departure as terminal for a participant identifier, issue a fresh identifier for a later visit, and process expired allowances before dispatching a visit attempt.
 * @since 0.1.0 Initial implementation.
 */
export type VisitAttemptEvent = z.infer<typeof VisitAttemptEventSchema>;

/**
 * Validates a participant focus-change event.
 * @since 0.1.0 Initial implementation.
 */
export const ParticipantFocusChangeEventSchema = z.object( {
	type: z.enum( [ ProtectionEventType.PARTICIPANT_FOCUS_CHANGE ] ),
	scopeId: ProtectionScopeIdSchema,
	waitId: WaitIdSchema,
	participantId: ParticipantIdSchema,
	ownerEpoch: OwnerEpochSchema,
	focusEligible: z.boolean(),
} ).strict();

/**
 * Participant focus-change event handled by the waiting lifecycle.
 * @since 0.1.0 Initial implementation.
 */
export type ParticipantFocusChangeEvent = z.infer<typeof ParticipantFocusChangeEventSchema>;

/**
 * Validates one current participant, destination, rule-match, and schedule observation.
 * @since 0.1.0 Initial implementation.
 */
export const FreshParticipantObservationSchema = z.object( {
	participantId: ParticipantIdSchema,
	pageId: PageIdSchema,
	observedDestination: NullableRetainedNavigationDestinationSchema,
	match: ProtectedUrlMatchResultSchema,
	schedule: ScheduleEvaluationResultSchema,
} ).strict();

/**
 * Current participant, destination, rule-match, and schedule observation.
 * @since 0.1.0 Initial implementation.
 */
export type FreshParticipantObservation = z.infer<typeof FreshParticipantObservationSchema>;

/**
 * Validates an allowance-expiry candidate observed from a live page.
 * @since 0.1.0 Initial implementation.
 */
export const LivePageAllowanceExpiryCandidateSchema = z.object( {
	source: z.enum( [ AllowanceExpiryCandidateSource.LIVE_PAGE ] ),
	participantId: ParticipantIdSchema,
	pageId: PageIdSchema,
	observedDestination: RetainedNavigationDestinationSchema,
	focusEligible: z.boolean(),
	match: ProtectedUrlMatchResultSchema,
} ).strict();

/**
 * Live-page candidate observed for one allowance-expiry transaction.
 * @since 0.1.0 Initial implementation.
 */
export type LivePageAllowanceExpiryCandidate = z.infer<typeof LivePageAllowanceExpiryCandidateSchema>;

/**
 * Validates an allowance-expiry candidate retained in Ready state.
 * @since 0.1.0 Initial implementation.
 */
export const ReadyAllowanceExpiryCandidateSchema = z.object( {
	source: z.enum( [ AllowanceExpiryCandidateSource.READY_PARTICIPANT ] ),
	participantId: ParticipantIdSchema,
	pageId: PageIdSchema,
	observedDestination: NullableRetainedNavigationDestinationSchema,
	focusEligible: z.boolean(),
	match: ProtectedUrlMatchResultSchema,
} ).strict();

/**
 * Ready-participant candidate observed for one allowance-expiry transaction.
 * @since 0.1.0 Initial implementation.
 */
export type ReadyAllowanceExpiryCandidate = z.infer<typeof ReadyAllowanceExpiryCandidateSchema>;

/**
 * Validates one live-page or Ready candidate for atomic allowance expiry.
 * @since 0.1.0 Initial implementation.
 */
export const AllowanceExpiryCandidateSchema = z.discriminatedUnion( 'source', [
	LivePageAllowanceExpiryCandidateSchema,
	ReadyAllowanceExpiryCandidateSchema,
] );

/**
 * Live-page or Ready candidate for atomic allowance expiry.
 * @since 0.1.0 Initial implementation.
 */
export type AllowanceExpiryCandidate = z.infer<typeof AllowanceExpiryCandidateSchema>;

/**
 * Validates a cumulative progress-checkpoint event for the current wait owner.
 * @since 0.1.0 Initial implementation.
 */
export const ProgressCheckpointEventSchema = z.object( {
	type: z.enum( [ ProtectionEventType.PROGRESS_CHECKPOINT ] ),
	scopeId: ProtectionScopeIdSchema,
	waitId: WaitIdSchema,
	ownerParticipantId: ParticipantIdSchema,
	ownerEpoch: OwnerEpochSchema,
	cumulativeCheckpointMilliseconds: DurationMillisecondsSchema,
	observedAtEpochMilliseconds: EpochMillisecondsSchema,
	completionLocalDate: LocalDateSchema,
	allowanceId: AllowanceIdSchema,
	timingConfiguration: TimingConfigurationSchema,
	automaticCompletionObservation: z.union( [ FreshParticipantObservationSchema, z.null() ] ),
} ).strict().superRefine( ( event, context ) => {
	const allowanceExpiryEpochMilliseconds =
		event.observedAtEpochMilliseconds + event.timingConfiguration.allowanceMilliseconds;

	if ( ! EpochMillisecondsSchema.safeParse( allowanceExpiryEpochMilliseconds ).success ) {
		context.addIssue( {
			code: 'custom',
			message: 'Progress observation must leave room for its configured allowance interval.',
			path: [ 'observedAtEpochMilliseconds' ],
		} );
	}
} );

/**
 * Cumulative progress-checkpoint event handled by the waiting lifecycle.
 * @since 0.1.0 Initial implementation.
 */
export type ProgressCheckpointEvent = z.infer<typeof ProgressCheckpointEventSchema>;

/**
 * Validates a participant-departure event.
 * @since 0.1.0 Initial implementation.
 */
export const ParticipantDepartureEventSchema = z.object( {
	type: z.enum( [ ProtectionEventType.PARTICIPANT_DEPARTURE ] ),
	scopeId: ProtectionScopeIdSchema,
	target: ProtectionStateTargetSchema,
	participantId: ParticipantIdSchema,
	pageId: PageIdSchema,
	cause: DepartureCauseSchema,
	observedAtEpochMilliseconds: EpochMillisecondsSchema,
} ).strict();

/**
 * Participant-departure event handled by Waiting or Allowance state.
 * @since 0.1.0 Initial implementation.
 */
export type ParticipantDepartureEvent = z.infer<typeof ParticipantDepartureEventSchema>;

/**
 * Validates a schedule-reevaluation event.
 * @since 0.1.0 Initial implementation.
 */
export const ScheduleReevaluationEventSchema = z.object( {
	type: z.enum( [ ProtectionEventType.SCHEDULE_REEVALUATION ] ),
	scopeId: ProtectionScopeIdSchema,
	target: ProtectionStateTargetSchema,
	schedule: ScheduleEvaluationResultSchema,
} ).strict();

/**
 * Schedule-reevaluation event handled by Waiting or Allowance state.
 * @since 0.1.0 Initial implementation.
 */
export type ScheduleReevaluationEvent = z.infer<typeof ScheduleReevaluationEventSchema>;

/**
 * Validates a manual Ready-continuation event.
 * @since 0.1.0 Initial implementation.
 */
export const ReadyContinuationEventSchema = z.object( {
	type: z.enum( [ ProtectionEventType.READY_CONTINUATION ] ),
	scopeId: ProtectionScopeIdSchema,
	allowanceId: AllowanceIdSchema,
	nowEpochMilliseconds: EpochMillisecondsSchema,
	observation: FreshParticipantObservationSchema,
} ).strict();

/**
 * Explicit Ready-participant continuation event handled during Allowance state.
 * @since 0.1.0 Initial implementation.
 */
export type ReadyContinuationEvent = z.infer<typeof ReadyContinuationEventSchema>;

/**
 * Validates a Ready-participant reconciliation event.
 * @since 0.1.0 Initial implementation.
 */
export const ReadyReconciliationEventSchema = z.object( {
	type: z.enum( [ ProtectionEventType.READY_RECONCILIATION ] ),
	scopeId: ProtectionScopeIdSchema,
	allowanceId: AllowanceIdSchema,
	nowEpochMilliseconds: EpochMillisecondsSchema,
	observation: FreshParticipantObservationSchema,
} ).strict();

/**
 * Ready-participant reconciliation event handled during Allowance state.
 * @since 0.1.0 Initial implementation.
 */
export type ReadyReconciliationEvent = z.infer<typeof ReadyReconciliationEventSchema>;

/**
 * Validates an allowance-expiry transaction event.
 * @since 0.1.0 Initial implementation.
 */
export const AllowanceExpiryEventSchema = z.object( {
	type: z.enum( [ ProtectionEventType.ALLOWANCE_EXPIRY ] ),
	scopeId: ProtectionScopeIdSchema,
	allowanceId: AllowanceIdSchema,
	newWaitId: WaitIdSchema,
	nowEpochMilliseconds: EpochMillisecondsSchema,
	observedLocalDate: LocalDateSchema,
	timingConfiguration: TimingConfigurationSchema,
	schedule: ScheduleEvaluationResultSchema,
	candidates: z.array( AllowanceExpiryCandidateSchema ),
} ).strict();

/**
 * Atomic allowance-expiry transaction event handled at the allowance boundary.
 * @remarks Coordinators must hold a per-scope serialization barrier while collecting complete live candidates and applying this event; concurrent visits must queue or be included in the candidate snapshot.
 * @since 0.1.0 Initial implementation.
 */
export type AllowanceExpiryEvent = z.infer<typeof AllowanceExpiryEventSchema>;

/**
 * Validates every event accepted by the protection-state transition function.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionEventSchema = z.discriminatedUnion( 'type', [
	VisitAttemptEventSchema,
	ParticipantFocusChangeEventSchema,
	ProgressCheckpointEventSchema,
	ParticipantDepartureEventSchema,
	ScheduleReevaluationEventSchema,
	ReadyContinuationEventSchema,
	ReadyReconciliationEventSchema,
	AllowanceExpiryEventSchema,
] );

/**
 * Event accepted by the protection-state transition function.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionEvent = z.infer<typeof ProtectionEventSchema>;
