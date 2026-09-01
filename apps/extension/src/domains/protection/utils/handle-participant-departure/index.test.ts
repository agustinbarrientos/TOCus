import { describe, expect, expectTypeOf, it } from 'vitest';
import { ProtectionDecisionType } from '../../types/protection-decision';
import {
	DepartureCause,
	QualifyingDepartureCause,
	type ParticipantDepartureEvent,
} from '../../types/protection-event';
import { createDeparture } from '../../types/__fixtures__/protection-event';
import { ProtectionFactType } from '../../types/protection-fact';
import { ProtectionStateType } from '../../types/protection-state';
import {
	createAllowanceExpiryParticipant,
	createAllowanceState,
	createDailyLadder,
	createIdleState,
	createNavigationParticipant,
	createWaitingState,
} from '../../types/__fixtures__/protection-state';
import { handleParticipantDeparture } from './index';

const ExcludedDepartureCauses = [
	DepartureCause.REDIRECT,
	DepartureCause.AUTHENTICATION_HANDOFF,
	DepartureCause.PROGRAMMATIC_NAVIGATION,
	DepartureCause.BROWSER_ERROR_OR_RECOVERY,
	DepartureCause.SCHEDULE_DEACTIVATION,
	DepartureCause.PERMISSION_LOSS,
	DepartureCause.BROWSER_TERMINATION,
	DepartureCause.EXTENSION_TERMINATION,
	DepartureCause.CONFIGURATION_CHANGE,
	DepartureCause.STORAGE_FAILURE,
	DepartureCause.UNKNOWN,
];
const AllDepartureCauses = Object.values( DepartureCause );

describe( 'participant-departure transition', () => {
	it( 'accepts exactly one validated participant-departure event branch', () => {
		expectTypeOf( handleParticipantDeparture )
			.parameter( 1 )
			.toEqualTypeOf<ParticipantDepartureEvent>();
	} );

	it.each( Object.values( QualifyingDepartureCause ) )(
		'removes the final Waiting navigation participant and emits one reconsidered fact for %s',
		( cause ) => {
			const state = createWaitingState();
			state.ladder = createDailyLadder( 6, '2026-08-30' );

			expect( handleParticipantDeparture( state, createDeparture( cause ) ) ).toEqual( {
				state: {
					type: ProtectionStateType.IDLE,
					scopeId: 'scope-default',
					ladder: state.ladder,
				},
				decisions: [],
				facts: [ {
					type: ProtectionFactType.RECONSIDERED_VISIT,
					factId: 'reconsidered-visit_13-scope-default_6-wait-a_13-participant-a',
					scopeId: 'scope-default',
					waitId: 'wait-a',
					participantId: 'participant-a',
					departureCause: cause,
					observedAtEpochMilliseconds: 1_800_000_000_000,
				} ],
			} );
		},
	);

	it.each( ExcludedDepartureCauses )(
		'removes a Waiting navigation participant without a reconsidered fact for excluded cause %s',
		( cause ) => {
			const state = createWaitingState();

			expect( handleParticipantDeparture( state, createDeparture( cause ) ) ).toEqual( {
				state: {
					type: ProtectionStateType.IDLE,
					scopeId: state.scopeId,
					ladder: state.ladder,
				},
				decisions: [],
				facts: [],
			} );
		},
	);

	it.each( AllDepartureCauses )(
		'never emits a reconsidered fact for Waiting allowance-expiry origin and cause %s',
		( cause ) => {
			const state = {
				...createWaitingState(),
				participants: [ createAllowanceExpiryParticipant() ],
			};

			expect( handleParticipantDeparture( state, createDeparture( cause ) ).facts ).toEqual( [] );
		},
	);

	it( 'transfers ownership and resets checkpoint state when the owner departs', () => {
		const state = createWaitingState();
		state.confirmedFocusedDurationMilliseconds = 4_000;
		state.checkpointHighWaterMilliseconds = 4_000;
		state.participants.push( createNavigationParticipant( 'participant-b', 'page-b', true, 1 ) );
		const result = handleParticipantDeparture( state, createDeparture( DepartureCause.BACK ) );

		expect( result ).toEqual( {
			state: {
				...state,
				participants: [ state.participants[ 1 ] ],
				ownerParticipantId: 'participant-b',
				ownerEpoch: 2,
				checkpointHighWaterMilliseconds: 0,
			},
			decisions: [ {
				type: ProtectionDecisionType.PRESENT_WAITING,
				participantId: 'participant-b',
				pageId: 'page-b',
				waitId: 'wait-a',
			} ],
			facts: [ {
				type: ProtectionFactType.RECONSIDERED_VISIT,
				factId: 'reconsidered-visit_13-scope-default_6-wait-a_13-participant-a',
				scopeId: 'scope-default',
				waitId: 'wait-a',
				participantId: 'participant-a',
				departureCause: DepartureCause.BACK,
				observedAtEpochMilliseconds: 1_800_000_000_000,
			} ],
		} );
	} );

	it( 'abandons a wait without losing a valid departure fact when owner identity is exhausted', () => {
		const state = createWaitingState();
		state.ladder = createDailyLadder( 4, '2026-08-30' );
		state.participants.push(
			createAllowanceExpiryParticipant( 'participant-b', 'page-b', true, 1 ),
		);
		state.ownerEpoch = Number.MAX_SAFE_INTEGER;

		expect(
			handleParticipantDeparture( state, createDeparture( DepartureCause.BACK ) ),
		).toEqual( {
			state: {
				type: ProtectionStateType.IDLE,
				scopeId: state.scopeId,
				ladder: state.ladder,
			},
			decisions: [ {
				type: ProtectionDecisionType.DISMISS_INTERRUPTION,
				participantId: 'participant-b',
				pageId: 'page-b',
			} ],
			facts: [ {
				type: ProtectionFactType.RECONSIDERED_VISIT,
				factId: 'reconsidered-visit_13-scope-default_6-wait-a_13-participant-a',
				scopeId: 'scope-default',
				waitId: 'wait-a',
				participantId: 'participant-a',
				departureCause: DepartureCause.BACK,
				observedAtEpochMilliseconds: 1_800_000_000_000,
			} ],
		} );
	} );

	it( 'preserves ownership and checkpoint state when a non-owner departs', () => {
		const state = createWaitingState();
		state.confirmedFocusedDurationMilliseconds = 4_000;
		state.checkpointHighWaterMilliseconds = 4_000;
		state.participants.push( createNavigationParticipant( 'participant-b', 'page-b', false, 1 ) );
		const result = handleParticipantDeparture(
			state,
			createDeparture( DepartureCause.BACK, 'participant-b', 'page-b' ),
		);

		expect( result ).toEqual( {
			state: {
				...state,
				participants: [ state.participants[ 0 ] ],
			},
			decisions: [],
			facts: [ {
				type: ProtectionFactType.RECONSIDERED_VISIT,
				factId: 'reconsidered-visit_13-scope-default_6-wait-a_13-participant-b',
				scopeId: 'scope-default',
				waitId: 'wait-a',
				participantId: 'participant-b',
				departureCause: DepartureCause.BACK,
				observedAtEpochMilliseconds: 1_800_000_000_000,
			} ],
		} );
	} );

	it( 'creates an ownerless paused wait when every survivor is unfocused', () => {
		const state = createWaitingState();
		state.confirmedFocusedDurationMilliseconds = 4_000;
		state.checkpointHighWaterMilliseconds = 4_000;
		state.participants.push( createNavigationParticipant( 'participant-b', 'page-b', false, 1 ) );
		const result = handleParticipantDeparture( state, createDeparture( DepartureCause.BACK ) );

		expect( result.state ).toMatchObject( {
			ownerParticipantId: null,
			ownerEpoch: 2,
			checkpointHighWaterMilliseconds: 0,
		} );
		expect( result.decisions ).toEqual( [] );
	} );

	it.each( [
		{ label: 'Idle target mismatch', state: createIdleState(), event: createDeparture( DepartureCause.BACK ) },
		{
			label: 'stale Waiting target',
			state: createWaitingState(),
			event: createDeparture( DepartureCause.BACK, 'participant-a', 'page-a', {
				target: { stateType: ProtectionStateType.WAITING, waitId: 'wait-stale' },
			} ),
		},
		{
			label: 'missing Waiting participant',
			state: createWaitingState(),
			event: createDeparture( DepartureCause.BACK, 'participant-missing' ),
		},
		{
			label: 'mismatched Waiting page',
			state: createWaitingState(),
			event: createDeparture( DepartureCause.BACK, 'participant-a', 'page-missing' ),
		},
	] )( 'ignores $label', ( { state, event } ) => {
		expect( handleParticipantDeparture( state, event ) ).toEqual( {
			state,
			decisions: [],
			facts: [],
		} );
	} );

	it( 'removes a matching Ready participant while retaining the allowance interval', () => {
		const state = createAllowanceState();
		const event = createDeparture( DepartureCause.UNKNOWN, 'participant-a', 'page-a', {
			target: { stateType: ProtectionStateType.ALLOWANCE, allowanceId: 'allowance-a' },
		} );

		expect( handleParticipantDeparture( state, event ) ).toEqual( {
			state: { ...state, readyParticipants: [] },
			decisions: [],
			facts: [],
		} );
	} );

	it.each( Object.values( QualifyingDepartureCause ) )(
		'emits one reconsidered fact when a Ready navigation participant departs for %s',
		( cause ) => {
			const state = createAllowanceState();
			const event = createDeparture( cause, 'participant-a', 'page-a', {
				target: { stateType: ProtectionStateType.ALLOWANCE, allowanceId: state.allowanceId },
			} );

			expect( handleParticipantDeparture( state, event ) ).toEqual( {
				state: { ...state, readyParticipants: [] },
				decisions: [],
				facts: [ {
					type: ProtectionFactType.RECONSIDERED_VISIT,
					factId: 'reconsidered-visit_13-scope-default_6-wait-a_13-participant-a',
					scopeId: 'scope-default',
					waitId: 'wait-a',
					participantId: 'participant-a',
					departureCause: cause,
					observedAtEpochMilliseconds: 1_800_000_000_000,
				} ],
			} );
		},
	);

	it( 'deduplicates a replayed qualifying Ready departure after participant removal', () => {
		const state = createAllowanceState();
		const event = createDeparture( DepartureCause.BACK, 'participant-a', 'page-a', {
			target: { stateType: ProtectionStateType.ALLOWANCE, allowanceId: state.allowanceId },
		} );
		const firstResult = handleParticipantDeparture( state, event );

		expect( firstResult.facts ).toHaveLength( 1 );
		expect( handleParticipantDeparture( firstResult.state, event ) ).toEqual( {
			state: firstResult.state,
			decisions: [],
			facts: [],
		} );
	} );

	it.each( [
		...ExcludedDepartureCauses.map( ( cause ) => ( {
			cause,
			origin: 'navigation',
			participant: createNavigationParticipant(),
		} ) ),
		...AllDepartureCauses.map( ( cause ) => ( {
			cause,
			origin: 'allowance-expiry',
			participant: createAllowanceExpiryParticipant(),
		} ) ),
	] )(
		'removes a Ready $origin participant for cause $cause without emitting facts',
		( { cause, participant } ) => {
			const state = {
				...createAllowanceState(),
				readyParticipants: [ participant ],
			};
			const event = createDeparture( cause, participant.participantId, participant.pageId, {
				target: { stateType: ProtectionStateType.ALLOWANCE, allowanceId: state.allowanceId },
			} );

			expect( handleParticipantDeparture( state, event ) ).toEqual( {
				state: { ...state, readyParticipants: [] },
				decisions: [],
				facts: [],
			} );
		},
	);

	it( 'ignores a stale Ready participant departure', () => {
		const state = createAllowanceState();
		const event = createDeparture( DepartureCause.BACK, 'participant-missing', 'page-a', {
			target: { stateType: ProtectionStateType.ALLOWANCE, allowanceId: 'allowance-a' },
		} );

		expect( handleParticipantDeparture( state, event ) ).toEqual( {
			state,
			decisions: [],
			facts: [],
		} );
	} );

	it.each( [
		{
			label: 'stale allowance identifier',
			state: createAllowanceState(),
			event: createDeparture( DepartureCause.BACK, 'participant-a', 'page-a', {
				target: { stateType: ProtectionStateType.ALLOWANCE, allowanceId: 'allowance-stale' },
			} ),
		},
		{
			label: 'wrong target state type against Allowance',
			state: createAllowanceState(),
			event: createDeparture( DepartureCause.BACK ),
		},
		{
			label: 'mismatched Ready page identity',
			state: createAllowanceState(),
			event: createDeparture( DepartureCause.BACK, 'participant-a', 'page-stale', {
				target: { stateType: ProtectionStateType.ALLOWANCE, allowanceId: 'allowance-a' },
			} ),
		},
		{
			label: 'Allowance target against Idle',
			state: createIdleState(),
			event: createDeparture( DepartureCause.BACK, 'participant-a', 'page-a', {
				target: { stateType: ProtectionStateType.ALLOWANCE, allowanceId: 'allowance-a' },
			} ),
		},
		{
			label: 'Allowance target against Waiting',
			state: createWaitingState(),
			event: createDeparture( DepartureCause.BACK, 'participant-a', 'page-a', {
				target: { stateType: ProtectionStateType.ALLOWANCE, allowanceId: 'allowance-a' },
			} ),
		},
	] )( 'ignores $label', ( { state, event } ) => {
		expect( handleParticipantDeparture( state, event ) ).toEqual( {
			state,
			decisions: [],
			facts: [],
		} );
	} );

	it( 'deduplicates a replayed qualifying departure after participant removal', () => {
		const state = createWaitingState();
		const event = createDeparture( DepartureCause.BACK );
		const firstResult = handleParticipantDeparture( state, event );

		expect( firstResult.facts ).toHaveLength( 1 );
		expect( handleParticipantDeparture( firstResult.state, event ) ).toEqual( {
			state: firstResult.state,
			decisions: [],
			facts: [],
		} );
	} );
} );
