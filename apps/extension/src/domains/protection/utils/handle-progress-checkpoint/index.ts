import { CompletionAction } from '../../types/completion-action';
import {
	ProtectionDecisionType,
	type ProtectionDecision,
} from '../../types/protection-decision';
import { type ProgressCheckpointEvent } from '../../types/protection-event';
import { type PauseTimeFact } from '../../types/protection-fact';
import { type ProtectionParticipant } from '../../types/protection-participant';
import {
	ProtectionStateType,
	type ProtectionState,
	type WaitingProtectionState,
} from '../../types/protection-state';
import { type ProtectionTransitionResult } from '../../types/protection-transition-result';
import { EpochMillisecondsSchema } from '../../types/protection-value';
import { ScheduleEvaluationStatus } from '../../types/schedule-evaluation';
import { createObservedParticipantActionDecision } from '../create-protection-decision';
import {
	createAllowanceGrantedFact,
	createCompletedWaitFact,
	createPauseTimeFact,
} from '../create-protection-fact';
import { createTransitionResult } from '../create-protection-transition-result';
import { advanceDailyLadder } from '../daily-ladder-progression';
import { protectionMatchProtectsScope } from '../match-protection-scope';

/**
 * Atomically completes one accepted wait and creates its allowance transaction.
 * @param state - Current validated Waiting state whose accepted progress reached its duration.
 * @param event - Validated checkpoint carrying completion observations and allowance identity.
 * @param pauseTimeFact - Accepted final progress fact created by the checkpoint handler.
 * @return The new Allowance state with Ready or automatic-action decisions and completion facts.
 * @since 0.1.0 Initial implementation.
 */
function completeWait(
	state: WaitingProtectionState,
	event: ProgressCheckpointEvent,
	pauseTimeFact: PauseTimeFact,
): ProtectionTransitionResult {
	const startedAtEpochMilliseconds = event.observedAtEpochMilliseconds;
	const expiresAtEpochMilliseconds = EpochMillisecondsSchema.parse(
		startedAtEpochMilliseconds + event.timingConfiguration.allowanceMilliseconds,
	);
	const ladder = advanceDailyLadder( state.ladder, event.completionLocalDate );
	const decisions: ProtectionDecision[] = [];
	const readyParticipants: ProtectionParticipant[] = [];
	const automaticObservation = event.automaticCompletionObservation;

	for ( const participant of state.participants ) {
		const automaticObservationIsFresh =
			event.timingConfiguration.completionAction === CompletionAction.OPEN_AUTOMATICALLY &&
			participant.participantId === state.ownerParticipantId &&
			automaticObservation !== null &&
			automaticObservation.participantId === participant.participantId &&
			automaticObservation.pageId === participant.pageId &&
			protectionMatchProtectsScope( automaticObservation.match, state.scopeId ) &&
			automaticObservation.schedule.status === ScheduleEvaluationStatus.ACTIVE;
		const automaticDecision = automaticObservationIsFresh
			? createObservedParticipantActionDecision(
				participant,
				automaticObservation.observedDestination,
			)
			: null;

		if ( automaticDecision !== null ) {
			decisions.push( automaticDecision );
			continue;
		}

		readyParticipants.push( participant );
		decisions.push( {
			type: ProtectionDecisionType.PRESENT_READY,
			participantId: participant.participantId,
			pageId: participant.pageId,
			allowanceId: event.allowanceId,
		} );
	}

	return createTransitionResult( {
		type: ProtectionStateType.ALLOWANCE,
		scopeId: state.scopeId,
		allowanceId: event.allowanceId,
		completedWaitId: state.waitId,
		startedAtEpochMilliseconds,
		expiresAtEpochMilliseconds,
		readyParticipants,
		ladder,
	}, decisions, [
		pauseTimeFact,
		createCompletedWaitFact( {
			scopeId: state.scopeId,
			waitId: state.waitId,
			capturedWaitDurationMilliseconds: state.capturedWaitDurationMilliseconds,
			completedAtEpochMilliseconds: startedAtEpochMilliseconds,
			completionLocalDate: event.completionLocalDate,
		} ),
		createAllowanceGrantedFact( {
			scopeId: state.scopeId,
			allowanceId: event.allowanceId,
			startedAtEpochMilliseconds,
			expiresAtEpochMilliseconds,
			allowanceDurationMilliseconds: event.timingConfiguration.allowanceMilliseconds,
		} ),
	] );
}

/**
 * Applies one cumulative progress checkpoint to the current Waiting owner epoch.
 * @param state - Current validated protection state for the event scope.
 * @param event - Validated cumulative progress-checkpoint event.
 * @return The unchanged state, accepted partial progress, or delegated atomic completion.
 * @since 0.1.0 Initial implementation.
 */
export function handleProgressCheckpoint(
	state: ProtectionState,
	event: ProgressCheckpointEvent,
): ProtectionTransitionResult {
	if (
		state.type !== ProtectionStateType.WAITING ||
		state.ownerParticipantId === null ||
		event.waitId !== state.waitId ||
		event.ownerParticipantId !== state.ownerParticipantId ||
		event.ownerEpoch !== state.ownerEpoch ||
		event.cumulativeCheckpointMilliseconds <= state.checkpointHighWaterMilliseconds
	) {
		return createTransitionResult( state );
	}

	const checkpointDeltaMilliseconds =
		event.cumulativeCheckpointMilliseconds - state.checkpointHighWaterMilliseconds;
	const remainingWaitMilliseconds =
		state.capturedWaitDurationMilliseconds - state.confirmedFocusedDurationMilliseconds;
	const acceptedDurationMilliseconds = Math.min(
		checkpointDeltaMilliseconds,
		remainingWaitMilliseconds,
	);
	const confirmedFocusedDurationMilliseconds =
		state.confirmedFocusedDurationMilliseconds + acceptedDurationMilliseconds;
	const pauseTimeFact = createPauseTimeFact( {
		scopeId: state.scopeId,
		waitId: state.waitId,
		ownerParticipantId: state.ownerParticipantId,
		ownerEpoch: state.ownerEpoch,
		checkpointHighWaterMilliseconds: event.cumulativeCheckpointMilliseconds,
		acceptedDurationMilliseconds,
		observedAtEpochMilliseconds: event.observedAtEpochMilliseconds,
	} );

	if ( confirmedFocusedDurationMilliseconds < state.capturedWaitDurationMilliseconds ) {
		return createTransitionResult( {
			...state,
			confirmedFocusedDurationMilliseconds,
			checkpointHighWaterMilliseconds: event.cumulativeCheckpointMilliseconds,
		}, [], [ pauseTimeFact ] );
	}

	return completeWait( state, event, pauseTimeFact );
}
