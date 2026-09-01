import { ProtectionDecisionType, type ProtectionDecision } from '../../types/protection-decision';
import {
	QualifyingDepartureCauseSchema,
	type ParticipantDepartureEvent,
} from '../../types/protection-event';
import { type ProtectionFact } from '../../types/protection-fact';
import { ProtectionParticipantOrigin } from '../../types/protection-participant';
import {
	ProtectionStateType,
	type ProtectionState,
} from '../../types/protection-state';
import { type ProtectionTransitionResult } from '../../types/protection-transition-result';
import { WaitIdSchema } from '../../types/protection-value';
import { abandonWaitingState } from '../abandon-waiting-state';
import { createReconsideredVisitFact } from '../create-protection-fact';
import { createTransitionResult } from '../create-protection-transition-result';
import { protectionStateMatchesTarget } from '../match-protection-state-target';
import { selectOwner } from '../select-protection-owner';

/**
 * Removes one current participant and updates Waiting ownership or Ready retention.
 * @param state - Current validated protection state for the event scope.
 * @param event - Validated participant-departure event.
 * @return The updated transaction with reconsidered-visit facts when applicable.
 * @since 0.1.0 Initial implementation.
 */
export function handleParticipantDeparture(
	state: ProtectionState,
	event: ParticipantDepartureEvent,
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
			qualifyingCause.success
		) {
			facts.push( createReconsideredVisitFact( {
				scopeId: state.scopeId,
				waitId: state.waitId,
				participantId: departingParticipant.participantId,
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

	const facts: ProtectionFact[] = [];
	const qualifyingCause = QualifyingDepartureCauseSchema.safeParse( event.cause );

	if (
		departingParticipant.origin === ProtectionParticipantOrigin.NAVIGATION &&
		qualifyingCause.success
	) {
		const completedWaitId = WaitIdSchema.parse( state.completedWaitId );

		facts.push( createReconsideredVisitFact( {
			scopeId: state.scopeId,
			waitId: completedWaitId,
			participantId: departingParticipant.participantId,
			departureCause: qualifyingCause.data,
			observedAtEpochMilliseconds: event.observedAtEpochMilliseconds,
		} ) );
	}

	return createTransitionResult( {
		...state,
		readyParticipants: state.readyParticipants.filter(
			( participant ) => participant.participantId !== event.participantId,
		),
	}, [], facts );
}
