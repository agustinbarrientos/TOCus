import { ZodError } from 'zod';
import { describe, expect, it } from 'vitest';
import { ProtectionDecisionType } from '../../types/protection-decision';
import {
	DepartureCause,
	ProtectionEventType,
} from '../../types/protection-event';
import {
	createAllowanceExpiry,
	createDeparture,
	createFocusChange,
	createProgressCheckpoint,
	createReadyContinuation,
	createReadyReconciliation,
	createScheduleReevaluation,
	createVisitAttempt,
} from '../../types/__fixtures__/protection-event';
import { ProtectionFactType } from '../../types/protection-fact';
import { ProtectionParticipantOrigin } from '../../types/protection-participant';
import { ProtectionStateType } from '../../types/protection-state';
import {
	createAllowanceState,
	createIdleState,
	createWaitingState,
} from '../../types/__fixtures__/protection-state';
import {
	dispatchProtectionTransition,
	transitionProtectionState,
} from './index';

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

describe( 'transitionProtectionState', () => {
	it( 'routes a visit attempt into a hand-derived Waiting result', () => {
		expect( dispatchProtectionTransition( createIdleState(), createVisitAttempt() ) ).toStrictEqual( {
			state: {
				type: ProtectionStateType.WAITING,
				scopeId: 'scope-default',
				waitId: 'wait-a',
				capturedWaitDurationMilliseconds: 10_000,
				confirmedFocusedDurationMilliseconds: 0,
				participants: [ {
					origin: ProtectionParticipantOrigin.NAVIGATION,
					participantId: 'participant-a',
					pageId: 'page-a',
					retainedDestination: 'https://example.com/page-a',
					focusEligible: true,
					statisticsEligible: true,
					joinSequence: 0,
				} ],
				ownerParticipantId: 'participant-a',
				ownerEpoch: 1,
				checkpointHighWaterMilliseconds: 0,
				completionStatisticsEligible: true,
				ladder: { completedWaits: 0, greatestObservedLocalDate: '2026-08-31' },
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

	it( 'routes a focus change into a hand-derived ownerless result', () => {
		expect( dispatchProtectionTransition( createWaitingState(), createFocusChange() ) ).toStrictEqual( {
			state: {
				type: ProtectionStateType.WAITING,
				scopeId: 'scope-default',
				waitId: 'wait-a',
				capturedWaitDurationMilliseconds: 10_000,
				confirmedFocusedDurationMilliseconds: 0,
				participants: [ {
					origin: ProtectionParticipantOrigin.NAVIGATION,
					participantId: 'participant-a',
					pageId: 'page-a',
					retainedDestination: 'https://example.com/page-a',
					focusEligible: false,
					statisticsEligible: true,
					joinSequence: 0,
				} ],
				ownerParticipantId: null,
				ownerEpoch: 2,
				checkpointHighWaterMilliseconds: 0,
				completionStatisticsEligible: true,
				ladder: { completedWaits: 0, greatestObservedLocalDate: '2026-08-31' },
			},
			decisions: [],
			facts: [],
		} );
	} );

	it( 'routes a progress checkpoint into a hand-derived progress result', () => {
		expect( dispatchProtectionTransition(
			createWaitingState(),
			createProgressCheckpoint(),
		) ).toStrictEqual( {
			state: {
				type: ProtectionStateType.WAITING,
				scopeId: 'scope-default',
				waitId: 'wait-a',
				capturedWaitDurationMilliseconds: 10_000,
				confirmedFocusedDurationMilliseconds: 2_000,
				participants: [ {
					origin: ProtectionParticipantOrigin.NAVIGATION,
					participantId: 'participant-a',
					pageId: 'page-a',
					retainedDestination: 'https://example.com/page-a',
					focusEligible: true,
					statisticsEligible: true,
					joinSequence: 0,
				} ],
				ownerParticipantId: 'participant-a',
				ownerEpoch: 1,
				checkpointHighWaterMilliseconds: 2_000,
				completionStatisticsEligible: true,
				ladder: { completedWaits: 0, greatestObservedLocalDate: '2026-08-31' },
			},
			decisions: [],
			facts: [ {
				type: ProtectionFactType.PAUSE_TIME,
				factId: 'pause-time_13-scope-default_6-wait-a_1-1_4-2000',
				scopeId: 'scope-default',
				waitId: 'wait-a',
				ownerParticipantId: 'participant-a',
				ownerEpoch: 1,
				checkpointHighWaterMilliseconds: 2_000,
				acceptedDurationMilliseconds: 2_000,
				observedAtEpochMilliseconds: 1_800_000_000_000,
			} ],
		} );
	} );

	it( 'routes a departure into a hand-derived Idle result', () => {
		expect( dispatchProtectionTransition(
			createWaitingState(),
			createDeparture( DepartureCause.BACK ),
		) ).toStrictEqual( {
			state: {
				type: ProtectionStateType.IDLE,
				scopeId: 'scope-default',
				ladder: { completedWaits: 0, greatestObservedLocalDate: '2026-08-31' },
			},
			decisions: [],
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

	it( 'routes a schedule reevaluation into a hand-derived fail-open result', () => {
		expect( dispatchProtectionTransition(
			createWaitingState(),
			createScheduleReevaluation(),
		) ).toStrictEqual( {
			state: {
				type: ProtectionStateType.IDLE,
				scopeId: 'scope-default',
				ladder: { completedWaits: 0, greatestObservedLocalDate: '2026-08-31' },
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

	it( 'routes a Ready continuation into a hand-derived release result', () => {
		expect( dispatchProtectionTransition(
			createAllowanceState(),
			createReadyContinuation(),
		) ).toStrictEqual( {
			state: {
				type: ProtectionStateType.ALLOWANCE,
				scopeId: 'scope-default',
				allowanceId: 'allowance-a',
				completedWaitId: 'wait-a',
				startedAtEpochMilliseconds: 1_800_000_000_000,
				expiresAtEpochMilliseconds: 1_800_000_300_000,
				readyParticipants: [],
				ladder: { completedWaits: 0, greatestObservedLocalDate: '2026-08-31' },
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

	it( 'routes a Ready reconciliation into a hand-derived presentation result', () => {
		expect( dispatchProtectionTransition(
			createAllowanceState(),
			createReadyReconciliation(),
		) ).toStrictEqual( {
			state: {
				type: ProtectionStateType.ALLOWANCE,
				scopeId: 'scope-default',
				allowanceId: 'allowance-a',
				completedWaitId: 'wait-a',
				startedAtEpochMilliseconds: 1_800_000_000_000,
				expiresAtEpochMilliseconds: 1_800_000_300_000,
				readyParticipants: [ {
					origin: ProtectionParticipantOrigin.NAVIGATION,
					participantId: 'participant-a',
					pageId: 'page-a',
					retainedDestination: 'https://example.com/page-a',
					focusEligible: true,
					statisticsEligible: true,
					joinSequence: 0,
				} ],
				ladder: { completedWaits: 0, greatestObservedLocalDate: '2026-08-31' },
			},
			decisions: [ {
				type: ProtectionDecisionType.PRESENT_READY,
				participantId: 'participant-a',
				pageId: 'page-a',
				allowanceId: 'allowance-a',
			} ],
			facts: [],
		} );
	} );

	it( 'routes allowance expiry into a hand-derived Waiting result', () => {
		expect( dispatchProtectionTransition(
			createAllowanceState(),
			createAllowanceExpiry(),
		) ).toStrictEqual( {
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
					focusEligible: true,
					statisticsEligible: true,
					joinSequence: 0,
				} ],
				ownerParticipantId: 'participant-a',
				ownerEpoch: 1,
				checkpointHighWaterMilliseconds: 0,
				completionStatisticsEligible: true,
				ladder: { completedWaits: 0, greatestObservedLocalDate: '2026-08-31' },
			},
			decisions: [ {
				type: ProtectionDecisionType.PRESENT_WAITING,
				participantId: 'participant-a',
				pageId: 'page-a',
				waitId: 'wait-expiry',
			} ],
			facts: [],
		} );
	} );

	it( 'validates unknown public inputs before dispatch', () => {
		expect( () => transitionProtectionState( null, createVisitAttempt() ) ).toThrow( ZodError );
		expect( () => transitionProtectionState( createIdleState(), { type: 'future-event' } ) ).toThrow( ZodError );
	} );

	it( 'returns a validated cross-scope no-op', () => {
		const state = createIdleState();
		const event = createVisitAttempt( 'participant-a', 'page-a', true, {
			scopeId: 'scope-independent',
		} );

		expect( dispatchProtectionTransition( state, event ) ).toStrictEqual( {
			state,
			decisions: [],
			facts: [],
		} );
	} );

	it( 'rejects an event that escapes the closed runtime vocabulary', () => {
		expect( () => {
			Reflect.apply( dispatchProtectionTransition, null, [
				createIdleState(),
				{ type: 'future-event', scopeId: 'scope-default' },
			] );
		} ).toThrow( 'Unhandled protection event' );
	} );

	it( 'does not mutate deeply frozen state or event inputs', () => {
		const state = freezeDeeply( createWaitingState() );
		const event = freezeDeeply( createProgressCheckpoint() );

		expect( () => transitionProtectionState( state, event ) ).not.toThrow();
		expect( Object.isFrozen( state.participants[ 0 ] ) ).toBe( true );
		expect( Object.isFrozen( event.timingConfiguration ) ).toBe( true );
	} );

	it( 'keeps a completed transaction idempotent on replay', () => {
		const completion = transitionProtectionState(
			createWaitingState(),
			createProgressCheckpoint( 10_000 ),
		);
		const replay = transitionProtectionState(
			completion.state,
			createProgressCheckpoint( 10_000 ),
		);

		expect( completion.state.type ).toBe( ProtectionStateType.ALLOWANCE );
		expect( replay ).toStrictEqual( {
			state: completion.state,
			decisions: [],
			facts: [],
		} );
	} );

	it( 'covers the closed event discriminator vocabulary', () => {
		expect( Object.values( ProtectionEventType ) ).toStrictEqual( [
			'visit-attempt',
			'participant-focus-change',
			'progress-checkpoint',
			'participant-departure',
			'schedule-reevaluation',
			'ready-continuation',
			'ready-reconciliation',
			'allowance-expiry',
		] );
	} );
} );
