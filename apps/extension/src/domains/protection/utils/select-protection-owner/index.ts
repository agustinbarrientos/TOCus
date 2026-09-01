import { type ProtectionParticipant } from '../../types/protection-participant';

/**
 * Selects the deterministic focused owner from a participant collection.
 * @param participants - Validated wait participants.
 * @return The lowest-sequence focused participant, with lexical identity as the tie-breaker.
 * @since 0.1.0 Initial implementation.
 */
export function selectOwner(
	participants: readonly ProtectionParticipant[],
): ProtectionParticipant | null {
	return participants.reduce<ProtectionParticipant | null>( ( selected, participant ) => {
		if ( ! participant.focusEligible ) {
			return selected;
		}

		if ( selected === null || participant.joinSequence < selected.joinSequence ) {
			return participant;
		}

		if (
			participant.joinSequence === selected.joinSequence &&
			participant.participantId < selected.participantId
		) {
			return participant;
		}

		return selected;
	}, null );
}
