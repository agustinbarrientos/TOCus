import { describe, expect, expectTypeOf, it } from 'vitest';
import { ProtectionDecisionType } from '../../types/protection-decision';
import type {
	ReadyContinuationEvent,
	ReadyReconciliationEvent,
} from '../../types/protection-event';
import {
	TestInstant,
	createFreshObservation,
	createReadyContinuation,
	createReadyReconciliation,
} from '../../types/__fixtures__/protection-event';
import { type ProtectionState } from '../../types/protection-state';
import { ProtectedUrlMatchStatus } from '../../types/protected-url-match';
import { ScheduleEvaluationStatus } from '../../types/schedule-evaluation';
import {
	createAllowanceExpiryParticipant,
	createAllowanceState,
	createIdleState,
} from '../../types/__fixtures__/protection-state';
import { handleReadyParticipant } from './index';

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

describe( 'handleReadyParticipant', () => {
	it( 'accepts the exact parsed Ready event union', () => {
		expectTypeOf( handleReadyParticipant )
			.parameter( 1 )
			.toEqualTypeOf<ReadyContinuationEvent | ReadyReconciliationEvent>();
	} );

	it( 'releases only the matching navigation participant after explicit continuation', () => {
		const state = createAllowanceState();
		state.readyParticipants.push( createAllowanceExpiryParticipant( 'participant-b', 'page-b', false, 1 ) );

		expect( handleReadyParticipant( state, createReadyContinuation() ) ).toEqual( {
			state: {
				...state,
				readyParticipants: [ state.readyParticipants[ 1 ] ],
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

	it( 're-presents a protected expiry-origin participant whose destination remains null', () => {
		const state = {
			...createAllowanceState(),
			readyParticipants: [ createAllowanceExpiryParticipant() ],
		};
		const event = createReadyReconciliation(
			createFreshObservation( 'participant-a', 'page-a', null ),
		);

		expect( handleReadyParticipant( state, event ) ).toEqual( {
			state,
			decisions: [ {
				type: ProtectionDecisionType.PRESENT_READY,
				participantId: 'participant-a',
				pageId: 'page-a',
				allowanceId: 'allowance-a',
			} ],
			facts: [],
		} );
	} );

	it.each( [
		{
			match: { status: ProtectedUrlMatchStatus.UNPROTECTED },
			schedule: { status: ScheduleEvaluationStatus.ACTIVE },
		},
		{
			match: { status: ProtectedUrlMatchStatus.UNSUPPORTED, reason: 'unsupported-scheme' },
			schedule: { status: ScheduleEvaluationStatus.ACTIVE },
		},
		{
			match: {
				status: ProtectedUrlMatchStatus.PROTECTED,
				rule: { host: 'example.com', includeSubdomains: true, scopeId: 'scope-independent' },
			},
			schedule: { status: ScheduleEvaluationStatus.ACTIVE },
		},
		{
			match: {
				status: ProtectedUrlMatchStatus.PROTECTED,
				rule: { host: 'example.com', includeSubdomains: true, scopeId: 'scope-default' },
			},
			schedule: { status: ScheduleEvaluationStatus.INACTIVE },
		},
		{
			match: {
				status: ProtectedUrlMatchStatus.PROTECTED,
				rule: { host: 'example.com', includeSubdomains: true, scopeId: 'scope-default' },
			},
			schedule: { status: ScheduleEvaluationStatus.ERROR, reason: 'invalid-time-zone' },
		},
	] )( 'fails open expiry-origin reconciliation when protection is no longer active', ( {
		match,
		schedule,
	} ) => {
		const state = {
			...createAllowanceState(),
			readyParticipants: [ createAllowanceExpiryParticipant() ],
		};
		const event = createReadyReconciliation( createFreshObservation(
			'participant-a',
			'page-a',
			null,
			{ match, schedule },
		) );

		expect( handleReadyParticipant( state, event ) ).toEqual( {
			state: { ...state, readyParticipants: [] },
			decisions: [ {
				type: ProtectionDecisionType.DISMISS_INTERRUPTION,
				participantId: 'participant-a',
				pageId: 'page-a',
			} ],
			facts: [],
		} );
	} );

	it.each( [ 0, 1 ] )( 'keeps reconciliation under expiry ownership at +%i milliseconds', ( offset ) => {
		const state = createAllowanceState();
		const event = createReadyReconciliation( undefined, {
			nowEpochMilliseconds: state.expiresAtEpochMilliseconds + offset,
		} );

		expect( handleReadyParticipant( state, event ) ).toEqual( {
			state,
			decisions: [],
			facts: [],
		} );
	} );

	it( 'fails open only one participant during reconciliation and deduplicates replay', () => {
		const state = createAllowanceState();
		state.readyParticipants.push( createAllowanceExpiryParticipant( 'participant-b', 'page-b', false, 1 ) );
		const event = createReadyReconciliation( createFreshObservation(
			'participant-a',
			'page-a',
			'https://example.com/page-a',
			{ match: { status: ProtectedUrlMatchStatus.UNPROTECTED } },
		) );
		const firstResult = handleReadyParticipant( state, event );

		expect( firstResult ).toEqual( {
			state: { ...state, readyParticipants: [ state.readyParticipants[ 1 ] ] },
			decisions: [ {
				type: ProtectionDecisionType.RELEASE_NAVIGATION,
				participantId: 'participant-a',
				pageId: 'page-a',
				retainedDestination: 'https://example.com/page-a',
			} ],
			facts: [],
		} );
		expect( handleReadyParticipant( firstResult.state, event ) ).toEqual( {
			state: firstResult.state,
			decisions: [],
			facts: [],
		} );
	} );

	it.each( [
		{
			label: 'stale allowance',
			event: createReadyReconciliation( undefined, { allowanceId: 'allowance-stale' } ),
		},
		{
			label: 'stale participant',
			event: createReadyReconciliation( createFreshObservation( 'participant-stale' ) ),
		},
		{
			label: 'stale page',
			event: createReadyReconciliation( createFreshObservation( 'participant-a', 'page-stale' ) ),
		},
		{
			label: 'changed navigation destination',
			event: createReadyReconciliation( createFreshObservation(
				'participant-a',
				'page-a',
				'https://example.com/other',
			) ),
		},
	] )( 'ignores navigation reconciliation with $label', ( { event } ) => {
		const state = createAllowanceState();

		expect( handleReadyParticipant( state, event ) ).toEqual( {
			state,
			decisions: [],
			facts: [],
		} );
	} );

	it.each( [
		{
			label: 'stale allowance',
			event: createReadyReconciliation(
				createFreshObservation( 'participant-a', 'page-a', null ),
				{ allowanceId: 'allowance-stale' },
			),
		},
		{
			label: 'stale participant',
			event: createReadyReconciliation(
				createFreshObservation( 'participant-stale', 'page-a', null ),
			),
		},
		{
			label: 'stale page',
			event: createReadyReconciliation(
				createFreshObservation( 'participant-a', 'page-stale', null ),
			),
		},
		{
			label: 'non-null destination',
			event: createReadyReconciliation(),
		},
	] )( 'ignores expiry-origin reconciliation with $label', ( { event } ) => {
		const state = {
			...createAllowanceState(),
			readyParticipants: [ createAllowanceExpiryParticipant() ],
		};

		expect( handleReadyParticipant( state, event ) ).toEqual( {
			state,
			decisions: [],
			facts: [],
		} );
	} );

	it( 'dismisses an expiry-origin participant after explicit continuation', () => {
		const state = {
			...createAllowanceState(),
			readyParticipants: [ createAllowanceExpiryParticipant() ],
		};
		const event = createReadyContinuation(
			createFreshObservation( 'participant-a', 'page-a', null ),
		);

		expect( handleReadyParticipant( state, event ) ).toEqual( {
			state: { ...state, readyParticipants: [] },
			decisions: [ {
				type: ProtectionDecisionType.DISMISS_INTERRUPTION,
				participantId: 'participant-a',
				pageId: 'page-a',
			} ],
			facts: [],
		} );
	} );

	it.each( [
		{
			label: 'stale allowance',
			event: createReadyContinuation(
				createFreshObservation( 'participant-a', 'page-a', null ),
				{ allowanceId: 'allowance-stale' },
			),
		},
		{
			label: 'stale participant',
			event: createReadyContinuation(
				createFreshObservation( 'participant-stale', 'page-a', null ),
			),
		},
		{
			label: 'stale page',
			event: createReadyContinuation(
				createFreshObservation( 'participant-a', 'page-stale', null ),
			),
		},
		{
			label: 'non-null destination',
			event: createReadyContinuation(),
		},
	] )( 'ignores expiry-origin continuation with $label', ( { event } ) => {
		const state = {
			...createAllowanceState(),
			readyParticipants: [ createAllowanceExpiryParticipant() ],
		};

		expect( handleReadyParticipant( state, event ) ).toEqual( {
			state,
			decisions: [],
			facts: [],
		} );
	} );

	it.each( [
		{
			match: { status: ProtectedUrlMatchStatus.UNPROTECTED },
			schedule: { status: ScheduleEvaluationStatus.ACTIVE },
		},
		{
			match: { status: ProtectedUrlMatchStatus.UNSUPPORTED, reason: 'unsupported-scheme' },
			schedule: { status: ScheduleEvaluationStatus.ACTIVE },
		},
		{
			match: {
				status: ProtectedUrlMatchStatus.PROTECTED,
				rule: { host: 'example.com', includeSubdomains: true, scopeId: 'scope-independent' },
			},
			schedule: { status: ScheduleEvaluationStatus.ACTIVE },
		},
		{
			match: {
				status: ProtectedUrlMatchStatus.PROTECTED,
				rule: { host: 'example.com', includeSubdomains: true, scopeId: 'scope-default' },
			},
			schedule: { status: ScheduleEvaluationStatus.INACTIVE },
		},
		{
			match: {
				status: ProtectedUrlMatchStatus.PROTECTED,
				rule: { host: 'example.com', includeSubdomains: true, scopeId: 'scope-default' },
			},
			schedule: { status: ScheduleEvaluationStatus.ERROR, reason: 'invalid-time-zone' },
		},
	] )( 'honors explicit continuation regardless of the fresh protection or schedule observation', ( {
		match,
		schedule,
	} ) => {
		const state = createAllowanceState();
		const event = createReadyContinuation( createFreshObservation(
			'participant-a',
			'page-a',
			'https://example.com/page-a',
			{ match, schedule },
		) );

		expect( handleReadyParticipant( state, event ).decisions ).toEqual( [ {
			type: ProtectionDecisionType.RELEASE_NAVIGATION,
			participantId: 'participant-a',
			pageId: 'page-a',
			retainedDestination: 'https://example.com/page-a',
		} ] );
	} );

	it.each( [
		{
			match: { status: ProtectedUrlMatchStatus.UNPROTECTED },
			schedule: { status: ScheduleEvaluationStatus.ACTIVE },
		},
		{
			match: { status: ProtectedUrlMatchStatus.UNSUPPORTED, reason: 'unsupported-scheme' },
			schedule: { status: ScheduleEvaluationStatus.ACTIVE },
		},
		{
			match: {
				status: ProtectedUrlMatchStatus.PROTECTED,
				rule: { host: 'example.com', includeSubdomains: true, scopeId: 'scope-independent' },
			},
			schedule: { status: ScheduleEvaluationStatus.ACTIVE },
		},
		{
			match: {
				status: ProtectedUrlMatchStatus.PROTECTED,
				rule: { host: 'example.com', includeSubdomains: true, scopeId: 'scope-default' },
			},
			schedule: { status: ScheduleEvaluationStatus.INACTIVE },
		},
		{
			match: {
				status: ProtectedUrlMatchStatus.PROTECTED,
				rule: { host: 'example.com', includeSubdomains: true, scopeId: 'scope-default' },
			},
			schedule: { status: ScheduleEvaluationStatus.ERROR, reason: 'invalid-time-zone' },
		},
	] )( 'honors explicit continuation for an expiry-origin participant regardless of fresh eligibility', ( {
		match,
		schedule,
	} ) => {
		const state = {
			...createAllowanceState(),
			readyParticipants: [ createAllowanceExpiryParticipant() ],
		};
		const event = createReadyContinuation( createFreshObservation(
			'participant-a',
			'page-a',
			null,
			{ match, schedule },
		) );

		expect( handleReadyParticipant( state, event ) ).toEqual( {
			state: { ...state, readyParticipants: [] },
			decisions: [ {
				type: ProtectionDecisionType.DISMISS_INTERRUPTION,
				participantId: 'participant-a',
				pageId: 'page-a',
			} ],
			facts: [],
		} );
	} );

	it.each( [ 0, 1 ] )( 'keeps navigation and expiry-origin continuation under expiry ownership at +%i milliseconds', ( offset ) => {
		const navigationState = createAllowanceState();
		const expiryState = {
			...createAllowanceState(),
			readyParticipants: [ createAllowanceExpiryParticipant() ],
		};
		const nowEpochMilliseconds = navigationState.expiresAtEpochMilliseconds + offset;

		expect( handleReadyParticipant(
			navigationState,
			createReadyContinuation( undefined, { nowEpochMilliseconds } ),
		) ).toEqual( { state: navigationState, decisions: [], facts: [] } );
		expect( handleReadyParticipant(
			expiryState,
			createReadyContinuation(
				createFreshObservation( 'participant-a', 'page-a', null ),
				{ nowEpochMilliseconds },
			),
		) ).toEqual( { state: expiryState, decisions: [], facts: [] } );
	} );

	it( 're-presents Ready only for an active protected same-scope reconciliation', () => {
		const state = createAllowanceState();

		expect( handleReadyParticipant( state, createReadyReconciliation() ) ).toEqual( {
			state,
			decisions: [ {
				type: ProtectionDecisionType.PRESENT_READY,
				participantId: 'participant-a',
				pageId: 'page-a',
				allowanceId: 'allowance-a',
			} ],
			facts: [],
		} );
	} );

	it.each( [
		{
			match: { status: ProtectedUrlMatchStatus.UNPROTECTED },
			schedule: { status: ScheduleEvaluationStatus.ACTIVE },
		},
		{
			match: { status: ProtectedUrlMatchStatus.UNSUPPORTED, reason: 'browser-controlled-scheme' },
			schedule: { status: ScheduleEvaluationStatus.ACTIVE },
		},
		{
			match: {
				status: ProtectedUrlMatchStatus.PROTECTED,
				rule: { host: 'example.com', includeSubdomains: true, scopeId: 'scope-independent' },
			},
			schedule: { status: ScheduleEvaluationStatus.ACTIVE },
		},
		{
			match: {
				status: ProtectedUrlMatchStatus.PROTECTED,
				rule: { host: 'example.com', includeSubdomains: true, scopeId: 'scope-default' },
			},
			schedule: { status: ScheduleEvaluationStatus.INACTIVE },
		},
		{
			match: {
				status: ProtectedUrlMatchStatus.PROTECTED,
				rule: { host: 'example.com', includeSubdomains: true, scopeId: 'scope-default' },
			},
			schedule: { status: ScheduleEvaluationStatus.ERROR, reason: 'invalid-time-zone' },
		},
	] )( 'fails open reconciliation when protection is no longer active', ( { match, schedule } ) => {
		const state = createAllowanceState();
		const event = createReadyReconciliation( createFreshObservation(
			'participant-a',
			'page-a',
			'https://example.com/page-a',
			{ match, schedule },
		) );

		expect( handleReadyParticipant( state, event ) ).toEqual( {
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
		{ label: 'Idle state', state: createIdleState() },
		{ label: 'wrong scope', overrides: { scopeId: 'scope-independent' } },
		{ label: 'wrong allowance', overrides: { allowanceId: 'allowance-stale' } },
		{ label: 'expired allowance', overrides: { nowEpochMilliseconds: TestInstant + 300_000 } },
		{ label: 'wrong participant', observation: createFreshObservation( 'participant-stale' ) },
		{ label: 'wrong page', observation: createFreshObservation( 'participant-a', 'page-stale' ) },
		{
			label: 'wrong destination',
			observation: createFreshObservation(
				'participant-a',
				'page-a',
				'https://example.com/other',
			),
		},
	] )( 'returns an unchanged result for $label', ( { state, overrides, observation } ) => {
		const currentState: ProtectionState = state === undefined
			? createAllowanceState()
			: state;
		const event = createReadyContinuation( observation, overrides );

		expect( handleReadyParticipant( currentState, event ) ).toEqual( {
			state: currentState,
			decisions: [],
			facts: [],
		} );
	} );

	it( 'requires a null observed destination for an expiry-origin action', () => {
		const state = {
			...createAllowanceState(),
			readyParticipants: [ createAllowanceExpiryParticipant() ],
		};

		expect( handleReadyParticipant( state, createReadyReconciliation() ) ).toEqual( {
			state,
			decisions: [],
			facts: [],
		} );
	} );

	it( 'does not mutate deeply frozen Ready inputs', () => {
		const state = freezeDeeply( {
			...createAllowanceState(),
			readyParticipants: [ createAllowanceExpiryParticipant() ],
		} );
		const event = freezeDeeply( createReadyContinuation(
			createFreshObservation( 'participant-a', 'page-a', null ),
		) );

		expect( () => handleReadyParticipant( state, event ) ).not.toThrow();
		expect( Object.isFrozen( state.readyParticipants[ 0 ] ) ).toBe( true );
		expect( Object.isFrozen( event.observation.match ) ).toBe( true );
	} );
} );
