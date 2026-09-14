import { describe, expect, expectTypeOf, it } from 'vitest';
import { ProtectionDecisionType } from '../../types/protection-decision';
import type { ScheduleReevaluationEvent } from '../../types/protection-event';
import { createScheduleReevaluation } from '../../types/__fixtures__/protection-event';
import { ProtectionStateType } from '../../types/protection-state';
import { ScheduleEvaluationStatus } from '../../types/schedule-evaluation';
import {
	createAllowanceExpiryParticipant,
	createAllowanceState,
	createDailyLadder,
	createIdleState,
	createWaitingState,
	createReadyState,
	createNavigationParticipant,
} from '../../types/__fixtures__/protection-state';
import { handleScheduleReevaluation } from './index';

describe( 'schedule-reevaluation transition', () => {
	it( 'removes only the participant whose website schedule deactivates', () => {
		const state = createWaitingState();
		state.participants.push( createNavigationParticipant( 'participant-b', 'page-b', false, 1 ) );
		const event = createScheduleReevaluation( { status: ScheduleEvaluationStatus.INACTIVE }, {
			participantId: 'participant-b', pageId: 'page-b',
		} );
		const result = handleScheduleReevaluation( state, event );

		expect( result.state ).toEqual( { ...state, participants: [ state.participants[ 0 ] ] } );
		expect( result.decisions ).toEqual( [ {
			type: ProtectionDecisionType.RELEASE_NAVIGATION,
			participantId: 'participant-b',
			pageId: 'page-b',
			retainedDestination: 'https://example.com/page-b',
		} ] );
		expect( result.facts ).toEqual( [] );
	} );
	it( 'withdraws a pending allowance when the schedule deactivates', () => {
		const state = createReadyState();
		const result = handleScheduleReevaluation( state, createScheduleReevaluation(
			{ status: ScheduleEvaluationStatus.INACTIVE },
			{ target: { stateType: ProtectionStateType.READY, allowanceId: state.allowanceId } },
		) );
		expect( result.state ).toEqual( {
			type: ProtectionStateType.IDLE,
			scopeId: state.scopeId,
			ladder: state.ladder,
		} );
		expect( result.decisions ).toEqual( [ { type: ProtectionDecisionType.RELEASE_NAVIGATION, participantId: 'participant-a', pageId: 'page-a', retainedDestination: 'https://example.com/page-a' } ] );
		expect( result.facts ).toEqual( [] );
	} );

	it( 'ignores a stale participant identity without changing another website', () => {
		const state = createWaitingState();
		const result = handleScheduleReevaluation( state, createScheduleReevaluation( undefined, { pageId: 'page-stale' } ) );
		expect( result ).toEqual( { state, decisions: [], facts: [] } );
	} );

	it( 'accepts exactly one validated schedule-reevaluation event branch', () => {
		expectTypeOf( handleScheduleReevaluation )
			.parameter( 1 )
			.toEqualTypeOf<ScheduleReevaluationEvent>();
	} );

	it.each( [ createWaitingState(), createAllowanceState() ] )(
		'keeps $type unchanged while the schedule remains active',
		( state ) => {
			const target = state.type === ProtectionStateType.WAITING
				? { stateType: ProtectionStateType.WAITING, waitId: state.waitId }
				: { stateType: ProtectionStateType.ALLOWANCE, allowanceId: state.allowanceId };
			const event = createScheduleReevaluation(
				{ status: ScheduleEvaluationStatus.ACTIVE },
				{ target },
			);

			expect( handleScheduleReevaluation( state, event ) ).toEqual( {
				state,
				decisions: [],
				facts: [],
			} );
		},
	);

	it.each( [
		{ status: ScheduleEvaluationStatus.INACTIVE },
		{ status: ScheduleEvaluationStatus.ERROR, reason: 'invalid-time-zone' as const },
	] )( 'releases only the inactive owner and preserves another website pause for $status', ( schedule ) => {
		const state = createWaitingState();
		state.ladder = createDailyLadder( 9, '2026-08-27' );
		state.participants.push( createAllowanceExpiryParticipant( 'participant-b', 'page-b', false, 1 ) );

		expect( handleScheduleReevaluation( state, createScheduleReevaluation( schedule ) ) ).toEqual( {
			state: { ...state, participants: [ state.participants[ 1 ] ], ownerParticipantId: null, ownerEpoch: 2 },
			decisions: [ { type: ProtectionDecisionType.RELEASE_NAVIGATION, participantId: 'participant-a',
				pageId: 'page-a', retainedDestination: 'https://example.com/page-a' } ],
			facts: [],
		} );
	} );

	it( 'releases only an inactive Ready website while preserving the shared allowance interval', () => {
		const state = createAllowanceState();
		state.readyParticipants.push( createAllowanceExpiryParticipant( 'participant-b', 'page-b', false, 1 ) );
		const event = createScheduleReevaluation( undefined, {
			target: { stateType: ProtectionStateType.ALLOWANCE, allowanceId: 'allowance-a' },
		} );

		expect( handleScheduleReevaluation( state, event ) ).toEqual( {
			state: { ...state, readyParticipants: [ state.readyParticipants[ 1 ] ] },
			decisions: [ { type: ProtectionDecisionType.RELEASE_NAVIGATION, participantId: 'participant-a',
				pageId: 'page-a', retainedDestination: 'https://example.com/page-a' } ],
			facts: [],
		} );
	} );

	it( 'clears Ready atomically when Allowance schedule evaluation returns an error', () => {
		const state = createAllowanceState();
		const event = createScheduleReevaluation( {
			status: ScheduleEvaluationStatus.ERROR,
			reason: 'invalid-time-zone',
		}, {
			target: { stateType: ProtectionStateType.ALLOWANCE, allowanceId: state.allowanceId },
		} );

		expect( handleScheduleReevaluation( state, event ) ).toEqual( {
			state: { ...state, readyParticipants: [] },
			decisions: [ {
				type: ProtectionDecisionType.RELEASE_NAVIGATION,
				participantId: 'participant-a',
				pageId: 'page-a',
				retainedDestination: 'https://example.com/page-a',
			} ],
			facts: [],
		} );
	} );

	it.each( [
		{
			label: 'stale Waiting identifier',
			state: createWaitingState(),
			event: createScheduleReevaluation( undefined, {
				target: { stateType: ProtectionStateType.WAITING, waitId: 'wait-stale' },
			} ),
		},
		{
			label: 'wrong Waiting target type',
			state: createWaitingState(),
			event: createScheduleReevaluation( undefined, {
				target: { stateType: ProtectionStateType.ALLOWANCE, allowanceId: 'allowance-a' },
			} ),
		},
		{
			label: 'stale Allowance identifier',
			state: createAllowanceState(),
			event: createScheduleReevaluation( undefined, {
				target: { stateType: ProtectionStateType.ALLOWANCE, allowanceId: 'allowance-stale' },
			} ),
		},
		{
			label: 'Waiting target against Allowance',
			state: createAllowanceState(),
			event: createScheduleReevaluation( undefined, {
				target: { stateType: ProtectionStateType.WAITING, waitId: 'wait-a' },
			} ),
		},
		{
			label: 'Allowance target against Idle',
			state: createIdleState(),
			event: createScheduleReevaluation( undefined, {
				target: { stateType: ProtectionStateType.ALLOWANCE, allowanceId: 'allowance-a' },
			} ),
		},
	] )( 'ignores a $label', ( { state, event } ) => {
		expect( handleScheduleReevaluation( state, event ) ).toEqual( {
			state,
			decisions: [],
			facts: [],
		} );
	} );
} );
