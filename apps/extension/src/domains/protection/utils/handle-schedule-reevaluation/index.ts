import { DepartureCause, ProtectionEventType, type ScheduleReevaluationEvent } from '../../types/protection-event';
import {
	ProtectionStateType,
	type ProtectionState,
} from '../../types/protection-state';
import type { ProtectionTransitionResult } from '../../types/protection-transition-result';
import { ScheduleEvaluationStatus } from '../../types/schedule-evaluation';
import { createFailOpenDecision } from '../create-protection-decision';
import { createTransitionResult } from '../create-protection-transition-result';
import { protectionStateMatchesTarget } from '../match-protection-state-target';
import { handleParticipantDeparture } from '../handle-participant-departure';

/**
 * Applies one website schedule observation without releasing other shared participants.
 * @param state - Current validated protection state for the event scope.
 * @param event - Validated schedule-reevaluation event.
 * @return The unchanged active transaction or its atomic fail-open result.
 * @since 0.1.0 Initial implementation.
 */
export function handleScheduleReevaluation(
	state: ProtectionState,
	event: ScheduleReevaluationEvent,
): ProtectionTransitionResult {
	if (
		! protectionStateMatchesTarget( state, event.target ) ||
		event.schedule.status === ScheduleEvaluationStatus.ACTIVE
	) {
		return createTransitionResult( state );
	}

	const participants = state.type === ProtectionStateType.WAITING
		? state.participants
		: state.readyParticipants;
	const participant = participants.find( ( candidate ) =>
		candidate.participantId === event.participantId && candidate.pageId === event.pageId );

	if ( participant === undefined ) {
		return createTransitionResult( state );
	}

	const result = handleParticipantDeparture( state, {
		type: ProtectionEventType.PARTICIPANT_DEPARTURE,
		scopeId: state.scopeId,
		target: event.target,
		participantId: participant.participantId,
		pageId: participant.pageId,
		cause: DepartureCause.SCHEDULE_DEACTIVATION,
		allowanceDurationMilliseconds: null,
		observedAtEpochMilliseconds: 0,
	} );
	return createTransitionResult( result.state, [ createFailOpenDecision( participant ), ...result.decisions ] );
}
