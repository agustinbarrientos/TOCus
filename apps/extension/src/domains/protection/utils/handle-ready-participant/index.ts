import {
	ProtectionDecisionType,
} from '../../types/protection-decision';
import {
	ProtectionEventType,
	type ReadyContinuationEvent,
	type ReadyReconciliationEvent,
} from '../../types/protection-event';
import { ProtectionStateType, type ProtectionState } from '../../types/protection-state';
import { type ProtectionTransitionResult } from '../../types/protection-transition-result';
import { ScheduleEvaluationStatus } from '../../types/schedule-evaluation';
import { createObservedParticipantActionDecision } from '../create-protection-decision';
import { createTransitionResult } from '../create-protection-transition-result';
import { protectionMatchProtectsScope } from '../match-protection-scope';

/**
 * Applies one explicit continuation or reconciliation observation to a Ready participant.
 * @param state - Current validated protection state for the event scope.
 * @param event - Validated Ready continuation or reconciliation event.
 * @return The next allowance state and the participant presentation decision, with no facts.
 * @since 0.1.0 Initial implementation.
 */
export function handleReadyParticipant(
	state: ProtectionState,
	event: ReadyContinuationEvent | ReadyReconciliationEvent,
): ProtectionTransitionResult {
	if (
		state.type !== ProtectionStateType.ALLOWANCE ||
		state.scopeId !== event.scopeId ||
		state.allowanceId !== event.allowanceId ||
		event.nowEpochMilliseconds >= state.expiresAtEpochMilliseconds
	) {
		return createTransitionResult( state );
	}

	const participant = state.readyParticipants.find(
		( readyParticipant ) =>
			readyParticipant.participantId === event.observation.participantId &&
			readyParticipant.pageId === event.observation.pageId,
	);

	if ( participant === undefined ) {
		return createTransitionResult( state );
	}

	const actionDecision = createObservedParticipantActionDecision(
		participant,
		event.observation.observedDestination,
	);

	if ( actionDecision === null ) {
		return createTransitionResult( state );
	}

	if (
		event.type === ProtectionEventType.READY_RECONCILIATION &&
		event.observation.schedule.status === ScheduleEvaluationStatus.ACTIVE &&
		protectionMatchProtectsScope( event.observation.match, state.scopeId )
	) {
		return createTransitionResult( state, [ {
			type: ProtectionDecisionType.PRESENT_READY,
			participantId: participant.participantId,
			pageId: participant.pageId,
			allowanceId: state.allowanceId,
		} ] );
	}

	return createTransitionResult( {
		...state,
		readyParticipants: state.readyParticipants.filter(
			( readyParticipant ) => readyParticipant.participantId !== participant.participantId,
		),
	}, [ actionDecision ] );
}
