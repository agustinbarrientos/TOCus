import { describe, expect, expectTypeOf, it } from 'vitest';
import { CompletionAction } from '../../types/completion-action';
import { ProtectionDecisionType } from '../../types/protection-decision';
import { type ProgressCheckpointEvent } from '../../types/protection-event';
import {
	TestInstant,
	TestTimingConfiguration,
	createFreshObservation,
	createProgressCheckpoint,
} from '../../types/__fixtures__/protection-event';
import { ProtectionFactType } from '../../types/protection-fact';
import { ProtectionStateType } from '../../types/protection-state';
import { ProtectedUrlMatchStatus } from '../../types/protected-url-match';
import {
	ScheduleEvaluationFailureReason,
	ScheduleEvaluationStatus,
} from '../../types/schedule-evaluation';
import {
	createAllowanceExpiryParticipant,
	createAllowanceState,
	createDailyLadder,
	createNavigationParticipant,
	createWaitingState,
} from '../../types/__fixtures__/protection-state';
import { handleProgressCheckpoint } from './index';

describe( 'progress-checkpoint transition', () => {
	it( 'accepts exactly one validated progress-checkpoint event branch', () => {
		expectTypeOf( handleProgressCheckpoint )
			.parameter( 1 )
			.toEqualTypeOf<ProgressCheckpointEvent>();
	} );

	it( 'accepts only the positive cumulative difference and emits one pause-time fact', () => {
		const state = createWaitingState();
		state.confirmedFocusedDurationMilliseconds = 3_000;
		state.checkpointHighWaterMilliseconds = 3_000;
		const result = handleProgressCheckpoint( state, createProgressCheckpoint( 5_500 ) );

		expect( result ).toEqual( {
			state: {
				...state,
				confirmedFocusedDurationMilliseconds: 5_500,
				checkpointHighWaterMilliseconds: 5_500,
			},
			decisions: [],
			facts: [ {
				type: ProtectionFactType.PAUSE_TIME,
				factId: 'pause-time_13-scope-default_6-wait-a_1-1_4-5500',
				scopeId: 'scope-default',
				waitId: 'wait-a',
				ownerParticipantId: 'participant-a',
				ownerEpoch: 1,
				checkpointHighWaterMilliseconds: 5_500,
				acceptedDurationMilliseconds: 2_500,
				observedAtEpochMilliseconds: 1_800_000_000_000,
			} ],
		} );
	} );

	it( 'accepts private progress without exposing it as an ordinary statistic', () => {
		const state = createWaitingState();

		state.participants = [ createNavigationParticipant(
			'participant-a',
			'page-a',
			true,
			0,
			'https://example.com/page-a',
			false,
		) ];

		const result = handleProgressCheckpoint(
			state,
			createProgressCheckpoint( 2_000, { statisticsEligible: false } ),
		);

		expect( result ).toMatchObject( {
			state: {
				confirmedFocusedDurationMilliseconds: 2_000,
				completionStatisticsEligible: false,
			},
			facts: [],
		} );
	} );

	it( 'completes a wholly private wait without emitting ordinary statistics', () => {
		const state = createWaitingState();
		const result = handleProgressCheckpoint(
			state,
			createProgressCheckpoint( 10_000, { statisticsEligible: false } ),
		);

		expect( result.state.type ).toBe( ProtectionStateType.ALLOWANCE );
		expect( result.facts ).toEqual( [] );
	} );

	it( 'does not count a completed wait after private progress entered the transaction', () => {
		const state = createWaitingState();

		state.confirmedFocusedDurationMilliseconds = 5_000;
		state.checkpointHighWaterMilliseconds = 5_000;
		Object.assign( state, { completionStatisticsEligible: false } );
		const result = handleProgressCheckpoint(
			state,
			createProgressCheckpoint( 10_000, { statisticsEligible: true } ),
		);

		expect( result.state.type ).toBe( ProtectionStateType.ALLOWANCE );
		expect( result.facts.map( ( fact ) => fact.type ) ).toEqual( [ ProtectionFactType.PAUSE_TIME ] );
	} );

	it.each( [ 3_000, 2_999, 0 ] )(
		'ignores duplicate, lower, or reordered cumulative checkpoint %i',
		( cumulativeCheckpointMilliseconds ) => {
			const state = createWaitingState();
			state.confirmedFocusedDurationMilliseconds = 3_000;
			state.checkpointHighWaterMilliseconds = 3_000;

			expect( handleProgressCheckpoint(
				state,
				createProgressCheckpoint( cumulativeCheckpointMilliseconds ),
			) ).toEqual( { state, decisions: [], facts: [] } );
		},
	);

	it.each( [
		{ label: 'non-Waiting state', state: createAllowanceState(), event: createProgressCheckpoint() },
		{
			label: 'ownerless wait',
			state: {
				...createWaitingState(),
				participants: [ createNavigationParticipant( 'participant-a', 'page-a', false ) ],
				ownerParticipantId: null,
				ownerEpoch: 2,
			},
			event: createProgressCheckpoint( 2_000, { ownerEpoch: 2 } ),
		},
		{
			label: 'stale wait identifier',
			state: createWaitingState(),
			event: createProgressCheckpoint( 2_000, { waitId: 'wait-stale' } ),
		},
		{
			label: 'stale owner participant',
			state: createWaitingState(),
			event: createProgressCheckpoint( 2_000, { ownerParticipantId: 'participant-stale' } ),
		},
		{
			label: 'stale owner epoch',
			state: createWaitingState(),
			event: createProgressCheckpoint( 2_000, { ownerEpoch: 2 } ),
		},
	] )( 'ignores a $label', ( { state, event } ) => {
		expect( handleProgressCheckpoint( state, event ) ).toEqual( {
			state,
			decisions: [],
			facts: [],
		} );
	} );

	it( 'clamps overshoot progress and delegates completion with the full checkpoint high-water', () => {
		const state = createWaitingState();
		state.confirmedFocusedDurationMilliseconds = 8_000;
		const result = handleProgressCheckpoint( state, createProgressCheckpoint( 13_000 ) );

		expect( result.state.type ).toBe( 'allowance' );
		expect( result.facts[ 0 ] ).toEqual( {
			type: ProtectionFactType.PAUSE_TIME,
			factId: 'pause-time_13-scope-default_6-wait-a_1-1_5-13000',
			scopeId: 'scope-default',
			waitId: 'wait-a',
			ownerParticipantId: 'participant-a',
			ownerEpoch: 1,
			checkpointHighWaterMilliseconds: 13_000,
			acceptedDurationMilliseconds: 2_000,
			observedAtEpochMilliseconds: 1_800_000_000_000,
		} );
		expect( result.facts.map( ( fact ) => fact.type ) ).toEqual( [
			ProtectionFactType.PAUSE_TIME,
			ProtectionFactType.COMPLETED_WAIT,
			ProtectionFactType.ALLOWANCE_GRANTED,
		] );
	} );

	it( 'atomically advances the ladder, creates allowance, presents Ready, and emits completion facts', () => {
		const state = createWaitingState();
		state.ladder = createDailyLadder( 7 );
		const event = createProgressCheckpoint( 10_000, {
			observedAtEpochMilliseconds: TestInstant + 42,
			completionLocalDate: '2026-09-01',
			timingConfiguration: {
				...TestTimingConfiguration,
				allowanceMilliseconds: 60_000,
			},
		} );

		expect( handleProgressCheckpoint( state, event ) ).toEqual( {
			state: {
				type: ProtectionStateType.ALLOWANCE,
				scopeId: 'scope-default',
				allowanceId: 'allowance-a',
				completedWaitId: 'wait-a',
				startedAtEpochMilliseconds: TestInstant + 42,
				expiresAtEpochMilliseconds: TestInstant + 60_042,
				readyParticipants: state.participants,
				ladder: { completedWaits: 1, greatestObservedLocalDate: '2026-09-01' },
			},
			decisions: [ {
				type: ProtectionDecisionType.PRESENT_READY,
				participantId: 'participant-a',
				pageId: 'page-a',
				allowanceId: 'allowance-a',
			} ],
			facts: [
				{
					type: ProtectionFactType.PAUSE_TIME,
					factId: 'pause-time_13-scope-default_6-wait-a_1-1_5-10000',
					scopeId: 'scope-default',
					waitId: 'wait-a',
					ownerParticipantId: 'participant-a',
					ownerEpoch: 1,
					checkpointHighWaterMilliseconds: 10_000,
					acceptedDurationMilliseconds: 10_000,
					observedAtEpochMilliseconds: TestInstant + 42,
				},
				{
					type: ProtectionFactType.COMPLETED_WAIT,
					factId: 'completed-wait_13-scope-default_6-wait-a',
					scopeId: 'scope-default',
					waitId: 'wait-a',
					capturedWaitDurationMilliseconds: 10_000,
					completedAtEpochMilliseconds: TestInstant + 42,
					completionLocalDate: '2026-09-01',
				},
				{
					type: ProtectionFactType.ALLOWANCE_GRANTED,
					factId: 'allowance-granted_13-scope-default_11-allowance-a',
					scopeId: 'scope-default',
					allowanceId: 'allowance-a',
					startedAtEpochMilliseconds: TestInstant + 42,
					expiresAtEpochMilliseconds: TestInstant + 60_042,
					allowanceDurationMilliseconds: 60_000,
				},
			],
		} );
	} );

	it( 'moves every participant to Ready when completion remains manual', () => {
		const state = createWaitingState();
		state.participants.push( createNavigationParticipant( 'participant-b', 'page-b', false, 1 ) );
		const result = handleProgressCheckpoint( state, createProgressCheckpoint( 10_000 ) );

		expect( result.state ).toMatchObject( { readyParticipants: state.participants } );
		expect( result.decisions ).toEqual( [
			{
				type: ProtectionDecisionType.PRESENT_READY,
				participantId: 'participant-a',
				pageId: 'page-a',
				allowanceId: 'allowance-a',
			},
			{
				type: ProtectionDecisionType.PRESENT_READY,
				participantId: 'participant-b',
				pageId: 'page-b',
				allowanceId: 'allowance-a',
			},
		] );
	} );

	it( 'automatically releases only the freshly revalidated navigation owner', () => {
		const state = createWaitingState();
		state.participants.push( createNavigationParticipant( 'participant-b', 'page-b', false, 1 ) );
		const event = createProgressCheckpoint( 10_000, {
			timingConfiguration: {
				...TestTimingConfiguration,
				completionAction: CompletionAction.OPEN_AUTOMATICALLY,
			},
			automaticCompletionObservation: createFreshObservation(),
		} );
		const result = handleProgressCheckpoint( state, event );

		expect( result.state ).toMatchObject( { readyParticipants: [ state.participants[ 1 ] ] } );
		expect( result.decisions ).toEqual( [
			{
				type: ProtectionDecisionType.RELEASE_NAVIGATION,
				participantId: 'participant-a',
				pageId: 'page-a',
				retainedDestination: 'https://example.com/page-a',
			},
			{
				type: ProtectionDecisionType.PRESENT_READY,
				participantId: 'participant-b',
				pageId: 'page-b',
				allowanceId: 'allowance-a',
			},
		] );
	} );

	it( 'automatically dismisses a freshly revalidated allowance-expiry owner', () => {
		const state = createWaitingState();
		state.participants = [ createAllowanceExpiryParticipant() ];
		const event = createProgressCheckpoint( 10_000, {
			timingConfiguration: {
				...TestTimingConfiguration,
				completionAction: CompletionAction.OPEN_AUTOMATICALLY,
			},
			automaticCompletionObservation: createFreshObservation(
				'participant-a',
				'page-a',
				null,
			),
		} );
		const result = handleProgressCheckpoint( state, event );

		expect( result.state ).toMatchObject( { readyParticipants: [] } );
		expect( result.decisions ).toEqual( [ {
			type: ProtectionDecisionType.DISMISS_INTERRUPTION,
			participantId: 'participant-a',
			pageId: 'page-a',
		} ] );
	} );

	it.each( [
		{ label: 'missing observation', observation: null },
		{ label: 'different participant', observation: createFreshObservation( 'participant-b' ) },
		{ label: 'different page', observation: createFreshObservation( 'participant-a', 'page-b' ) },
		{
			label: 'unprotected destination',
			observation: {
				...createFreshObservation(),
				match: { status: ProtectedUrlMatchStatus.UNPROTECTED },
			},
		},
		{
			label: 'unsupported destination',
			observation: {
				...createFreshObservation(),
				match: {
					status: ProtectedUrlMatchStatus.UNSUPPORTED,
					reason: 'unsupported-scheme',
				},
			},
		},
		{
			label: 'different protection scope',
			observation: {
				...createFreshObservation(),
				match: {
					status: ProtectedUrlMatchStatus.PROTECTED,
					rule: {
						host: 'example.com',
						includeSubdomains: true,
						scopeId: 'scope-independent',
					},
				},
			},
		},
		{
			label: 'inactive schedule',
			observation: {
				...createFreshObservation(),
				schedule: { status: ScheduleEvaluationStatus.INACTIVE },
			},
		},
		{
			label: 'schedule evaluation error',
			observation: {
				...createFreshObservation(),
				schedule: {
					status: ScheduleEvaluationStatus.ERROR,
					reason: ScheduleEvaluationFailureReason.INVALID_TIME_ZONE,
				},
			},
		},
		{
			label: 'different destination',
			observation: createFreshObservation(
				'participant-a',
				'page-a',
				'https://example.com/other',
			),
		},
	] )( 'keeps the owner Ready with $label', ( { observation } ) => {
		const state = createWaitingState();
		const event = createProgressCheckpoint( 10_000, {
			timingConfiguration: {
				...TestTimingConfiguration,
				completionAction: CompletionAction.OPEN_AUTOMATICALLY,
			},
			automaticCompletionObservation: observation,
		} );
		const result = handleProgressCheckpoint( state, event );

		expect( result.state ).toMatchObject( {
			type: ProtectionStateType.ALLOWANCE,
			readyParticipants: state.participants,
		} );
		expect( result.decisions ).toEqual( [ {
			type: ProtectionDecisionType.PRESENT_READY,
			participantId: 'participant-a',
			pageId: 'page-a',
			allowanceId: 'allowance-a',
		} ] );
	} );

} );
