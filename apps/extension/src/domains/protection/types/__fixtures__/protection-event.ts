import { ProtectedUrlMatchStatus } from '../protected-url-match';
import { ScheduleEvaluationStatus } from '../schedule-evaluation';
import { CompletionAction } from '../completion-action';
import { ProtectionParticipantOrigin } from '../protection-participant';
import { ProtectionStateType } from '../protection-state';
import {
	AllowanceExpiryCandidateSchema,
	AllowanceExpiryCandidateSource,
	FreshParticipantObservationSchema,
	ProtectionEventSchema,
	ProtectionEventType,
	type AllowanceExpiryCandidate,
	type AllowanceExpiryEvent,
	type FreshParticipantObservation,
	type ParticipantDepartureEvent,
	type ParticipantFocusChangeEvent,
	type ProgressCheckpointEvent,
	type ReadyContinuationEvent,
	type ReadyReconciliationEvent,
	type ScheduleReevaluationEvent,
	type VisitAttemptEvent,
} from '../protection-event';

/**
 * Stable wall-clock instant used by protection transition tests.
 * @since 0.1.0 Initial implementation.
 */
export const TestInstant = 1_800_000_000_000;

/**
 * Stable timing configuration used by protection transition tests.
 * @since 0.1.0 Initial implementation.
 */
export const TestTimingConfiguration = Object.freeze( {
	initialWaitMilliseconds: 10_000,
	ladderIncreaseMilliseconds: 5_000,
	maximumWaitMilliseconds: 60_000,
	allowanceMilliseconds: 300_000,
	completionAction: CompletionAction.SHOW_CONTINUE,
} );

/**
 * Creates a protected visit-attempt event fixture.
 * @param participantId - Stable participant identifier.
 * @param pageId - Stable page identifier.
 * @param focusEligible - Whether the attempted page may own progress.
 * @param overrides - Top-level event values overriding the defaults before validation.
 * @return A protected visit-attempt event.
 * @since 0.1.0 Initial implementation.
 */
export function createVisitAttempt(
	participantId = 'participant-a',
	pageId = 'page-a',
	focusEligible = true,
	overrides: Record<string, unknown> = {},
): VisitAttemptEvent {
	const event = ProtectionEventSchema.parse( {
		type: ProtectionEventType.VISIT_ATTEMPT,
		scopeId: 'scope-default',
		participant: {
			origin: ProtectionParticipantOrigin.NAVIGATION,
			participantId,
			pageId,
			retainedDestination: `https://example.com/${ pageId }`,
			focusEligible,
		},
		schedule: { status: ScheduleEvaluationStatus.ACTIVE },
		observedLocalDate: '2026-08-31',
		timingConfiguration: { ...TestTimingConfiguration },
		waitId: 'wait-a',
		nowEpochMilliseconds: TestInstant,
		...overrides,
	} );

	if ( event.type !== ProtectionEventType.VISIT_ATTEMPT ) {
		throw new Error( 'Expected a visit-attempt event fixture.' );
	}

	return event;
}

/**
 * Creates a participant focus-change event fixture.
 * @param participantId - Stable participant identifier.
 * @param focusEligible - New focus eligibility.
 * @param ownerEpoch - Current owner epoch supplied by the coordinator.
 * @param overrides - Top-level event values overriding the defaults before validation.
 * @return A participant focus-change event.
 * @since 0.1.0 Initial implementation.
 */
export function createFocusChange(
	participantId = 'participant-a',
	focusEligible = false,
	ownerEpoch = 1,
	overrides: Record<string, unknown> = {},
): ParticipantFocusChangeEvent {
	const event = ProtectionEventSchema.parse( {
		type: ProtectionEventType.PARTICIPANT_FOCUS_CHANGE,
		scopeId: 'scope-default',
		waitId: 'wait-a',
		participantId,
		ownerEpoch,
		focusEligible,
		...overrides,
	} );

	if ( event.type !== ProtectionEventType.PARTICIPANT_FOCUS_CHANGE ) {
		throw new Error( 'Expected a participant-focus-change event fixture.' );
	}

	return event;
}

/**
 * Creates a cumulative owner progress-checkpoint event fixture.
 * @param cumulativeCheckpointMilliseconds - Cumulative checkpoint for the current owner epoch.
 * @param overrides - Top-level event values overriding the defaults before validation.
 * @return A progress-checkpoint event.
 * @since 0.1.0 Initial implementation.
 */
export function createProgressCheckpoint(
	cumulativeCheckpointMilliseconds = 2_000,
	overrides: Record<string, unknown> = {},
): ProgressCheckpointEvent {
	const event = ProtectionEventSchema.parse( {
		type: ProtectionEventType.PROGRESS_CHECKPOINT,
		scopeId: 'scope-default',
		waitId: 'wait-a',
		ownerParticipantId: 'participant-a',
		ownerEpoch: 1,
		cumulativeCheckpointMilliseconds,
		observedAtEpochMilliseconds: TestInstant,
		completionLocalDate: '2026-08-31',
		allowanceId: 'allowance-a',
		timingConfiguration: { ...TestTimingConfiguration },
		automaticCompletionObservation: null,
		...overrides,
	} );

	if ( event.type !== ProtectionEventType.PROGRESS_CHECKPOINT ) {
		throw new Error( 'Expected a progress-checkpoint event fixture.' );
	}

	return event;
}

/**
 * Creates a fresh protected same-scope observation.
 * @param participantId - Stable participant identifier.
 * @param pageId - Stable page identifier.
 * @param observedDestination - Fresh absolute destination or null interruption destination.
 * @param overrides - Observation values overriding the defaults before validation.
 * @return A fresh active protected observation.
 * @since 0.1.0 Initial implementation.
 */
export function createFreshObservation(
	participantId = 'participant-a',
	pageId = 'page-a',
	observedDestination: string | null = 'https://example.com/page-a',
	overrides: Record<string, unknown> = {},
): FreshParticipantObservation {
	return FreshParticipantObservationSchema.parse( {
		participantId,
		pageId,
		observedDestination,
		match: {
			status: ProtectedUrlMatchStatus.PROTECTED,
			rule: {
				host: 'example.com',
				includeSubdomains: true,
				scopeId: 'scope-default',
			},
		},
		schedule: { status: ScheduleEvaluationStatus.ACTIVE },
		...overrides,
	} );
}

/**
 * Creates a validated explicit Ready-continuation event fixture.
 * @param observation - Fresh participant observation.
 * @param overrides - Top-level event values overriding the defaults before validation.
 * @return A parsed Ready-continuation event.
 * @since 0.1.0 Initial implementation.
 */
export function createReadyContinuation(
	observation: FreshParticipantObservation = createFreshObservation(),
	overrides: Record<string, unknown> = {},
): ReadyContinuationEvent {
	const event = ProtectionEventSchema.parse( {
		type: ProtectionEventType.READY_CONTINUATION,
		scopeId: 'scope-default',
		allowanceId: 'allowance-a',
		nowEpochMilliseconds: TestInstant + 1,
		observation,
		...overrides,
	} );

	if ( event.type !== ProtectionEventType.READY_CONTINUATION ) {
		throw new Error( 'Expected a Ready-continuation event fixture.' );
	}

	return event;
}

/**
 * Creates a validated Ready-reconciliation event fixture.
 * @param observation - Fresh participant observation.
 * @param overrides - Top-level event values overriding the defaults before validation.
 * @return A parsed Ready-reconciliation event.
 * @since 0.1.0 Initial implementation.
 */
export function createReadyReconciliation(
	observation: FreshParticipantObservation = createFreshObservation(),
	overrides: Record<string, unknown> = {},
): ReadyReconciliationEvent {
	const event = ProtectionEventSchema.parse( {
		type: ProtectionEventType.READY_RECONCILIATION,
		scopeId: 'scope-default',
		allowanceId: 'allowance-a',
		nowEpochMilliseconds: TestInstant + 1,
		observation,
		...overrides,
	} );

	if ( event.type !== ProtectionEventType.READY_RECONCILIATION ) {
		throw new Error( 'Expected a Ready-reconciliation event fixture.' );
	}

	return event;
}

/**
 * Creates one validated live-page allowance-expiry candidate fixture.
 * @param participantId - Stable participant identifier.
 * @param pageId - Stable page identifier.
 * @param observedDestination - Current absolute page destination.
 * @param focusEligible - Whether the page may own focused progress.
 * @param match - Current rule-match result.
 * @return A validated live-page expiry candidate.
 * @since 0.1.0 Initial implementation.
 */
export function createLiveExpiryCandidate(
	participantId = 'participant-live',
	pageId = 'page-live',
	observedDestination = 'https://example.com/live',
	focusEligible = true,
	match: unknown = {
		status: ProtectedUrlMatchStatus.PROTECTED,
		rule: {
			host: 'example.com',
			includeSubdomains: true,
			scopeId: 'scope-default',
		},
	},
): AllowanceExpiryCandidate {
	return AllowanceExpiryCandidateSchema.parse( {
		source: AllowanceExpiryCandidateSource.LIVE_PAGE,
		participantId,
		pageId,
		observedDestination,
		focusEligible,
		match,
	} );
}

/**
 * Creates one validated Ready allowance-expiry candidate fixture.
 * @param participantId - Stable participant identifier.
 * @param pageId - Stable page identifier.
 * @param observedDestination - Current absolute destination or null interruption destination.
 * @param focusEligible - Whether the page may own focused progress.
 * @param match - Current rule-match result.
 * @return A validated Ready expiry candidate.
 * @since 0.1.0 Initial implementation.
 */
export function createReadyExpiryCandidate(
	participantId = 'participant-a',
	pageId = 'page-a',
	observedDestination: string | null = 'https://example.com/page-a',
	focusEligible = true,
	match: unknown = {
		status: ProtectedUrlMatchStatus.PROTECTED,
		rule: {
			host: 'example.com',
			includeSubdomains: true,
			scopeId: 'scope-default',
		},
	},
): AllowanceExpiryCandidate {
	return AllowanceExpiryCandidateSchema.parse( {
		source: AllowanceExpiryCandidateSource.READY_PARTICIPANT,
		participantId,
		pageId,
		observedDestination,
		focusEligible,
		match,
	} );
}

/**
 * Creates a validated allowance-expiry transaction event fixture.
 * @param candidates - Fresh live-page and Ready observations.
 * @param schedule - Current scope-level schedule result.
 * @param overrides - Top-level event values overriding the defaults before validation.
 * @return A parsed allowance-expiry event.
 * @since 0.1.0 Initial implementation.
 */
export function createAllowanceExpiry(
	candidates: AllowanceExpiryCandidate[] = [ createReadyExpiryCandidate() ],
	schedule: AllowanceExpiryEvent['schedule'] = { status: ScheduleEvaluationStatus.ACTIVE },
	overrides: Record<string, unknown> = {},
): AllowanceExpiryEvent {
	const event = ProtectionEventSchema.parse( {
		type: ProtectionEventType.ALLOWANCE_EXPIRY,
		scopeId: 'scope-default',
		allowanceId: 'allowance-a',
		newWaitId: 'wait-expiry',
		nowEpochMilliseconds: TestInstant + TestTimingConfiguration.allowanceMilliseconds,
		observedLocalDate: '2026-08-31',
		timingConfiguration: { ...TestTimingConfiguration },
		schedule,
		candidates,
		...overrides,
	} );

	if ( event.type !== ProtectionEventType.ALLOWANCE_EXPIRY ) {
		throw new Error( 'Expected an allowance-expiry event fixture.' );
	}

	return event;
}

/**
 * Creates a participant-departure event fixture.
 * @param cause - Closed participant departure cause.
 * @param participantId - Stable participant identifier.
 * @param pageId - Stable page identifier.
 * @param overrides - Top-level event values overriding the defaults before validation.
 * @return A current-Wait participant-departure event.
 * @since 0.1.0 Initial implementation.
 */
export function createDeparture(
	cause: ParticipantDepartureEvent['cause'],
	participantId = 'participant-a',
	pageId = 'page-a',
	overrides: Record<string, unknown> = {},
): ParticipantDepartureEvent {
	const event = ProtectionEventSchema.parse( {
		type: ProtectionEventType.PARTICIPANT_DEPARTURE,
		scopeId: 'scope-default',
		target: {
			stateType: ProtectionStateType.WAITING,
			waitId: 'wait-a',
		},
		participantId,
		pageId,
		cause,
		observedAtEpochMilliseconds: TestInstant,
		...overrides,
	} );

	if ( event.type !== ProtectionEventType.PARTICIPANT_DEPARTURE ) {
		throw new Error( 'Expected a participant-departure event fixture.' );
	}

	return event;
}

/**
 * Creates a schedule-reevaluation event fixture.
 * @param schedule - Fresh schedule evaluation result.
 * @param overrides - Top-level event values overriding the defaults before validation.
 * @return A current-Wait schedule-reevaluation event.
 * @since 0.1.0 Initial implementation.
 */
export function createScheduleReevaluation(
	schedule: ScheduleReevaluationEvent['schedule'] = { status: ScheduleEvaluationStatus.INACTIVE },
	overrides: Record<string, unknown> = {},
): ScheduleReevaluationEvent {
	const event = ProtectionEventSchema.parse( {
		type: ProtectionEventType.SCHEDULE_REEVALUATION,
		scopeId: 'scope-default',
		target: {
			stateType: ProtectionStateType.WAITING,
			waitId: 'wait-a',
		},
		schedule,
		...overrides,
	} );

	if ( event.type !== ProtectionEventType.SCHEDULE_REEVALUATION ) {
		throw new Error( 'Expected a schedule-reevaluation event fixture.' );
	}

	return event;
}
