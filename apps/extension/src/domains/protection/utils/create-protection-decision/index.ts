import { type RetainedNavigationDestination } from '../../types/protection-value';
import {
	ProtectionDecisionSchema,
	ProtectionDecisionType,
	type ProtectionDecision,
} from '../../types/protection-decision';
import {
	ProtectionParticipantOrigin,
	type ProtectionParticipant,
} from '../../types/protection-participant';

/**
 * Creates the safe fail-open action for one retained participant.
 * @param participant - Current validated participant.
 * @return A release or dismissal decision.
 * @since 0.1.0 Initial implementation.
 */
export function createFailOpenDecision(
	participant: ProtectionParticipant,
): ProtectionDecision {
	if ( participant.origin === ProtectionParticipantOrigin.ALLOWANCE_EXPIRY ) {
		return ProtectionDecisionSchema.parse( {
			type: ProtectionDecisionType.DISMISS_INTERRUPTION,
			participantId: participant.participantId,
			pageId: participant.pageId,
		} );
	}

	return ProtectionDecisionSchema.parse( {
		type: ProtectionDecisionType.RELEASE_NAVIGATION,
		participantId: participant.participantId,
		pageId: participant.pageId,
		retainedDestination: participant.retainedDestination,
	} );
}

/**
 * Creates one participant action only when a fresh destination observation is usable.
 * @param participant - Current validated participant.
 * @param observedDestination - Current observed destination.
 * @return A release or dismissal decision, or null when the observation cannot act safely.
 * @since 0.1.0 Initial implementation.
 */
export function createObservedParticipantActionDecision(
	participant: ProtectionParticipant,
	observedDestination: RetainedNavigationDestination | null,
): ProtectionDecision | null {
	if ( participant.origin === ProtectionParticipantOrigin.NAVIGATION ) {
		if ( observedDestination !== participant.retainedDestination ) {
			return null;
		}
	} else if ( observedDestination !== null ) {
		return null;
	}

	return createFailOpenDecision( participant );
}
