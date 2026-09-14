import { ProtectionDecisionType, type ProtectionDecision } from '../../types/protection-decision';
import {
	DepartureCause,
	QualifyingDepartureCauseSchema,
	type ParticipantDepartureEvent,
} from '../../types/protection-event';
import type { ProtectionFact } from '../../types/protection-fact';
import { ProtectionParticipantOrigin } from '../../types/protection-participant';
import {
	ProtectionStateType,
	type ProtectionState,
} from '../../types/protection-state';
import type { ProtectionTransitionResult } from '../../types/protection-transition-result';
import { abandonWaitingState } from '../abandon-waiting-state';
import { createReconsideredVisitFact } from '../create-protection-fact';
import { createTransitionResult } from '../create-protection-transition-result';
import { protectionStateMatchesTarget } from '../match-protection-state-target';
import { selectOwner } from '../select-protection-owner';

/**
 * Removes one current participant and updates Waiting ownership or Ready retention.
 * @param state - Current validated protection state for the event scope.
 * @param event - Validated participant-departure state fields; the capture date is coordinator metadata.
 * @return The updated transaction with reconsidered-visit facts when applicable.
 * @since 0.1.0 Initial implementation.
 */
export function handleParticipantDeparture(
	state: ProtectionState,
	event: Omit<ParticipantDepartureEvent, 'observedLocalDate'>,
): ProtectionTransitionResult {
	if ( ! protectionStateMatchesTarget( state, event.target ) ) {
		return createTransitionResult( state );
	}

	if ( state.type === ProtectionStateType.WAITING ) {
		const departingParticipant = state.participants.find(
			( participant ) =>
				participant.participantId === event.participantId &&
				participant.pageId === event.pageId,
		);

		if ( departingParticipant === undefined ) {
			return createTransitionResult( state );
		}

		const participants = state.participants.filter(
			( participant ) => participant.participantId !== departingParticipant.participantId,
		);
		const facts: ProtectionFact[] = [];
		const qualifyingCause = QualifyingDepartureCauseSchema.safeParse( event.cause );

		if (
			departingParticipant.origin === ProtectionParticipantOrigin.NAVIGATION &&
			departingParticipant.statisticsEligible &&
			event.allowanceDurationMilliseconds !== null &&
			qualifyingCause.success
		) {
			facts.push( createReconsideredVisitFact( {
				scopeId: state.scopeId,
				waitId: state.waitId,
				participantId: departingParticipant.participantId,
				allowanceDurationMilliseconds: event.allowanceDurationMilliseconds,
				departureCause: qualifyingCause.data,
				observedAtEpochMilliseconds: event.observedAtEpochMilliseconds,
			} ) );
		}

		if ( participants.length === 0 ) {
			return createTransitionResult( {
				type: ProtectionStateType.IDLE,
				scopeId: state.scopeId,
				ladder: state.ladder,
			}, [], facts );
		}

		const owner = selectOwner( participants );
		const ownerParticipantId = owner?.participantId ?? null;
		const ownershipChanged = ownerParticipantId !== state.ownerParticipantId;
		if ( ownershipChanged && state.ownerEpoch === Number.MAX_SAFE_INTEGER ) {
			return abandonWaitingState( state, participants, facts );
		}
		const decisions: ProtectionDecision[] = [];

		if ( ownershipChanged && owner !== null ) {
			decisions.push( {
				type: ProtectionDecisionType.PRESENT_WAITING,
				participantId: owner.participantId,
				pageId: owner.pageId,
				waitId: state.waitId,
			} );
		}

		return createTransitionResult( {
			...state,
			participants,
			ownerParticipantId,
			ownerEpoch: ownershipChanged ? state.ownerEpoch + 1 : state.ownerEpoch,
			checkpointHighWaterMilliseconds: ownershipChanged
				? 0
				: state.checkpointHighWaterMilliseconds,
		}, decisions, facts );
	}

	const departingParticipant = state.readyParticipants.find(
		( participant ) =>
			participant.participantId === event.participantId &&
			participant.pageId === event.pageId,
	);

	if ( departingParticipant === undefined ) {
		return createTransitionResult( state );
	}

	const readyParticipants = state.readyParticipants.filter(
		( participant ) => participant.participantId !== event.participantId,
	);
	if ( state.type === ProtectionStateType.READY && readyParticipants.length === 0 &&
		( event.cause === DepartureCause.CONFIGURATION_CHANGE ||
			event.cause === DepartureCause.SCHEDULE_DEACTIVATION ) ) {
		return createTransitionResult( { type: ProtectionStateType.IDLE, scopeId: state.scopeId,
			ladder: state.ladder } );
	}
	return createTransitionResult( { ...state, readyParticipants } );
}
