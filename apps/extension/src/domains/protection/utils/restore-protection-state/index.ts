import { ProtectionScopeIdSchema } from '../../types/protection-value';
import {
	ProtectionDecisionType,
	type ProtectionDecision,
} from '../../types/protection-decision';
import { ProtectionEventType } from '../../types/protection-event';
import {
	ProtectionParticipantSchema,
	type ProtectionParticipant,
} from '../../types/protection-participant';
import {
	ProtectionStateSchema,
	ProtectionStateType,
	type ProtectionState,
} from '../../types/protection-state';
import {
	ProtectionParticipantOriginByStoredProtectionParticipantOrigin,
	type StoredProtectionParticipant,
} from '../../types/stored-protection-participant';
import {
	StoredProtectionScopeStateType,
	type StoredSessionProtectionState,
} from '../../types/stored-protection-state';
import {
	StoredProtectionStateParseStatus,
} from '../parse-stored-protection-state';
import { createFailOpenDecision } from '../create-protection-decision';
import { transitionProtectionState } from '../transition-protection-state';
import {
	ProtectionStateReconciliationRequirementReason,
	ProtectionStateRestoreMode,
	ProtectionStateRestoreStatus,
	RestoreProtectionStateInputSchema,
	RestoreProtectionStateResultSchema,
	type ProtectionStateReconciliationRequirement,
	type RestoreProtectionStateResult,
} from './types';

/**
 * Orders strings by stable code-unit lexical order.
 * @param left - First string.
 * @param right - Second string.
 * @return Negative or positive ordering value for distinct strings.
 * @since 0.1.0 Initial implementation.
 */
function compareLexically( left: string, right: string ): number {
	return left < right ? -1 : 1;
}

/**
 * Orders stored participants by join sequence and lexical participant identity.
 * @param left - First stored participant.
 * @param right - Second stored participant.
 * @return Negative, zero, or positive ordering value.
 * @since 0.1.0 Initial implementation.
 */
function compareStoredParticipants(
	left: StoredProtectionParticipant,
	right: StoredProtectionParticipant,
): number {
	if ( left.joinSequence !== right.joinSequence ) {
		return left.joinSequence - right.joinSequence;
	}

	return compareLexically( left.participantId, right.participantId );
}

/**
 * Clears volatile focus state while restoring one stored participant.
 * @param participant - Validated stored participant.
 * @return Validated runtime participant.
 * @since 0.1.0 Initial implementation.
 */
function restoreParticipant( participant: StoredProtectionParticipant ): ProtectionParticipant {
	return ProtectionParticipantSchema.parse( {
		origin: ProtectionParticipantOriginByStoredProtectionParticipantOrigin[ participant.origin ],
		participantId: participant.participantId,
		pageId: participant.pageId,
		retainedDestination: participant.retainedDestination,
		focusEligible: false,
		statisticsEligible: participant.statisticsEligible,
		joinSequence: participant.joinSequence,
	} );
}

/**
 * Restores runtime protection state from typed parsed stored state.
 * @param input - Restore mode, parsed stored state, current time, and optional continuity evidence.
 * @return Restored states, decisions, fixed-empty facts, and reconciliation requirements.
 * @throws {import('zod').ZodError} When the input or restored result violates its contract.
 * @since 0.1.0 Initial implementation.
 */
export function restoreProtectionState( input: unknown ): RestoreProtectionStateResult {
	const parsedInput = RestoreProtectionStateInputSchema.parse( input );

	if ( parsedInput.parsedState.durable.status === StoredProtectionStateParseStatus.FAILED ) {
		return RestoreProtectionStateResultSchema.parse( {
			status: ProtectionStateRestoreStatus.FAILURE,
			reason: parsedInput.parsedState.durable.reason,
			statesByScope: {},
			decisions: [],
			facts: [],
			requirements: [],
		} );
	}

	if ( parsedInput.parsedState.durable.status === StoredProtectionStateParseStatus.ABSENT ) {
		return RestoreProtectionStateResultSchema.parse( {
			status: ProtectionStateRestoreStatus.RESTORED,
			statesByScope: {},
			decisions: [],
			facts: [],
			requirements: [],
		} );
	}

	let continuousSessionState: StoredSessionProtectionState | null = null;

	if (
		parsedInput.mode === ProtectionStateRestoreMode.CONTINUED_SESSION &&
		parsedInput.parsedState.session.status === StoredProtectionStateParseStatus.CURRENT &&
		parsedInput.parsedState.session.state.sessionContinuityId === parsedInput.sessionContinuityId
	) {
		continuousSessionState = parsedInput.parsedState.session.state;
	}

	const restoredStates = new Map<string, ProtectionState>();
	const decisions: ProtectionDecision[] = [];
	const requirements: ProtectionStateReconciliationRequirement[] = [];
	const sortedDurableScopes = Object.entries( parsedInput.parsedState.durable.state.scopes ).sort(
		( [ leftScopeId ], [ rightScopeId ] ) => compareLexically( leftScopeId, rightScopeId ),
	);

	for ( const [ storedScopeId, durableScope ] of sortedDurableScopes ) {
		const scopeId = ProtectionScopeIdSchema.parse( storedScopeId );
		const sessionScope =
			continuousSessionState !== null && Object.hasOwn( continuousSessionState.scopes, scopeId )
				? continuousSessionState.scopes[ scopeId ]
				: undefined;

		if ( durableScope.allowance === undefined ) {
			if ( sessionScope?.type === StoredProtectionScopeStateType.WAITING ) {
				if ( sessionScope.ownerEpoch === Number.MAX_SAFE_INTEGER ) {
					decisions.push(
						...sessionScope.participants
							.slice()
							.sort( compareStoredParticipants )
							.map( restoreParticipant )
							.map( createFailOpenDecision ),
					);
					restoredStates.set( scopeId, ProtectionStateSchema.parse( {
						type: ProtectionStateType.IDLE,
						scopeId,
						ladder: durableScope.ladder,
					} ) );
					continue;
				}

				const restoredWaiting = ProtectionStateSchema.parse( {
					type: ProtectionStateType.WAITING,
					scopeId,
					waitId: sessionScope.waitId,
					capturedWaitDurationMilliseconds: sessionScope.capturedWaitDurationMilliseconds,
					confirmedFocusedDurationMilliseconds: sessionScope.confirmedFocusedDurationMilliseconds,
					participants: sessionScope.participants
						.slice()
						.sort( compareStoredParticipants )
						.map( restoreParticipant ),
					ownerParticipantId: null,
					ownerEpoch: sessionScope.ownerEpoch + 1,
					checkpointHighWaterMilliseconds: 0,
					completionStatisticsEligible: sessionScope.completionStatisticsEligible,
					ladder: durableScope.ladder,
				} );

				restoredStates.set( scopeId, restoredWaiting );
				continue;
			}

			restoredStates.set( scopeId, ProtectionStateSchema.parse( {
				type: ProtectionStateType.IDLE,
				scopeId,
				ladder: durableScope.ladder,
			} ) );
			continue;
		}

		if (
			parsedInput.nowEpochMilliseconds >= durableScope.allowance.expiresAtEpochMilliseconds &&
			continuousSessionState === null
		) {
			restoredStates.set( scopeId, ProtectionStateSchema.parse( {
				type: ProtectionStateType.IDLE,
				scopeId,
				ladder: durableScope.ladder,
			} ) );
			continue;
		}

		const storedReadyScope =
			sessionScope?.type === StoredProtectionScopeStateType.READY &&
			sessionScope.allowanceId === durableScope.allowance.allowanceId
				? sessionScope
				: null;
		const storedReadyParticipants = storedReadyScope?.participants
			.slice()
			.sort( compareStoredParticipants ) ?? [];
		let allowanceState = ProtectionStateSchema.parse( {
			type: ProtectionStateType.ALLOWANCE,
			scopeId,
			allowanceId: durableScope.allowance.allowanceId,
			completedWaitId: storedReadyScope?.completedWaitId ?? null,
			startedAtEpochMilliseconds: durableScope.allowance.startedAtEpochMilliseconds,
			expiresAtEpochMilliseconds: durableScope.allowance.expiresAtEpochMilliseconds,
			readyParticipants: storedReadyParticipants.map( restoreParticipant ),
			ladder: durableScope.ladder,
		} );

		if (
			parsedInput.mode === ProtectionStateRestoreMode.CONTINUED_SESSION &&
			parsedInput.nowEpochMilliseconds < durableScope.allowance.expiresAtEpochMilliseconds
		) {
			for ( const participant of storedReadyParticipants ) {
				const readyObservation = parsedInput.readyObservations.find(
					( candidate ) =>
						candidate.scopeId === scopeId &&
						candidate.allowanceId === durableScope.allowance?.allowanceId &&
						candidate.observation.participantId === participant.participantId &&
						candidate.observation.pageId === participant.pageId,
				);

				if ( readyObservation === undefined ) {
					requirements.push( {
						scopeId,
						allowanceId: durableScope.allowance.allowanceId,
						participantId: participant.participantId,
						pageId: participant.pageId,
						reason: ProtectionStateReconciliationRequirementReason.OBSERVATION_UNAVAILABLE,
					} );
					continue;
				}

				const transition = transitionProtectionState( allowanceState, {
					type: ProtectionEventType.READY_RECONCILIATION,
					scopeId,
					allowanceId: durableScope.allowance.allowanceId,
					nowEpochMilliseconds: parsedInput.nowEpochMilliseconds,
					observation: readyObservation.observation,
				} );
				const participantRemains =
					transition.state.type === ProtectionStateType.ALLOWANCE &&
					transition.state.readyParticipants.some(
						( readyParticipant ) => readyParticipant.participantId === participant.participantId,
					);
				const presentsReady = transition.decisions.some(
					( decision ) =>
						decision.type === ProtectionDecisionType.PRESENT_READY &&
						decision.participantId === participant.participantId &&
						decision.pageId === participant.pageId,
				);
				const resolvesDeparture = ! participantRemains && transition.decisions.some(
					( decision ) =>
						( decision.type === ProtectionDecisionType.RELEASE_NAVIGATION ||
							decision.type === ProtectionDecisionType.DISMISS_INTERRUPTION ) &&
						decision.participantId === participant.participantId &&
						decision.pageId === participant.pageId,
				);

				if ( presentsReady || resolvesDeparture ) {
					allowanceState = transition.state;
					decisions.push( ...transition.decisions );
					continue;
				}

				requirements.push( {
					scopeId,
					allowanceId: durableScope.allowance.allowanceId,
					participantId: participant.participantId,
					pageId: participant.pageId,
					reason: ProtectionStateReconciliationRequirementReason.OBSERVATION_REJECTED,
				} );
			}
		}

		restoredStates.set( scopeId, allowanceState );
	}

	const statesByScope = Object.fromEntries( restoredStates );

	if ( requirements.length > 0 ) {
		return RestoreProtectionStateResultSchema.parse( {
			status: ProtectionStateRestoreStatus.RECONCILIATION_REQUIRED,
			statesByScope,
			decisions,
			facts: [],
			requirements,
		} );
	}

	return RestoreProtectionStateResultSchema.parse( {
		status: ProtectionStateRestoreStatus.RESTORED,
		statesByScope,
		decisions,
		facts: [],
		requirements: [],
	} );
}

export * from './types';
