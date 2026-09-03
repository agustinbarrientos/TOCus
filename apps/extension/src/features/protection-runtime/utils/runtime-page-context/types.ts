import { type ProtectionParticipant } from '../../../../domains/protection/types/protection-participant';
import {
	type AllowanceProtectionState,
	type WaitingProtectionState,
} from '../../../../domains/protection/types/protection-state';

/**
 * Current waiting or Ready participant associated with one browser tab.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionRuntimeParticipantContext {
	participant: ProtectionParticipant;
	state: WaitingProtectionState | AllowanceProtectionState;
}
