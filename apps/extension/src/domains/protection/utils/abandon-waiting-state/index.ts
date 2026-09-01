import { type ProtectionFact } from '../../types/protection-fact';
import { type ProtectionParticipant } from '../../types/protection-participant';
import {
	ProtectionStateType,
	type WaitingProtectionState,
} from '../../types/protection-state';
import { type ProtectionTransitionResult } from '../../types/protection-transition-result';
import { createFailOpenDecision } from '../create-protection-decision';
import { createTransitionResult } from '../create-protection-transition-result';

/**
 * Abandons a Waiting transaction and fails open for every participant still under protection.
 * @param state - Current validated Waiting state.
 * @param participants - Current participants requiring release or dismissal.
 * @param facts - Facts already accepted before abandonment became necessary.
 * @return Idle state with fail-open decisions and preserved accepted facts.
 * @since 0.1.0 Initial implementation.
 */
export function abandonWaitingState(
	state: WaitingProtectionState,
	participants: readonly ProtectionParticipant[],
	facts: readonly ProtectionFact[],
): ProtectionTransitionResult {
	return createTransitionResult( {
		type: ProtectionStateType.IDLE,
		scopeId: state.scopeId,
		ladder: state.ladder,
	}, participants.map( createFailOpenDecision ), facts );
}
