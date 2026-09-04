import {
	ProtectionDecisionType,
	type ProtectionDecision,
} from '../../types/protection-decision';
import {
	type AllowanceExpiryEvent,
	type LivePageAllowanceExpiryCandidate,
	type ReadyAllowanceExpiryCandidate,
} from '../../types/protection-event';
import {
	ProtectionParticipantOrigin,
	type ProtectionParticipant,
} from '../../types/protection-participant';
import {
	ProtectionStateType,
	type AllowanceProtectionState,
	type ProtectionState,
} from '../../types/protection-state';
import { type ProtectionTransitionResult } from '../../types/protection-transition-result';
import { ScheduleEvaluationStatus } from '../../types/schedule-evaluation';
import { canonicalizeAllowanceExpiryCandidates } from '../canonicalize-allowance-expiry-candidates';
import {
	createFailOpenDecision,
	createObservedParticipantActionDecision,
} from '../create-protection-decision';
import { createTransitionResult } from '../create-protection-transition-result';
import { synchronizeDailyLadder } from '../daily-ladder-progression';
import { protectionMatchProtectsScope } from '../match-protection-scope';
import { selectOwner } from '../select-protection-owner';
import { getNextWaitDuration } from '../wait-duration-calculator';
import { type ReadyCandidateProjection } from './types';

/**
 * Revalidates current Ready destinations and projects their fresh expiry observations.
 * @param state - Current validated Allowance state with authoritative Ready participants.
 * @param candidates - Canonical complete Ready-source observations.
 * @return Retained protected participants and fail-open decisions, or null for an unsafe destination.
 * @since 0.1.0 Initial implementation.
 */
function projectReadyCandidates(
	state: AllowanceProtectionState,
	candidates: ReadyAllowanceExpiryCandidate[],
): ReadyCandidateProjection | null {
	const participants: ProtectionParticipant[] = [];
	const decisions: ProtectionDecision[] = [];
	for ( const participant of state.readyParticipants ) {
		for ( const candidate of candidates ) {
			if ( candidate.participantId !== participant.participantId ) {
				continue;
			}

			const action = createObservedParticipantActionDecision(
				participant,
				candidate.observedDestination,
			);
			if ( action === null ) {
				return null;
			}

			if ( protectionMatchProtectsScope( candidate.match, state.scopeId ) ) {
				participants.push( { ...participant, focusEligible: candidate.focusEligible } );
			} else {
				decisions.push( action );
			}
		}
	}
	return { participants, decisions };
}

/**
 * Projects protected live observations after current Ready pages receive precedence.
 * @param state - Current validated Allowance state whose Ready pages take precedence.
 * @param candidates - Canonical complete live-source observations.
 * @return New expiry-origin participants retained for the next wait.
 * @since 0.1.0 Initial implementation.
 */
function projectLiveCandidates(
	state: AllowanceProtectionState,
	candidates: LivePageAllowanceExpiryCandidate[],
): ProtectionParticipant[] {
	const readyPageIds = new Set( state.readyParticipants.map( ( participant ) => participant.pageId ) );
	const participants: ProtectionParticipant[] = [];
	for ( const candidate of candidates ) {
		if (
			readyPageIds.has( candidate.pageId ) ||
			! protectionMatchProtectsScope( candidate.match, state.scopeId )
		) {
			continue;
		}

		participants.push( {
			origin: ProtectionParticipantOrigin.ALLOWANCE_EXPIRY,
			participantId: candidate.participantId,
			pageId: candidate.pageId,
			retainedDestination: null,
			focusEligible: candidate.focusEligible,
			statisticsEligible: candidate.statisticsEligible,
			joinSequence: 0,
		} );
	}
	return participants;
}

/**
 * Applies one idempotent allowance-expiry transaction to the current scope state.
 * @param state - Current validated protection state for the event scope.
 * @param event - Validated allowance-expiry transaction with fresh schedule and candidate observations.
 * @return Idle, unchanged Allowance, or one newly captured shared wait with declarative decisions and no facts.
 * @since 0.1.0 Initial implementation.
 */
export function handleAllowanceExpiry(
	state: ProtectionState,
	event: AllowanceExpiryEvent,
): ProtectionTransitionResult {
	if ( state.type !== ProtectionStateType.ALLOWANCE || state.scopeId !== event.scopeId ||
		state.allowanceId !== event.allowanceId || event.nowEpochMilliseconds < state.expiresAtEpochMilliseconds ) {
		return createTransitionResult( state );
	}

	if ( event.schedule.status !== ScheduleEvaluationStatus.ACTIVE ) {
		return createTransitionResult( {
			type: ProtectionStateType.IDLE,
			scopeId: state.scopeId,
			ladder: state.ladder,
		}, state.readyParticipants.map( createFailOpenDecision ) );
	}
	const candidates = canonicalizeAllowanceExpiryCandidates( state.readyParticipants, event );
	if ( candidates === null ) {
		return createTransitionResult( state );
	}
	const ready = projectReadyCandidates( state, candidates.readyCandidates );
	if ( ready === null ) {
		return createTransitionResult( state );
	}

	const canonicalParticipants = [
		...ready.participants,
		...projectLiveCandidates( state, candidates.liveCandidates ),
	];
	if ( canonicalParticipants.length === 0 ) {
		return createTransitionResult( {
			type: ProtectionStateType.IDLE,
			scopeId: state.scopeId,
			ladder: state.ladder,
		}, ready.decisions );
	}

	const participants = canonicalParticipants
		.sort( ( left, right ) => left.pageId < right.pageId ? -1 : 1 )
		.map( ( participant, joinSequence ) => ( { ...participant, joinSequence } ) );
	const ladder = synchronizeDailyLadder( state.ladder, event.observedLocalDate );
	const capturedWaitDurationMilliseconds = getNextWaitDuration( event.timingConfiguration, ladder );
	const owner = selectOwner( participants );
	const decisions = [ ...ready.decisions ];

	if ( owner !== null ) {
		decisions.push( {
			type: ProtectionDecisionType.PRESENT_WAITING,
			participantId: owner.participantId,
			pageId: owner.pageId,
			waitId: event.newWaitId,
		} );
	}
	return createTransitionResult( {
		type: ProtectionStateType.WAITING,
		scopeId: state.scopeId,
		waitId: event.newWaitId,
		capturedWaitDurationMilliseconds,
		confirmedFocusedDurationMilliseconds: 0,
		participants,
		ownerParticipantId: owner?.participantId ?? null,
		ownerEpoch: owner === null ? 0 : 1,
		checkpointHighWaterMilliseconds: 0,
		completionStatisticsEligible: true,
		ladder,
	}, decisions );
}
