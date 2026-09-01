import { type ProtectionDecision } from '../../types/protection-decision';
import { type ScheduleReevaluationEvent } from '../../types/protection-event';
import {
	ProtectionStateType,
	type ProtectionState,
} from '../../types/protection-state';
import { type ProtectionTransitionResult } from '../../types/protection-transition-result';
import { ScheduleEvaluationStatus } from '../../types/schedule-evaluation';
import { createFailOpenDecision } from '../create-protection-decision';
import { createTransitionResult } from '../create-protection-transition-result';
import { protectionStateMatchesTarget } from '../match-protection-state-target';

/**
 * Applies one current schedule observation to a Waiting or Allowance transaction.
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
	const decisions: ProtectionDecision[] = participants.map( createFailOpenDecision );

	if ( state.type === ProtectionStateType.WAITING ) {
		return createTransitionResult( {
			type: ProtectionStateType.IDLE,
			scopeId: state.scopeId,
			ladder: state.ladder,
		}, decisions );
	}

	return createTransitionResult( {
		...state,
		readyParticipants: [],
	}, decisions );
}
