import { ProtectionDecisionType } from '../../types/protection-decision';
import { type ParticipantFocusChangeEvent } from '../../types/protection-event';
import {
	ProtectionStateType,
	type ProtectionState,
} from '../../types/protection-state';
import { type ProtectionTransitionResult } from '../../types/protection-transition-result';
import { abandonWaitingState } from '../abandon-waiting-state';
import { createTransitionResult } from '../create-protection-transition-result';
import { selectOwner } from '../select-protection-owner';

/**
 * Applies one focus-eligibility observation to the current Waiting transaction.
 * @param state - Current validated protection state for the event scope.
 * @param event - Validated participant focus-change event.
 * @return The next state and any replacement-owner presentation decision.
 * @since 0.1.0 Initial implementation.
 */
export function handleParticipantFocusChange(
	state: ProtectionState,
	event: ParticipantFocusChangeEvent,
): ProtectionTransitionResult {
	if (
		state.type !== ProtectionStateType.WAITING ||
		event.waitId !== state.waitId ||
		event.ownerEpoch !== state.ownerEpoch
	) {
		return createTransitionResult( state );
	}

	const participantExists = state.participants.some(
		( participant ) => participant.participantId === event.participantId,
	);

	if ( ! participantExists ) {
		return createTransitionResult( state );
	}

	const participants = state.participants.map( ( participant ) => {
		if ( participant.participantId !== event.participantId ) {
			return participant;
		}

		return { ...participant, focusEligible: event.focusEligible };
	} );
	const owner = selectOwner( participants );
	const ownerParticipantId = owner?.participantId ?? null;

	if ( ownerParticipantId === state.ownerParticipantId ) {
		return createTransitionResult( { ...state, participants } );
	}

	if ( state.ownerEpoch === Number.MAX_SAFE_INTEGER ) {
		return abandonWaitingState( state, participants, [] );
	}

	return createTransitionResult( {
		...state,
		participants,
		ownerParticipantId,
		ownerEpoch: state.ownerEpoch + 1,
		checkpointHighWaterMilliseconds: 0,
	}, owner === null
		? []
		: [ {
			type: ProtectionDecisionType.PRESENT_WAITING,
			participantId: owner.participantId,
			pageId: owner.pageId,
			waitId: state.waitId,
		} ] );
}
