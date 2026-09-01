import { describe, expect, expectTypeOf, it } from 'vitest';
import { ProtectionDecisionType } from '../../types/protection-decision';
import { type ParticipantFocusChangeEvent } from '../../types/protection-event';
import { createFocusChange } from '../../types/__fixtures__/protection-event';
import { ProtectionParticipantOrigin } from '../../types/protection-participant';
import { ProtectionStateType } from '../../types/protection-state';
import {
	createAllowanceExpiryParticipant,
	createAllowanceState,
	createNavigationParticipant,
	createWaitingState,
} from '../../types/__fixtures__/protection-state';
import { handleParticipantFocusChange } from './index';

describe( 'participant-focus-change transition', () => {
	it( 'accepts exactly one validated participant-focus-change event branch', () => {
		expectTypeOf( handleParticipantFocusChange )
			.parameter( 1 )
			.toEqualTypeOf<ParticipantFocusChangeEvent>();
	} );

	it( 'gives the first eligible participant ownership and presents Waiting', () => {
		const state = {
			...createWaitingState(),
			participants: [ createNavigationParticipant( 'participant-a', 'page-a', false ) ],
			ownerParticipantId: null,
			ownerEpoch: 0,
		};

		expect( handleParticipantFocusChange( state, createFocusChange( 'participant-a', true, 0 ) ) ).toEqual( {
			state: {
				...state,
				participants: [ createNavigationParticipant() ],
				ownerParticipantId: 'participant-a',
				ownerEpoch: 1,
			},
			decisions: [ {
				type: ProtectionDecisionType.PRESENT_WAITING,
				participantId: 'participant-a',
				pageId: 'page-a',
				waitId: 'wait-a',
			} ],
			facts: [],
		} );
	} );

	it( 'transfers ownership and resets the checkpoint high-water', () => {
		const state = createWaitingState();
		state.confirmedFocusedDurationMilliseconds = 3_000;
		state.checkpointHighWaterMilliseconds = 3_000;
		state.participants.push( createNavigationParticipant( 'participant-b', 'page-b', true, 1 ) );

		expect( handleParticipantFocusChange( state, createFocusChange() ) ).toEqual( {
			state: {
				type: ProtectionStateType.WAITING,
				scopeId: 'scope-default',
				waitId: 'wait-a',
				capturedWaitDurationMilliseconds: 10_000,
				confirmedFocusedDurationMilliseconds: 3_000,
				participants: [
					{
						origin: ProtectionParticipantOrigin.NAVIGATION,
						participantId: 'participant-a',
						pageId: 'page-a',
						retainedDestination: 'https://example.com/page-a',
						focusEligible: false,
						joinSequence: 0,
					},
					{
						origin: ProtectionParticipantOrigin.NAVIGATION,
						participantId: 'participant-b',
						pageId: 'page-b',
						retainedDestination: 'https://example.com/page-b',
						focusEligible: true,
						joinSequence: 1,
					},
				],
				ownerParticipantId: 'participant-b',
				ownerEpoch: 2,
				checkpointHighWaterMilliseconds: 0,
				ladder: { completedWaits: 0, greatestObservedLocalDate: '2026-08-31' },
			},
			decisions: [ {
				type: ProtectionDecisionType.PRESENT_WAITING,
				participantId: 'participant-b',
				pageId: 'page-b',
				waitId: 'wait-a',
			} ],
			facts: [],
		} );
	} );

	it( 'abandons a wait when focus transfer would exhaust owner identity', () => {
		const state = createWaitingState();
		state.participants = [
			createNavigationParticipant( 'participant-a', 'page-a', true, 0 ),
			createAllowanceExpiryParticipant( 'participant-b', 'page-b', true, 1 ),
		];
		state.ownerEpoch = Number.MAX_SAFE_INTEGER;

		expect(
			handleParticipantFocusChange(
				state,
				createFocusChange( 'participant-a', false, Number.MAX_SAFE_INTEGER ),
			),
		).toEqual( {
			state: {
				type: ProtectionStateType.IDLE,
				scopeId: state.scopeId,
				ladder: state.ladder,
			},
			decisions: [
				{
					type: ProtectionDecisionType.RELEASE_NAVIGATION,
					participantId: 'participant-a',
					pageId: 'page-a',
					retainedDestination: 'https://example.com/page-a',
				},
				{
					type: ProtectionDecisionType.DISMISS_INTERRUPTION,
					participantId: 'participant-b',
					pageId: 'page-b',
				},
			],
			facts: [],
		} );
	} );

	it( 'pauses ownerless and increments the epoch when no successor is eligible', () => {
		const state = createWaitingState();
		state.confirmedFocusedDurationMilliseconds = 3_000;
		state.checkpointHighWaterMilliseconds = 3_000;
		const result = handleParticipantFocusChange( state, createFocusChange() );

		expect( result.state ).toMatchObject( {
			ownerParticipantId: null,
			ownerEpoch: 2,
			checkpointHighWaterMilliseconds: 0,
		} );
		expect( result.decisions ).toEqual( [] );
	} );

	it( 'updates participant focus without resetting the epoch when ownership stays unchanged', () => {
		const state = createWaitingState();
		state.confirmedFocusedDurationMilliseconds = 3_000;
		state.checkpointHighWaterMilliseconds = 3_000;
		state.participants.push( createNavigationParticipant( 'participant-b', 'page-b', false, 1 ) );
		const result = handleParticipantFocusChange( state, createFocusChange( 'participant-b', true ) );

		expect( result.state ).toEqual( {
			...state,
			participants: [ state.participants[ 0 ], createNavigationParticipant( 'participant-b', 'page-b', true, 1 ) ],
		} );
		expect( result.decisions ).toEqual( [] );
	} );

	it.each( [
		{ label: 'non-Waiting state', state: createAllowanceState(), event: createFocusChange() },
		{
			label: 'stale wait identifier',
			state: createWaitingState(),
			event: createFocusChange( 'participant-a', false, 1, { waitId: 'wait-stale' } ),
		},
		{
			label: 'stale owner epoch',
			state: createWaitingState(),
			event: createFocusChange( 'participant-a', false, 2 ),
		},
		{
			label: 'unknown participant',
			state: createWaitingState(),
			event: createFocusChange( 'participant-missing' ),
		},
	] )( 'ignores a $label', ( { state, event } ) => {
		expect( handleParticipantFocusChange( state, event ) ).toEqual( {
			state,
			decisions: [],
			facts: [],
		} );
	} );

	it( 'uses lexical identity when equal join sequences become eligible', () => {
		const state = createWaitingState();
		state.participants = [
			createNavigationParticipant( 'participant-z', 'page-z', true, 0 ),
			createNavigationParticipant( 'participant-a', 'page-a', false, 0 ),
		];
		state.ownerParticipantId = state.participants[ 0 ]?.participantId ?? null;
		const result = handleParticipantFocusChange(
			state,
			createFocusChange( 'participant-a', true ),
		);

		expect( result.state ).toMatchObject( {
			type: ProtectionStateType.WAITING,
			ownerParticipantId: 'participant-a',
			ownerEpoch: 2,
		} );
	} );
} );
