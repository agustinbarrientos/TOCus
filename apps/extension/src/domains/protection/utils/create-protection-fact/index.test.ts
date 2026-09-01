import { describe, expect, it } from 'vitest';
import {
	createAllowanceGrantedFact,
	createCompletedWaitFact,
	createPauseTimeFact,
	createReconsideredVisitFact,
} from './index';
import { DepartureCause } from '../../types/protection-event';
import { ProtectionFactType } from '../../types/protection-fact';

describe( 'protection facts', () => {
	it.each( [
		[ 'owner epoch', { ownerEpoch: 0 } ],
		[ 'checkpoint high-water', { checkpointHighWaterMilliseconds: 0 } ],
		[ 'accepted duration above checkpoint high-water', { acceptedDurationMilliseconds: 2_001 } ],
	] )( 'rejects an invalid pause-time %s', ( _label, override ) => {
		expect( () => createPauseTimeFact( {
			scopeId: 'scope-a',
			waitId: 'wait-a',
			ownerParticipantId: 'participant-a',
			ownerEpoch: 1,
			checkpointHighWaterMilliseconds: 2_000,
			acceptedDurationMilliseconds: 2_000,
			observedAtEpochMilliseconds: 1_800_000_000_000,
			...override,
		} ) ).toThrow();
	} );

	it.each( [
		[
			'expiry at the start instant',
			{
				expiresAtEpochMilliseconds: 1_800_000_000_000,
				allowanceDurationMilliseconds: 300_000,
			},
		],
		[
			'duration that differs from the allowance interval',
			{
				expiresAtEpochMilliseconds: 1_800_000_300_000,
				allowanceDurationMilliseconds: 240_000,
			},
		],
		[
			'an interval shorter than one minute',
			{
				expiresAtEpochMilliseconds: 1_800_000_059_999,
				allowanceDurationMilliseconds: 59_999,
			},
		],
		[
			'an interval off the whole-minute grid',
			{
				expiresAtEpochMilliseconds: 1_800_000_060_001,
				allowanceDurationMilliseconds: 60_001,
			},
		],
		[
			'an interval longer than sixty minutes',
			{
				expiresAtEpochMilliseconds: 1_800_003_600_001,
				allowanceDurationMilliseconds: 3_600_001,
			},
		],
	] )( 'rejects an allowance-granted fact with %s', ( _label, override ) => {
		expect( () => createAllowanceGrantedFact( {
			scopeId: 'scope-a',
			allowanceId: 'allowance-a',
			startedAtEpochMilliseconds: 1_800_000_000_000,
			...override,
		} ) ).toThrow();
	} );

	it.each( [ 60_000, 3_600_000 ] )(
		'creates an allowance-granted fact at the inclusive %i millisecond boundary',
		( allowanceDurationMilliseconds ) => {
			const startedAtEpochMilliseconds = 1_800_000_000_000;
			const fact = createAllowanceGrantedFact( {
				scopeId: 'scope-a',
				allowanceId: 'allowance-a',
				startedAtEpochMilliseconds,
				expiresAtEpochMilliseconds:
					startedAtEpochMilliseconds + allowanceDurationMilliseconds,
				allowanceDurationMilliseconds,
			} );

			expect( fact.allowanceDurationMilliseconds ).toBe( allowanceDurationMilliseconds );
		},
	);

	it( 'uses length-prefixed identity components that cannot collide at underscores', () => {
		const firstInput = {
			scopeId: 'scope-a',
			waitId: 'wait_a',
			participantId: 'participant',
			departureCause: DepartureCause.BACK,
			observedAtEpochMilliseconds: 1_800_000_000_000,
		};
		const secondInput = {
			scopeId: 'scope-a',
			waitId: 'wait',
			participantId: 'a_participant',
			departureCause: DepartureCause.BACK,
			observedAtEpochMilliseconds: 1_800_000_000_000,
		};
		const first = createReconsideredVisitFact( firstInput );
		const second = createReconsideredVisitFact( secondInput );

		expect( first.factId ).toBe( 'reconsidered-visit_7-scope-a_6-wait_a_11-participant' );
		expect( second.factId ).toBe( 'reconsidered-visit_7-scope-a_4-wait_13-a_participant' );
		expect( first.factId ).not.toBe( second.factId );
		expect( createReconsideredVisitFact( firstInput ).factId ).toBe( first.factId );
		expect( first.type ).toBe( ProtectionFactType.RECONSIDERED_VISIT );
	} );

	it( 'distinguishes otherwise identical fact identities across protection scopes', () => {
		const pauseInput = {
			scopeId: 'scope-a',
			waitId: 'wait-a',
			ownerParticipantId: 'participant-a',
			ownerEpoch: 1,
			checkpointHighWaterMilliseconds: 2_000,
			acceptedDurationMilliseconds: 2_000,
			observedAtEpochMilliseconds: 1_800_000_000_000,
		};
		const reconsideredInput = {
			scopeId: 'scope-a',
			waitId: 'wait-a',
			participantId: 'participant-a',
			departureCause: DepartureCause.BACK,
			observedAtEpochMilliseconds: 1_800_000_000_000,
		};
		const completedInput = {
			scopeId: 'scope-a',
			waitId: 'wait-a',
			capturedWaitDurationMilliseconds: 10_000,
			completedAtEpochMilliseconds: 1_800_000_010_000,
			completionLocalDate: '2026-08-31',
		};
		const allowanceInput = {
			scopeId: 'scope-a',
			allowanceId: 'allowance-a',
			startedAtEpochMilliseconds: 1_800_000_010_000,
			expiresAtEpochMilliseconds: 1_800_000_310_000,
			allowanceDurationMilliseconds: 300_000,
		};

		expect( createPauseTimeFact( pauseInput ).factId ).not.toBe(
			createPauseTimeFact( { ...pauseInput, scopeId: 'scope-b' } ).factId,
		);
		expect( createReconsideredVisitFact( reconsideredInput ).factId ).not.toBe(
			createReconsideredVisitFact( { ...reconsideredInput, scopeId: 'scope-b' } ).factId,
		);
		expect( createCompletedWaitFact( completedInput ).factId ).not.toBe(
			createCompletedWaitFact( { ...completedInput, scopeId: 'scope-b' } ).factId,
		);
		expect( createAllowanceGrantedFact( allowanceInput ).factId ).not.toBe(
			createAllowanceGrantedFact( { ...allowanceInput, scopeId: 'scope-b' } ).factId,
		);
	} );

	it( 'derives exact stable identifiers from pause, completion, and allowance keys', () => {
		const pauseInput = {
			scopeId: 'scope-a',
			waitId: 'wait_a',
			ownerParticipantId: 'participant-a',
			ownerEpoch: 12,
			checkpointHighWaterMilliseconds: 2_000,
			acceptedDurationMilliseconds: 2_000,
			observedAtEpochMilliseconds: 1_800_000_000_000,
		};
		const completedInput = {
			scopeId: 'scope-a',
			waitId: 'wait_a',
			capturedWaitDurationMilliseconds: 10_000,
			completedAtEpochMilliseconds: 1_800_000_010_000,
			completionLocalDate: '2026-08-31',
		};
		const allowanceInput = {
			scopeId: 'scope-a',
			allowanceId: 'allowance_a',
			startedAtEpochMilliseconds: 1_800_000_010_000,
			expiresAtEpochMilliseconds: 1_800_000_310_000,
			allowanceDurationMilliseconds: 300_000,
		};
		const pauseFact = createPauseTimeFact( pauseInput );
		const completedFact = createCompletedWaitFact( completedInput );
		const allowanceFact = createAllowanceGrantedFact( allowanceInput );

		expect( pauseFact.factId ).toBe( 'pause-time_7-scope-a_6-wait_a_2-12_4-2000' );
		expect( completedFact.factId ).toBe( 'completed-wait_7-scope-a_6-wait_a' );
		expect( allowanceFact.factId ).toBe( 'allowance-granted_7-scope-a_11-allowance_a' );
		expect( createPauseTimeFact( pauseInput ).factId ).toBe( pauseFact.factId );
		expect( createCompletedWaitFact( completedInput ).factId ).toBe( completedFact.factId );
		expect( createAllowanceGrantedFact( allowanceInput ).factId ).toBe( allowanceFact.factId );
	} );
} );
