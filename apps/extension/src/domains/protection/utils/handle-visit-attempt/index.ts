import {
	ProtectionDecisionType,
	type ProtectionDecision,
} from '../../types/protection-decision';
import { type VisitAttemptEvent } from '../../types/protection-event';
import {
	type ProtectionParticipant,
	type VisitAttemptParticipant,
} from '../../types/protection-participant';
import {
	ProtectionStateType,
	type ProtectionState,
} from '../../types/protection-state';
import { type ProtectionTransitionResult } from '../../types/protection-transition-result';
import { ScheduleEvaluationStatus } from '../../types/schedule-evaluation';
import { abandonWaitingState } from '../abandon-waiting-state';
import { createFailOpenDecision } from '../create-protection-decision';
import { createTransitionResult } from '../create-protection-transition-result';
import { synchronizeDailyLadder } from '../daily-ladder-progression';
import { selectOwner } from '../select-protection-owner';
import { getNextWaitDuration } from '../wait-duration-calculator';

/**
 * Orders participants by the ownership-preserving join-order contract.
 * @param left - First participant.
 * @param right - Second participant.
 * @return Negative or positive ordering value for distinct participants.
 * @since 0.1.0 Initial implementation.
 */
function compareParticipantJoinOrder(
	left: ProtectionParticipant,
	right: ProtectionParticipant,
): number {
	if ( left.joinSequence !== right.joinSequence ) {
		return left.joinSequence - right.joinSequence;
	}

	return left.participantId < right.participantId ? -1 : 1;
}

/**
 * Appends a visit participant while keeping its join sequence inside the safe integer range.
 * @param participants - Current validated Waiting participants.
 * @param participant - New validated visit-attempt participant.
 * @return Existing participants and the safely sequenced new participant.
 * @since 0.1.0 Initial implementation.
 */
function appendVisitParticipant(
	participants: readonly ProtectionParticipant[],
	participant: VisitAttemptParticipant,
): ProtectionParticipant[] {
	const maximumJoinSequence = participants.reduce(
		( maximum, currentParticipant ) => Math.max( maximum, currentParticipant.joinSequence ),
		-1,
	);

	if ( maximumJoinSequence < Number.MAX_SAFE_INTEGER ) {
		return [ ...participants, { ...participant, joinSequence: maximumJoinSequence + 1 } ];
	}

	const compactedParticipants = participants
		.slice()
		.sort( compareParticipantJoinOrder )
		.map( ( currentParticipant, joinSequence ) => ( { ...currentParticipant, joinSequence } ) );

	return [
		...compactedParticipants,
		{ ...participant, joinSequence: compactedParticipants.length },
	];
}

/**
 * Applies a fresh non-active schedule observation to the whole scope before releasing the incoming visit.
 * @param state - Current validated protection state for the event scope.
 * @param participant - Incoming visit participant that observed the non-active schedule.
 * @return The scope-wide fail-open transition without metric facts.
 * @since 0.1.0 Initial implementation.
 */
function deactivateScopeForVisit(
	state: ProtectionState,
	participant: VisitAttemptParticipant,
): ProtectionTransitionResult {
	const retainedParticipants = state.type === ProtectionStateType.WAITING
		? state.participants
		: state.type === ProtectionStateType.ALLOWANCE
			? state.readyParticipants
			: [];
	const decisions: ProtectionDecision[] = retainedParticipants.map( createFailOpenDecision );
	const incomingParticipant = { ...participant, joinSequence: 0 };
	const incomingParticipantIsRetained = retainedParticipants.some(
		( retainedParticipant ) =>
			retainedParticipant.origin === incomingParticipant.origin &&
			retainedParticipant.participantId === incomingParticipant.participantId &&
			retainedParticipant.pageId === incomingParticipant.pageId,
	);

	if ( ! incomingParticipantIsRetained ) {
		decisions.push( createFailOpenDecision( incomingParticipant ) );
	}

	if ( state.type === ProtectionStateType.WAITING ) {
		return createTransitionResult( {
			type: ProtectionStateType.IDLE,
			scopeId: state.scopeId,
			ladder: state.ladder,
		}, decisions );
	}

	if ( state.type === ProtectionStateType.ALLOWANCE ) {
		return createTransitionResult( {
			...state,
			readyParticipants: [],
		}, decisions );
	}

	return createTransitionResult( state, decisions );
}

/**
 * Applies one protected visit attempt to the current scope state.
 * @param state - Current validated protection state for the event scope.
 * @param event - Validated protected visit-attempt event.
 * @return The next state with presentation decisions and no metric facts.
 * @since 0.1.0 Initial implementation.
 */
export function handleVisitAttempt(
	state: ProtectionState,
	event: VisitAttemptEvent,
): ProtectionTransitionResult {
	if (
		state.type === ProtectionStateType.ALLOWANCE &&
		event.nowEpochMilliseconds >= state.expiresAtEpochMilliseconds
	) {
		return createTransitionResult( state );
	}

	if ( event.schedule.status !== ScheduleEvaluationStatus.ACTIVE ) {
		return deactivateScopeForVisit( state, event.participant );
	}

	if ( state.type === ProtectionStateType.ALLOWANCE ) {
		return createTransitionResult( state, [
			createFailOpenDecision( { ...event.participant, joinSequence: 0 } ),
		] );
	}

	if ( state.type === ProtectionStateType.WAITING ) {
		const participantWithId = state.participants.find(
			( participant ) => participant.participantId === event.participant.participantId,
		);
		const participantWithPage = state.participants.find(
			( participant ) => participant.pageId === event.participant.pageId,
		);

		if (
			( participantWithId !== undefined && participantWithId.pageId !== event.participant.pageId ) ||
			( participantWithPage !== undefined &&
				participantWithPage.participantId !== event.participant.participantId )
		) {
			return createTransitionResult( state );
		}

		const existingParticipant = participantWithId ?? participantWithPage;

		if (
			existingParticipant !== undefined &&
			existingParticipant.origin !== event.participant.origin
		) {
			return createTransitionResult( state );
		}

		if ( existingParticipant !== undefined ) {
			return createTransitionResult( state, [ {
				type: ProtectionDecisionType.PRESENT_WAITING,
				participantId: existingParticipant.participantId,
				pageId: existingParticipant.pageId,
				waitId: state.waitId,
			} ] );
		}

		const participants = appendVisitParticipant( state.participants, event.participant );
		const owner = selectOwner( participants );
		const ownerParticipantId = owner?.participantId ?? null;
		const ownershipChanged = ownerParticipantId !== state.ownerParticipantId;
		if ( ownershipChanged && state.ownerEpoch === Number.MAX_SAFE_INTEGER ) {
			return abandonWaitingState( state, participants, [] );
		}

		return createTransitionResult( {
			...state,
			participants,
			ownerParticipantId,
			ownerEpoch: ownershipChanged ? state.ownerEpoch + 1 : state.ownerEpoch,
			checkpointHighWaterMilliseconds: ownershipChanged
				? 0
				: state.checkpointHighWaterMilliseconds,
		}, [ {
			type: ProtectionDecisionType.PRESENT_WAITING,
			participantId: event.participant.participantId,
			pageId: event.participant.pageId,
			waitId: state.waitId,
		} ] );
	}

	const ladder = synchronizeDailyLadder( state.ladder, event.observedLocalDate );
	const capturedWaitDurationMilliseconds = getNextWaitDuration(
		event.timingConfiguration,
		ladder,
	);
	const participant = { ...event.participant, joinSequence: 0 };
	const ownerParticipantId = participant.focusEligible ? participant.participantId : null;

	return createTransitionResult( {
		type: ProtectionStateType.WAITING,
		scopeId: state.scopeId,
		waitId: event.waitId,
		capturedWaitDurationMilliseconds,
		confirmedFocusedDurationMilliseconds: 0,
		participants: [ participant ],
		ownerParticipantId,
		ownerEpoch: ownerParticipantId === null ? 0 : 1,
		checkpointHighWaterMilliseconds: 0,
		ladder,
	}, [ {
		type: ProtectionDecisionType.PRESENT_WAITING,
		participantId: participant.participantId,
		pageId: participant.pageId,
		waitId: event.waitId,
	} ] );
}
