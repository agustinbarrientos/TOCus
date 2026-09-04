import { describe, expect, expectTypeOf, it } from 'vitest';
import { ProtectionDecisionType } from '../../types/protection-decision';
import type { AllowanceExpiryEvent } from '../../types/protection-event';
import {
	TestInstant,
	TestTimingConfiguration,
	createAllowanceExpiry,
	createLiveExpiryCandidate,
	createReadyExpiryCandidate,
} from '../../types/__fixtures__/protection-event';
import { ProtectionParticipantOrigin } from '../../types/protection-participant';
import { ProtectionStateType } from '../../types/protection-state';
import { ProtectedUrlMatchStatus } from '../../types/protected-url-match';
import { ScheduleEvaluationStatus } from '../../types/schedule-evaluation';
import {
	createAllowanceExpiryParticipant,
	createAllowanceState,
	createDailyLadder,
	createIdleState,
	createNavigationParticipant,
	createWaitingState,
} from '../../types/__fixtures__/protection-state';
import { handleAllowanceExpiry } from './index';

/**
 * Recursively freezes a test value so mutation attempts fail.
 * @param value - Value to freeze.
 * @return Deeply frozen value.
 * @since 0.1.0 Initial implementation.
 */
function freezeDeeply<Value>( value: Value ): Value {
	if ( typeof value !== 'object' || value === null || Object.isFrozen( value ) ) {
		return value;
	}

	for ( const child of Object.values( value ) ) {
		freezeDeeply( child );
	}

	return Object.freeze( value );
}

describe( 'handleAllowanceExpiry', () => {
	it( 'accepts the exact parsed allowance-expiry event', () => {
		expectTypeOf( handleAllowanceExpiry ).parameter( 1 ).toEqualTypeOf<AllowanceExpiryEvent>();
	} );

	it.each( [
		{ state: createIdleState(), label: 'Idle state' },
		{ state: createWaitingState(), label: 'Waiting state' },
		{ state: createAllowanceState(), label: 'before expiry', now: TestInstant + 299_999 },
		{ state: createAllowanceState(), label: 'wrong scope', overrides: { scopeId: 'scope-independent' } },
		{ state: createAllowanceState(), label: 'wrong allowance', overrides: { allowanceId: 'allowance-stale' } },
	] )( 'returns an unchanged result for $label', ( { state, now, overrides } ) => {
		const event = createAllowanceExpiry( undefined, undefined, {
			...( now === undefined ? {} : { nowEpochMilliseconds: now } ),
			...overrides,
		} );

		expect( handleAllowanceExpiry( state, event ) ).toEqual( {
			state,
			decisions: [],
			facts: [],
		} );
	} );

	it.each( [
		{ status: ScheduleEvaluationStatus.INACTIVE },
		{ status: ScheduleEvaluationStatus.ERROR, reason: 'invalid-time-zone' },
	] as const )( 'fails open before candidate validation for a $status schedule', ( schedule ) => {
		const state = createAllowanceState();
		state.ladder = createDailyLadder( 3, '2026-08-30' );
		state.readyParticipants.push( createAllowanceExpiryParticipant( 'participant-b', 'page-b', false, 1 ) );
		const event = createAllowanceExpiry( [], schedule );

		expect( handleAllowanceExpiry( state, event ) ).toEqual( {
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

	it( 'preserves the old ladder when an active expiry has no eligible candidates', () => {
		const state = {
			...createAllowanceState(),
			readyParticipants: [],
			ladder: createDailyLadder( 4, '2026-08-31' ),
		};
		const event = createAllowanceExpiry( [], undefined, { observedLocalDate: '2026-09-01' } );

		expect( handleAllowanceExpiry( state, event ) ).toEqual( {
			state: {
				type: ProtectionStateType.IDLE,
				scopeId: 'scope-default',
				ladder: state.ladder,
			},
			decisions: [],
			facts: [],
		} );
	} );

	it( 'returns atomically unchanged when candidate validation conflicts', () => {
		const state = createAllowanceState();
		const candidate = createReadyExpiryCandidate();
		const event = createAllowanceExpiry( [ candidate, { ...candidate, focusEligible: false } ] );

		expect( handleAllowanceExpiry( state, event ) ).toEqual( {
			state,
			decisions: [],
			facts: [],
		} );
	} );

	it( 'creates a focused wait with synchronized captured timing and no facts', () => {
		const state = {
			...createAllowanceState(),
			readyParticipants: [],
			ladder: createDailyLadder( 2 ),
		};
		const event = createAllowanceExpiry( [ createLiveExpiryCandidate() ] );

		expect( handleAllowanceExpiry( state, event ) ).toEqual( {
			state: {
				type: ProtectionStateType.WAITING,
				scopeId: 'scope-default',
				waitId: 'wait-expiry',
				capturedWaitDurationMilliseconds: 20_000,
				confirmedFocusedDurationMilliseconds: 0,
				participants: [ {
					origin: ProtectionParticipantOrigin.ALLOWANCE_EXPIRY,
					participantId: 'participant-live',
					pageId: 'page-live',
					retainedDestination: null,
					focusEligible: true,
					statisticsEligible: true,
					joinSequence: 0,
				} ],
				ownerParticipantId: 'participant-live',
				ownerEpoch: 1,
				checkpointHighWaterMilliseconds: 0,
				completionStatisticsEligible: true,
				ladder: state.ladder,
			},
			decisions: [ {
				type: ProtectionDecisionType.PRESENT_WAITING,
				participantId: 'participant-live',
				pageId: 'page-live',
				waitId: 'wait-expiry',
			} ],
			facts: [],
		} );
	} );

	it( 'accepts a delayed expiry transaction after the exact boundary', () => {
		const state = { ...createAllowanceState(), readyParticipants: [] };
		const event = createAllowanceExpiry( [ createLiveExpiryCandidate() ], undefined, {
			nowEpochMilliseconds: state.expiresAtEpochMilliseconds + 42,
		} );

		expect( handleAllowanceExpiry( state, event ).state.type ).toBe( ProtectionStateType.WAITING );
	} );

	it.each( [
		{ status: ProtectedUrlMatchStatus.UNPROTECTED },
		{ status: ProtectedUrlMatchStatus.UNSUPPORTED, reason: 'unsupported-scheme' },
		{
			status: ProtectedUrlMatchStatus.PROTECTED,
			rule: {
				host: 'example.com',
				includeSubdomains: true,
				scopeId: 'scope-independent',
			},
		},
	] )( 'filters a live candidate whose match status is $status', ( match ) => {
		const state = { ...createAllowanceState(), readyParticipants: [] };
		const event = createAllowanceExpiry( [ createLiveExpiryCandidate(
			'participant-live',
			'page-live',
			'https://example.com/live',
			true,
			match,
		) ] );

		expect( handleAllowanceExpiry( state, event ) ).toEqual( {
			state: {
				type: ProtectionStateType.IDLE,
				scopeId: state.scopeId,
				ladder: state.ladder,
			},
			decisions: [],
			facts: [],
		} );
	} );

	it.each( [
		{ status: ProtectedUrlMatchStatus.UNPROTECTED },
		{ status: ProtectedUrlMatchStatus.UNSUPPORTED, reason: 'unsupported-scheme' },
		{
			status: ProtectedUrlMatchStatus.PROTECTED,
			rule: {
				host: 'example.com',
				includeSubdomains: true,
				scopeId: 'scope-independent',
			},
		},
	] )( 'fails open a Ready-only candidate whose match status is $status', ( match ) => {
		const state = createAllowanceState();
		const event = createAllowanceExpiry( [ createReadyExpiryCandidate(
			'participant-a',
			'page-a',
			'https://example.com/page-a',
			true,
			match,
		) ] );

		expect( handleAllowanceExpiry( state, event ) ).toEqual( {
			state: {
				type: ProtectionStateType.IDLE,
				scopeId: state.scopeId,
				ladder: state.ladder,
			},
			decisions: [ {
				type: ProtectionDecisionType.RELEASE_NAVIGATION,
				participantId: 'participant-a',
				pageId: 'page-a',
				retainedDestination: 'https://example.com/page-a',
			} ],
			facts: [],
		} );
	} );

	it( 'resets a forward-date ladder before capturing the next wait duration', () => {
		const state = {
			...createAllowanceState(),
			readyParticipants: [],
			ladder: createDailyLadder( 2, '2026-08-31' ),
		};
		const event = createAllowanceExpiry( [ createLiveExpiryCandidate() ], undefined, {
			observedLocalDate: '2026-09-01',
		} );
		const result = handleAllowanceExpiry( state, event );

		expect( result.state.type ).toBe( ProtectionStateType.WAITING );
		if ( result.state.type !== ProtectionStateType.WAITING ) {
			throw new Error( 'Expected a Waiting result.' );
		}
		expect( result.state.ladder ).toEqual( createDailyLadder( 0, '2026-09-01' ) );
		expect( result.state.capturedWaitDurationMilliseconds ).toBe( 10_000 );
	} );

	it( 'preserves a backward-date ladder and captures timing from its greatest observed date', () => {
		const state = {
			...createAllowanceState(),
			readyParticipants: [],
			ladder: createDailyLadder( 3, '2026-09-01' ),
		};
		const event = createAllowanceExpiry( [ createLiveExpiryCandidate() ], undefined, {
			observedLocalDate: '2026-08-31',
		} );
		const result = handleAllowanceExpiry( state, event );

		expect( result.state.type ).toBe( ProtectionStateType.WAITING );
		if ( result.state.type !== ProtectionStateType.WAITING ) {
			throw new Error( 'Expected a Waiting result.' );
		}
		expect( result.state.ladder ).toEqual( state.ladder );
		expect( result.state.capturedWaitDurationMilliseconds ).toBe( 25_000 );
	} );

	it( 'sorts combined Ready and live pages before assigning join sequence and owner', () => {
		const state = {
			...createAllowanceState(),
			readyParticipants: [ createNavigationParticipant(
				'participant-ready',
				'page-z',
				false,
				0,
				'https://example.com/ready',
			) ],
		};
		const readyCandidate = createReadyExpiryCandidate(
			'participant-ready',
			'page-z',
			'https://example.com/ready',
			false,
		);
		const liveCandidate = createLiveExpiryCandidate(
			'participant-live',
			'page-a',
			'https://example.com/live',
			true,
		);
		const first = handleAllowanceExpiry(
			state,
			createAllowanceExpiry( [ readyCandidate, liveCandidate ] ),
		);
		const second = handleAllowanceExpiry(
			state,
			createAllowanceExpiry( [ liveCandidate, readyCandidate ] ),
		);

		expect( first ).toEqual( second );
		expect( first.state.type ).toBe( ProtectionStateType.WAITING );
		if ( first.state.type !== ProtectionStateType.WAITING ) {
			throw new Error( 'Expected a Waiting result.' );
		}
		expect( first.state.participants.map( ( participant ) => ( {
			participantId: participant.participantId,
			pageId: participant.pageId,
			joinSequence: participant.joinSequence,
		} ) ) ).toEqual( [
			{ participantId: 'participant-live', pageId: 'page-a', joinSequence: 0 },
			{ participantId: 'participant-ready', pageId: 'page-z', joinSequence: 1 },
		] );
		expect( first.state.ownerParticipantId ).toBe( 'participant-live' );
		expect( first.decisions ).toEqual( [ {
			type: ProtectionDecisionType.PRESENT_WAITING,
			participantId: 'participant-live',
			pageId: 'page-a',
			waitId: 'wait-expiry',
		} ] );
	} );

	it( 'preserves ascending Ready-then-live page order', () => {
		const state = createAllowanceState();
		const result = handleAllowanceExpiry( state, createAllowanceExpiry( [
			createReadyExpiryCandidate(),
			createLiveExpiryCandidate( 'participant-live', 'page-z' ),
		] ) );

		expect( result.state.type ).toBe( ProtectionStateType.WAITING );
		if ( result.state.type !== ProtectionStateType.WAITING ) {
			throw new Error( 'Expected a Waiting result.' );
		}
		expect( result.state.participants.map( ( participant ) => participant.pageId ) ).toEqual( [
			'page-a',
			'page-z',
		] );
	} );

	it( 'creates an ownerless wait without a presentation decision', () => {
		const state = { ...createAllowanceState(), readyParticipants: [] };
		const event = createAllowanceExpiry( [ createLiveExpiryCandidate(
			'participant-live',
			'page-live',
			'https://example.com/live',
			false,
		) ] );
		const result = handleAllowanceExpiry( state, event );

		expect( result.state.type ).toBe( ProtectionStateType.WAITING );
		if ( result.state.type !== ProtectionStateType.WAITING ) {
			throw new Error( 'Expected a Waiting result.' );
		}
		expect( result.state.ownerParticipantId ).toBeNull();
		expect( result.state.ownerEpoch ).toBe( 0 );
		expect( result.decisions ).toEqual( [] );
		expect( result.facts ).toEqual( [] );
	} );

	it( 'presents only the deterministic owner when multiple participants are focused', () => {
		const state = { ...createAllowanceState(), readyParticipants: [] };
		const event = createAllowanceExpiry( [
			createLiveExpiryCandidate( 'participant-z', 'page-z' ),
			createLiveExpiryCandidate( 'participant-a', 'page-a' ),
		] );
		const result = handleAllowanceExpiry( state, event );

		expect( result.state.type ).toBe( ProtectionStateType.WAITING );
		if ( result.state.type !== ProtectionStateType.WAITING ) {
			throw new Error( 'Expected a Waiting result.' );
		}
		expect( result.state.ownerParticipantId ).toBe( 'participant-a' );
		expect( result.decisions ).toEqual( [ {
			type: ProtectionDecisionType.PRESENT_WAITING,
			participantId: 'participant-a',
			pageId: 'page-a',
			waitId: 'wait-expiry',
		} ] );
	} );

	it( 'projects multiple Ready participants by identity independent of candidate order', () => {
		const state = createAllowanceState();
		state.readyParticipants.push( createNavigationParticipant(
			'participant-b',
			'page-b',
			false,
			1,
			'https://example.com/b',
		) );
		const event = createAllowanceExpiry( [
			createReadyExpiryCandidate(
				'participant-b',
				'page-b',
				'https://example.com/b',
				false,
			),
			createReadyExpiryCandidate(),
		] );
		const result = handleAllowanceExpiry( state, event );

		expect( result.state.type ).toBe( ProtectionStateType.WAITING );
		if ( result.state.type !== ProtectionStateType.WAITING ) {
			throw new Error( 'Expected a Waiting result.' );
		}
		expect( result.state.participants.map( ( participant ) => participant.participantId ) ).toEqual( [
			'participant-a',
			'participant-b',
		] );
	} );

	it.each( [
		{
			initialFocusEligible: false,
			observedFocusEligible: true,
			expectedOwnerParticipantId: 'participant-a',
			expectedOwnerEpoch: 1,
			expectedDecisions: [ {
				type: ProtectionDecisionType.PRESENT_WAITING,
				participantId: 'participant-a',
				pageId: 'page-a',
				waitId: 'wait-expiry',
			} ],
		},
		{
			initialFocusEligible: true,
			observedFocusEligible: false,
			expectedOwnerParticipantId: null,
			expectedOwnerEpoch: 0,
			expectedDecisions: [],
		},
	] )( 'refreshes Ready focus from $initialFocusEligible to $observedFocusEligible', ( {
		initialFocusEligible,
		observedFocusEligible,
		expectedOwnerParticipantId,
		expectedOwnerEpoch,
		expectedDecisions,
	} ) => {
		const state = {
			...createAllowanceState(),
			readyParticipants: [ createNavigationParticipant(
				'participant-a',
				'page-a',
				initialFocusEligible,
				0,
				'https://example.com/page-a',
			) ],
		};
		const event = createAllowanceExpiry( [ createReadyExpiryCandidate(
			'participant-a',
			'page-a',
			'https://example.com/page-a',
			observedFocusEligible,
		) ] );

		expect( handleAllowanceExpiry( state, event ) ).toEqual( {
			state: {
				type: ProtectionStateType.WAITING,
				scopeId: 'scope-default',
				waitId: 'wait-expiry',
				capturedWaitDurationMilliseconds: 10_000,
				confirmedFocusedDurationMilliseconds: 0,
				participants: [ {
					origin: ProtectionParticipantOrigin.NAVIGATION,
					participantId: 'participant-a',
					pageId: 'page-a',
					retainedDestination: 'https://example.com/page-a',
					focusEligible: observedFocusEligible,
					statisticsEligible: true,
					joinSequence: 0,
				} ],
				ownerParticipantId: expectedOwnerParticipantId,
				ownerEpoch: expectedOwnerEpoch,
				checkpointHighWaterMilliseconds: 0,
				completionStatisticsEligible: true,
				ladder: { completedWaits: 0, greatestObservedLocalDate: '2026-08-31' },
			},
			decisions: expectedDecisions,
			facts: [],
		} );
	} );

	it( 'preserves a valid expiry-origin Ready participant with a null destination observation', () => {
		const participant = createAllowanceExpiryParticipant();
		const state = {
			...createAllowanceState(),
			readyParticipants: [ participant ],
		};
		const event = createAllowanceExpiry( [ createReadyExpiryCandidate(
			participant.participantId,
			participant.pageId,
			null,
		) ] );
		const result = handleAllowanceExpiry( state, event );

		expect( result.state.type ).toBe( ProtectionStateType.WAITING );
		if ( result.state.type !== ProtectionStateType.WAITING ) {
			throw new Error( 'Expected a Waiting result.' );
		}
		expect( result.state.participants ).toEqual( [ participant ] );
		expect( result.decisions ).toEqual( [ {
			type: ProtectionDecisionType.PRESENT_WAITING,
			participantId: participant.participantId,
			pageId: participant.pageId,
			waitId: 'wait-expiry',
		} ] );
	} );

	it( 'retains only protected candidates and revalidates Ready destinations', () => {
		const state = createAllowanceState();
		const event = createAllowanceExpiry( [
			createReadyExpiryCandidate(
				'participant-a',
				'page-a',
				'https://example.com/page-a',
				true,
				{ status: ProtectedUrlMatchStatus.UNPROTECTED },
			),
			createLiveExpiryCandidate(),
		] );
		const result = handleAllowanceExpiry( state, event );

		expect( result.state.type ).toBe( ProtectionStateType.WAITING );
		if ( result.state.type !== ProtectionStateType.WAITING ) {
			throw new Error( 'Expected a Waiting result.' );
		}
		expect( result.state.participants.map( ( participant ) => participant.participantId ) ).toEqual( [
			'participant-live',
		] );
		expect( result.decisions ).toEqual( [
			{
				type: ProtectionDecisionType.RELEASE_NAVIGATION,
				participantId: 'participant-a',
				pageId: 'page-a',
				retainedDestination: 'https://example.com/page-a',
			},
			{
				type: ProtectionDecisionType.PRESENT_WAITING,
				participantId: 'participant-live',
				pageId: 'page-live',
				waitId: 'wait-expiry',
			},
		] );
	} );

	it( 'returns atomically unchanged for a mismatched navigation Ready destination', () => {
		const state = createAllowanceState();
		const event = createAllowanceExpiry( [ createReadyExpiryCandidate(
			'participant-a',
			'page-a',
			'https://example.com/other',
		) ] );

		expect( handleAllowanceExpiry( state, event ) ).toEqual( {
			state,
			decisions: [],
			facts: [],
		} );
	} );

	it( 'returns atomically unchanged for a null navigation Ready destination', () => {
		const state = createAllowanceState();
		const event = createAllowanceExpiry( [ createReadyExpiryCandidate(
			'participant-a',
			'page-a',
			null,
		) ] );

		expect( handleAllowanceExpiry( state, event ) ).toEqual( {
			state,
			decisions: [],
			facts: [],
		} );
	} );

	it( 'returns atomically unchanged for a non-null expiry-origin Ready destination', () => {
		const state = {
			...createAllowanceState(),
			readyParticipants: [ createAllowanceExpiryParticipant() ],
		};
		const event = createAllowanceExpiry( [ createReadyExpiryCandidate() ] );

		expect( handleAllowanceExpiry( state, event ) ).toEqual( {
			state,
			decisions: [],
			facts: [],
		} );
	} );

	it( 'applies Ready-page precedence after filtering non-protected live observations', () => {
		const state = createAllowanceState();
		const event = createAllowanceExpiry( [
			createReadyExpiryCandidate(),
			createLiveExpiryCandidate( 'participant-live', 'page-a' ),
			createLiveExpiryCandidate(
				'participant-filtered',
				'page-filtered',
				'https://example.com/filtered',
				true,
				{ status: ProtectedUrlMatchStatus.UNPROTECTED },
			),
		] );
		const result = handleAllowanceExpiry( state, event );

		expect( result.state.type ).toBe( ProtectionStateType.WAITING );
		if ( result.state.type !== ProtectionStateType.WAITING ) {
			throw new Error( 'Expected a Waiting result.' );
		}
		expect( result.state.participants ).toEqual( [ state.readyParticipants[ 0 ] ] );
	} );

	it( 'suppresses a protected live representation when the authoritative Ready page fails open', () => {
		const state = createAllowanceState();
		const event = createAllowanceExpiry( [
			createReadyExpiryCandidate(
				'participant-a',
				'page-a',
				'https://example.com/page-a',
				true,
				{ status: ProtectedUrlMatchStatus.UNPROTECTED },
			),
			createLiveExpiryCandidate( 'participant-live', 'page-a' ),
		] );

		expect( handleAllowanceExpiry( state, event ) ).toEqual( {
			state: {
				type: ProtectionStateType.IDLE,
				scopeId: state.scopeId,
				ladder: state.ladder,
			},
			decisions: [ {
				type: ProtectionDecisionType.RELEASE_NAVIGATION,
				participantId: 'participant-a',
				pageId: 'page-a',
				retainedDestination: 'https://example.com/page-a',
			} ],
			facts: [],
		} );
	} );

	it( 'makes replay against the created Waiting state a no-op despite changed settings', () => {
		const state = { ...createAllowanceState(), readyParticipants: [] };
		const event = createAllowanceExpiry( [ createLiveExpiryCandidate() ], undefined, {
			timingConfiguration: {
				...TestTimingConfiguration,
				initialWaitMilliseconds: 60_000,
				maximumWaitMilliseconds: 60_000,
			},
		} );
		const first = handleAllowanceExpiry( state, event );
		const replay = createAllowanceExpiry( [ createLiveExpiryCandidate() ] );

		expect( first.state.type ).toBe( ProtectionStateType.WAITING );
		if ( first.state.type !== ProtectionStateType.WAITING ) {
			throw new Error( 'Expected a Waiting result.' );
		}
		expect( first.state.capturedWaitDurationMilliseconds ).toBe( 60_000 );
		expect( handleAllowanceExpiry( first.state, replay ) ).toEqual( {
			state: first.state,
			decisions: [],
			facts: [],
		} );
	} );

	it( 'does not mutate deeply frozen expiry inputs', () => {
		const state = freezeDeeply( {
			...createAllowanceState(),
			readyParticipants: [],
		} );
		const candidate = createLiveExpiryCandidate();
		const event = freezeDeeply( {
			...createAllowanceExpiry( [ candidate ] ),
			candidates: [ candidate ],
		} );

		expect( () => handleAllowanceExpiry( state, event ) ).not.toThrow();
		expect( Object.isFrozen( state.ladder ) ).toBe( true );
		expect( Object.isFrozen( event.candidates[ 0 ]?.match ) ).toBe( true );
	} );
} );
