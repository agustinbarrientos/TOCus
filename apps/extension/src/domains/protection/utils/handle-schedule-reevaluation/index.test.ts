import { describe, expect, expectTypeOf, it } from 'vitest';
import { ProtectionDecisionType } from '../../types/protection-decision';
import { type ScheduleReevaluationEvent } from '../../types/protection-event';
import { createScheduleReevaluation } from '../../types/__fixtures__/protection-event';
import { ProtectionStateType } from '../../types/protection-state';
import { ScheduleEvaluationStatus } from '../../types/schedule-evaluation';
import {
	createAllowanceExpiryParticipant,
	createAllowanceState,
	createDailyLadder,
	createIdleState,
	createWaitingState,
} from '../../types/__fixtures__/protection-state';
import { handleScheduleReevaluation } from './index';

describe( 'schedule-reevaluation transition', () => {
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
	] )( 'atomically fails open mixed Waiting participants for $status', ( schedule ) => {
		const state = createWaitingState();
		state.ladder = createDailyLadder( 9, '2026-08-27' );
		state.participants.push( createAllowanceExpiryParticipant( 'participant-b', 'page-b', false, 1 ) );

		expect( handleScheduleReevaluation( state, createScheduleReevaluation( schedule ) ) ).toEqual( {
			state: {
				type: ProtectionStateType.IDLE,
				scopeId: 'scope-default',
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

	it( 'clears Ready while preserving the allowance interval and failing open each participant', () => {
		const state = createAllowanceState();
		state.readyParticipants.push( createAllowanceExpiryParticipant( 'participant-b', 'page-b', false, 1 ) );
		const event = createScheduleReevaluation( undefined, {
			target: { stateType: ProtectionStateType.ALLOWANCE, allowanceId: 'allowance-a' },
		} );

		expect( handleScheduleReevaluation( state, event ) ).toEqual( {
			state: { ...state, readyParticipants: [] },
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
