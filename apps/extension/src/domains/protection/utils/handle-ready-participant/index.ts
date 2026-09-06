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
import { createAllowanceGrantedFact } from '../create-protection-fact';
import { createTransitionResult } from '../create-protection-transition-result';
import { protectionMatchProtectsScope } from '../match-protection-scope';

/**
 * Applies one explicit continuation or reconciliation observation to a Ready participant.
 * @param state - Current validated protection state for the event scope.
 * @param event - Validated Ready continuation or reconciliation event.
 * @return Updated Ready or Allowance state, a participant decision, and a grant fact only on the first eligible entry.
 * @since 0.1.0 Initial implementation.
 */
export function handleReadyParticipant(
	state: ProtectionState,
	event: ReadyContinuationEvent | ReadyReconciliationEvent,
): ProtectionTransitionResult {
	if (
		( state.type !== ProtectionStateType.ALLOWANCE && state.type !== ProtectionStateType.READY ) ||
		state.scopeId !== event.scopeId ||
		state.allowanceId !== event.allowanceId ||
		( state.type === ProtectionStateType.ALLOWANCE &&
			event.nowEpochMilliseconds >= state.expiresAtEpochMilliseconds )
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

	const protectionIsActive = event.observation.schedule.status === ScheduleEvaluationStatus.ACTIVE &&
		protectionMatchProtectsScope( event.observation.match, state.scopeId );

	if ( event.type === ProtectionEventType.READY_RECONCILIATION && protectionIsActive ) {
		return createTransitionResult( state, [ {
			type: ProtectionDecisionType.PRESENT_READY,
			participantId: participant.participantId,
			pageId: participant.pageId,
			allowanceId: state.allowanceId,
		} ] );
	}

	const readyParticipants = state.readyParticipants.filter(
		( readyParticipant ) => readyParticipant.participantId !== participant.participantId,
	);

	if ( state.type === ProtectionStateType.READY && protectionIsActive ) {
		const startedAtEpochMilliseconds = event.nowEpochMilliseconds;
		const expiresAtEpochMilliseconds = startedAtEpochMilliseconds + state.capturedAllowanceDurationMilliseconds;

		return createTransitionResult( {
			type: ProtectionStateType.ALLOWANCE,
			scopeId: state.scopeId,
			allowanceId: state.allowanceId,
			completedWaitId: state.completedWaitId,
			startedAtEpochMilliseconds,
			expiresAtEpochMilliseconds,
			readyParticipants,
			ladder: state.ladder,
		}, [ actionDecision ], state.completionStatisticsEligible ? [ createAllowanceGrantedFact( {
			scopeId: state.scopeId,
			allowanceId: state.allowanceId,
			startedAtEpochMilliseconds,
			expiresAtEpochMilliseconds,
			allowanceDurationMilliseconds: state.capturedAllowanceDurationMilliseconds,
		} ) ] : [] );
	}

	return createTransitionResult( { ...state, readyParticipants }, [ actionDecision ] );
}
