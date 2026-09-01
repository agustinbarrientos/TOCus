import {
	ProtectionStateType,
} from '../../types/protection-state';
import { type ProtectionParticipant } from '../../types/protection-participant';
import {
	StoredProtectionParticipantSchema,
	StoredProtectionParticipantOriginByProtectionParticipantOrigin,
	type StoredProtectionParticipant,
} from '../../types/stored-protection-participant';
import { WaitIdSchema } from '../../types/protection-value';
import {
	DurableStoredProtectionStateVersion,
	SessionStoredProtectionStateVersion,
	StoredProtectionScopeStateType,
	StoredProtectionStateSchema,
	type StoredProtectionState,
	type StoredSessionProtectionScopeState,
} from '../../types/stored-protection-state';
import { PrepareStoredProtectionStateInputSchema } from './types';

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
 * Removes volatile focus state from one runtime participant.
 * @param participant - Validated runtime participant.
 * @return Validated stored participant.
 * @since 0.1.0 Initial implementation.
 */
function prepareStoredParticipant( participant: ProtectionParticipant ): StoredProtectionParticipant {
	return StoredProtectionParticipantSchema.parse( {
		origin: StoredProtectionParticipantOriginByProtectionParticipantOrigin[ participant.origin ],
		participantId: participant.participantId,
		pageId: participant.pageId,
		retainedDestination: participant.retainedDestination,
		joinSequence: participant.joinSequence,
	} );
}

/**
 * Prepares validated runtime protection state as durable and session stored values.
 * @param input - Unknown runtime-state mapping and session-continuity identifier.
 * @return Current durable and session stored protection state.
 * @throws {import('zod').ZodError} When the input or prepared state violates its contract.
 * @since 0.1.0 Initial implementation.
 */
export function prepareStoredProtectionState( input: unknown ): StoredProtectionState {
	const parsedInput = PrepareStoredProtectionStateInputSchema.parse( input );
	const sortedStates = Object.entries( parsedInput.statesByScope ).sort(
		( [ leftScopeId ], [ rightScopeId ] ) => compareLexically( leftScopeId, rightScopeId ),
	);
	const durableScopes = Object.fromEntries( sortedStates.map( ( [ scopeId, state ] ) => {
		if ( state.type === ProtectionStateType.ALLOWANCE ) {
			return [
				scopeId,
				{
					ladder: state.ladder,
					allowance: {
						allowanceId: state.allowanceId,
						startedAtEpochMilliseconds: state.startedAtEpochMilliseconds,
						expiresAtEpochMilliseconds: state.expiresAtEpochMilliseconds,
					},
				},
			];
		}

		return [ scopeId, { ladder: state.ladder } ];
	} ) );
	const sessionScopes = new Map<string, StoredSessionProtectionScopeState>();

	for ( const [ scopeId, state ] of sortedStates ) {
		if ( state.type === ProtectionStateType.WAITING ) {
			sessionScopes.set( scopeId, {
				type: StoredProtectionScopeStateType.WAITING,
				waitId: state.waitId,
				capturedWaitDurationMilliseconds: state.capturedWaitDurationMilliseconds,
				confirmedFocusedDurationMilliseconds: state.confirmedFocusedDurationMilliseconds,
				participants: state.participants.map( prepareStoredParticipant ).sort( compareStoredParticipants ),
				ownerParticipantId: state.ownerParticipantId,
				ownerEpoch: state.ownerEpoch,
				checkpointHighWaterMilliseconds: state.checkpointHighWaterMilliseconds,
			} );
			continue;
		}

		if ( state.type === ProtectionStateType.ALLOWANCE && state.readyParticipants.length > 0 ) {
			sessionScopes.set( scopeId, {
				type: StoredProtectionScopeStateType.READY,
				allowanceId: state.allowanceId,
				completedWaitId: WaitIdSchema.parse( state.completedWaitId ),
				participants: state.readyParticipants.map( prepareStoredParticipant ).sort( compareStoredParticipants ),
			} );
		}
	}

	return StoredProtectionStateSchema.parse( {
		durable: {
			schemaVersion: DurableStoredProtectionStateVersion,
			scopes: durableScopes,
		},
		session: {
			schemaVersion: SessionStoredProtectionStateVersion,
			sessionContinuityId: parsedInput.sessionContinuityId,
			scopes: Object.fromEntries( sessionScopes ),
		},
	} );
}

export * from './types';
