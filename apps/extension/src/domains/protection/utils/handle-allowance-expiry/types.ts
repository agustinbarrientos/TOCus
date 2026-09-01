import { type ProtectionDecision } from '../../types/protection-decision';
import { type ProtectionParticipant } from '../../types/protection-participant';

/**
 * Protected Ready participants and fail-open decisions projected from fresh observations.
 * @since 0.1.0 Initial implementation.
 */
export interface ReadyCandidateProjection {
	/** Ready participants retained for the next wait. */
	participants: ProtectionParticipant[];
	/** Fail-open decisions for Ready participants no longer protected. */
	decisions: ProtectionDecision[];
}
