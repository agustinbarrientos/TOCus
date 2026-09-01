import { describe, expect, expectTypeOf, it } from 'vitest';
import { ProtectionDecisionType } from '../../types/protection-decision';
import { type VisitAttemptEvent } from '../../types/protection-event';
import {
	TestInstant,
	TestTimingConfiguration,
	createVisitAttempt,
} from '../../types/__fixtures__/protection-event';
import { ProtectionParticipantOrigin } from '../../types/protection-participant';
import { ProtectionStateType } from '../../types/protection-state';
import { ScheduleEvaluationStatus } from '../../types/schedule-evaluation';
import {
	createAllowanceExpiryParticipant,
	createAllowanceState,
	createDailyLadder,
	createIdleState,
	createNavigationParticipant,
	createWaitingState,
} from '../../types/__fixtures__/protection-state';
import { handleVisitAttempt } from './index';

describe( 'visit-attempt transition', () => {
	it( 'accepts exactly one validated visit-attempt event branch', () => {
		expectTypeOf( handleVisitAttempt ).parameter( 1 ).toEqualTypeOf<VisitAttemptEvent>();
	} );

	it.each( [
		{ status: ScheduleEvaluationStatus.INACTIVE },
		{ status: ScheduleEvaluationStatus.ERROR, reason: 'invalid-time-zone' as const },
	] )( 'deactivates a shared wait when a visit observes schedule status $status', ( schedule ) => {
		const state = {
			...createWaitingState(),
			participants: [
				createNavigationParticipant(),
				createAllowanceExpiryParticipant( 'participant-expiry', 'page-expiry', false, 1 ),
			],
		};
		const event = createVisitAttempt( 'participant-a', 'page-a', true, { schedule } );

		expect( handleVisitAttempt( state, event ) ).toEqual( {
			state: {
				type: ProtectionStateType.IDLE,
				scopeId: 'scope-default',
				ladder: { completedWaits: 0, greatestObservedLocalDate: '2026-08-31' },
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
					participantId: 'participant-expiry',
					pageId: 'page-expiry',
				},
			],
			facts: [],
		} );
	} );

	it.each( [
		{ status: ScheduleEvaluationStatus.INACTIVE },
		{ status: ScheduleEvaluationStatus.ERROR, reason: 'invalid-time-zone' as const },
	] )( 'clears Ready participants when a visit observes schedule status $status', ( schedule ) => {
		const state = {
			...createAllowanceState(),
			readyParticipants: [
				createNavigationParticipant(),
				createAllowanceExpiryParticipant( 'participant-expiry', 'page-expiry', false, 1 ),
			],
		};
		const event = createVisitAttempt( 'participant-b', 'page-b', true, {
			nowEpochMilliseconds: state.expiresAtEpochMilliseconds - 1,
			schedule,
		} );

		expect( handleVisitAttempt( state, event ) ).toEqual( {
			state: {
				...state,
				readyParticipants: [],
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
					participantId: 'participant-expiry',
					pageId: 'page-expiry',
				},
				{
					type: ProtectionDecisionType.RELEASE_NAVIGATION,
					participantId: 'participant-b',
					pageId: 'page-b',
					retainedDestination: 'https://example.com/page-b',
				},
			],
			facts: [],
		} );
	} );

	it.each( [
		{ status: ScheduleEvaluationStatus.INACTIVE },
		{ status: ScheduleEvaluationStatus.ERROR, reason: 'invalid-time-zone' as const },
	] )( 'fails open from Idle when schedule status is $status', ( schedule ) => {
		const state = createIdleState();
		const event = createVisitAttempt( 'participant-a', 'page-a', true, { schedule } );

		expect( handleVisitAttempt( state, event ) ).toEqual( {
			state,
			decisions: [ {
				type: ProtectionDecisionType.RELEASE_NAVIGATION,
				participantId: 'participant-a',
				pageId: 'page-a',
				retainedDestination: 'https://example.com/page-a',
			} ],
			facts: [],
		} );
	} );

	it( 'keeps an expired allowance unchanged before considering fail-open schedule status', () => {
		const state = createAllowanceState();
		const event = createVisitAttempt( 'participant-b', 'page-b', true, {
			nowEpochMilliseconds: state.expiresAtEpochMilliseconds,
			schedule: { status: ScheduleEvaluationStatus.INACTIVE },
		} );

		expect( handleVisitAttempt( state, event ) ).toEqual( {
			state,
			decisions: [],
			facts: [],
		} );
	} );

	it.each( [ 0, 1 ] )( 'keeps an allowance unchanged at or after expiry plus %i milliseconds', ( offset ) => {
		const state = createAllowanceState();
		const event = createVisitAttempt( 'participant-b', 'page-b', true, {
			nowEpochMilliseconds: state.expiresAtEpochMilliseconds + offset,
		} );

		expect( handleVisitAttempt( state, event ) ).toEqual( {
			state,
			decisions: [],
			facts: [],
		} );
	} );

	it( 'releases navigation during an unexpired allowance', () => {
		const state = createAllowanceState();
		const event = createVisitAttempt( 'participant-b', 'page-b', true, {
			nowEpochMilliseconds: state.expiresAtEpochMilliseconds - 1,
		} );

		expect( handleVisitAttempt( state, event ) ).toEqual( {
			state: {
				type: ProtectionStateType.ALLOWANCE,
				scopeId: 'scope-default',
				allowanceId: 'allowance-a',
				completedWaitId: 'wait-a',
				startedAtEpochMilliseconds: TestInstant,
				expiresAtEpochMilliseconds: TestInstant + 300_000,
				readyParticipants: [ {
					origin: ProtectionParticipantOrigin.NAVIGATION,
					participantId: 'participant-a',
					pageId: 'page-a',
					retainedDestination: 'https://example.com/page-a',
					focusEligible: true,
					joinSequence: 0,
				} ],
				ladder: { completedWaits: 0, greatestObservedLocalDate: '2026-08-31' },
			},
			decisions: [ {
				type: ProtectionDecisionType.RELEASE_NAVIGATION,
				participantId: 'participant-b',
				pageId: 'page-b',
				retainedDestination: 'https://example.com/page-b',
			} ],
			facts: [],
		} );
	} );

	it( 'creates a new focused wait with synchronized ladder and captured timing', () => {
		const state = {
			...createIdleState(),
			ladder: createDailyLadder( 4 ),
		};
		const event = createVisitAttempt( 'participant-a', 'page-a', true, {
			observedLocalDate: '2026-09-01',
		} );

		expect( handleVisitAttempt( state, event ) ).toEqual( {
			state: {
				type: ProtectionStateType.WAITING,
				scopeId: 'scope-default',
				waitId: 'wait-a',
				capturedWaitDurationMilliseconds: 10_000,
				confirmedFocusedDurationMilliseconds: 0,
				participants: [ { ...event.participant, joinSequence: 0 } ],
				ownerParticipantId: 'participant-a',
				ownerEpoch: 1,
				checkpointHighWaterMilliseconds: 0,
				ladder: { completedWaits: 0, greatestObservedLocalDate: '2026-09-01' },
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

	it( 'captures current-day ladder timing and creates an ownerless epoch-zero wait when unfocused', () => {
		const state = {
			...createIdleState(),
			ladder: createDailyLadder( 4 ),
		};
		const event = createVisitAttempt( 'participant-a', 'page-a', false );
		const result = handleVisitAttempt( state, event );

		expect( result.state ).toMatchObject( {
			capturedWaitDurationMilliseconds:
				TestTimingConfiguration.initialWaitMilliseconds +
				TestTimingConfiguration.ladderIncreaseMilliseconds * 4,
			ownerParticipantId: null,
			ownerEpoch: 0,
			ladder: state.ladder,
		} );
	} );

	it( 'joins a new participant without recapturing timing and assigns the next sequence', () => {
		const state = createWaitingState();
		const event = createVisitAttempt( 'participant-b', 'page-b', false, {
			waitId: 'ignored-wait',
			timingConfiguration: {
				...TestTimingConfiguration,
				initialWaitMilliseconds: 60_000,
			},
		} );
		const result = handleVisitAttempt( state, event );

		expect( result.state ).toEqual( {
			...state,
			participants: [
				...state.participants,
				{ ...event.participant, joinSequence: 1 },
			],
		} );
		expect( result.decisions[ 0 ] ).toMatchObject( {
			participantId: 'participant-b',
			waitId: 'wait-a',
		} );
	} );

	it.each( [
		{
			label: 'reverse lexical tie order',
			participants: [
				createNavigationParticipant(
					'participant-z',
					'page-z',
					true,
					Number.MAX_SAFE_INTEGER,
				),
				createNavigationParticipant(
					'participant-first',
					'page-first',
					false,
					Number.MAX_SAFE_INTEGER - 1,
				),
				createNavigationParticipant(
					'participant-a',
					'page-a',
					true,
					Number.MAX_SAFE_INTEGER,
				),
			],
		},
		{
			label: 'forward lexical tie order',
			participants: [
				createNavigationParticipant(
					'participant-a',
					'page-a',
					true,
					Number.MAX_SAFE_INTEGER,
				),
				createNavigationParticipant(
					'participant-first',
					'page-first',
					false,
					Number.MAX_SAFE_INTEGER - 1,
				),
				createNavigationParticipant(
					'participant-z',
					'page-z',
					true,
					Number.MAX_SAFE_INTEGER,
				),
			],
		},
	] )(
		'compacts exhausted join sequences from $label without changing ownership',
		( { participants } ) => {
			const state = createWaitingState();
			state.confirmedFocusedDurationMilliseconds = 3_000;
			state.checkpointHighWaterMilliseconds = 3_000;
			state.participants = participants;
			state.ownerParticipantId = participants.find(
				( participant ) => participant.participantId === 'participant-a',
			)?.participantId ?? null;
			state.ownerEpoch = Number.MAX_SAFE_INTEGER;
			const event = createVisitAttempt( 'participant-new', 'page-new', true );

			expect( handleVisitAttempt( state, event ) ).toEqual( {
				state: {
					...state,
					participants: [
						createNavigationParticipant( 'participant-first', 'page-first', false, 0 ),
						createNavigationParticipant( 'participant-a', 'page-a', true, 1 ),
						createNavigationParticipant( 'participant-z', 'page-z', true, 2 ),
						{ ...event.participant, joinSequence: 3 },
					],
				},
				decisions: [ {
					type: ProtectionDecisionType.PRESENT_WAITING,
					participantId: 'participant-new',
					pageId: 'page-new',
					waitId: 'wait-a',
				} ],
				facts: [],
			} );
		},
	);

	it( 'assigns the first focused joiner to an ownerless wait and resets its checkpoint epoch', () => {
		const state = {
			...createWaitingState(),
			participants: [ createNavigationParticipant( 'participant-a', 'page-a', false ) ],
			ownerParticipantId: null,
			ownerEpoch: 0,
		};
		const event = createVisitAttempt( 'participant-b', 'page-b' );

		expect( handleVisitAttempt( state, event ) ).toEqual( {
			state: {
				type: ProtectionStateType.WAITING,
				scopeId: 'scope-default',
				waitId: 'wait-a',
				capturedWaitDurationMilliseconds: 10_000,
				confirmedFocusedDurationMilliseconds: 0,
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
				ownerEpoch: 1,
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

	it( 'abandons an ownerless wait when a focused join would exhaust owner identity', () => {
		const state = {
			...createWaitingState(),
			participants: [
				createNavigationParticipant( 'participant-a', 'page-a', false, 0 ),
				createAllowanceExpiryParticipant( 'participant-b', 'page-b', false, 1 ),
			],
			ownerParticipantId: null,
			ownerEpoch: Number.MAX_SAFE_INTEGER,
		};
		const event = createVisitAttempt( 'participant-new', 'page-new', true );

		expect( handleVisitAttempt( state, event ) ).toEqual( {
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
				{
					type: ProtectionDecisionType.RELEASE_NAVIGATION,
					participantId: 'participant-new',
					pageId: 'page-new',
					retainedDestination: 'https://example.com/page-new',
				},
			],
			facts: [],
		} );
	} );

	it( 'keeps an ownerless wait paused when another unfocused participant joins', () => {
		const state = {
			...createWaitingState(),
			participants: [ createNavigationParticipant( 'participant-a', 'page-a', false ) ],
			ownerParticipantId: null,
			ownerEpoch: 0,
		};
		const result = handleVisitAttempt(
			state,
			createVisitAttempt( 'participant-b', 'page-b', false ),
		);

		expect( result.state ).toMatchObject( {
			ownerParticipantId: null,
			ownerEpoch: 0,
			checkpointHighWaterMilliseconds: 0,
		} );
	} );

	it( 'replays an existing navigation participant without rewriting retained observations', () => {
		const state = createWaitingState();
		const event = createVisitAttempt( 'participant-a', 'page-a', true, {
			participant: {
				...createVisitAttempt().participant,
				retainedDestination: 'https://example.com/changed',
				focusEligible: false,
			},
		} );

		expect( handleVisitAttempt( state, event ) ).toEqual( {
			state,
			decisions: [ {
				type: ProtectionDecisionType.PRESENT_WAITING,
				participantId: 'participant-a',
				pageId: 'page-a',
				waitId: 'wait-a',
			} ],
			facts: [],
		} );
	} );

	it( 'does not revive stale focus or ownership when the original visit is replayed', () => {
		const state = {
			...createWaitingState(),
			participants: [ createNavigationParticipant( 'participant-a', 'page-a', false ) ],
			ownerParticipantId: null,
			ownerEpoch: 2,
		};

		expect( handleVisitAttempt( state, createVisitAttempt() ) ).toEqual( {
			state,
			decisions: [ {
				type: ProtectionDecisionType.PRESENT_WAITING,
				participantId: 'participant-a',
				pageId: 'page-a',
				waitId: 'wait-a',
			} ],
			facts: [],
		} );
	} );

	it.each( [
		{
			label: 'participant identity reused by a new page',
			state: createWaitingState(),
			event: createVisitAttempt( 'participant-a', 'page-b' ),
		},
		{
			label: 'page identity reused by a new participant',
			state: createWaitingState(),
			event: createVisitAttempt( 'participant-b', 'page-a' ),
		},
		{
			label: 'existing runtime participant has a different origin',
			state: {
				...createWaitingState(),
				participants: [ createAllowanceExpiryParticipant() ],
			},
			event: createVisitAttempt(),
		},
	] )( 'ignores a conflicting waiting identity: $label', ( { state, event } ) => {
		expect( handleVisitAttempt( state, event ) ).toEqual( {
			state,
			decisions: [],
			facts: [],
		} );
	} );

	it( 'preserves an existing owner when a later focused participant joins', () => {
		const state = createWaitingState();
		state.participants = [ createNavigationParticipant( 'participant-a', 'page-a', true, 0 ) ];
		const result = handleVisitAttempt(
			state,
			createVisitAttempt( 'participant-b', 'page-b', true ),
		);

		expect( result.state ).toMatchObject( {
			ownerParticipantId: 'participant-a',
			ownerEpoch: 1,
			checkpointHighWaterMilliseconds: 0,
		} );
		expect( result.state.type ).toBe( ProtectionStateType.WAITING );
		expect( result.facts ).toEqual( [] );
	} );

	it( 'accepts only navigation-origin visit attempts at the event boundary', () => {
		expect( createVisitAttempt().participant.origin ).toBe( ProtectionParticipantOrigin.NAVIGATION );
	} );
} );
