import { describe, expect, it } from 'vitest';
import { ProtectionDecisionType } from '../../types/protection-decision';
import { DepartureCause } from '../../types/protection-event';
import { ProtectionFactType } from '../../types/protection-fact';
import { ProtectionStateType } from '../../types/protection-state';
import {
	createAllowanceExpiryParticipant,
	createNavigationParticipant,
	createWaitingState,
} from '../../types/__fixtures__/protection-state';
import { createReconsideredVisitFact } from '../create-protection-fact';
import { abandonWaitingState } from './index';

describe( 'abandonWaitingState', () => {
	it( 'fails open for current participants and preserves accepted facts', () => {
		const state = createWaitingState();
		const participants = [
			createNavigationParticipant(),
			createAllowanceExpiryParticipant( 'participant-b', 'page-b' ),
		];
		const fact = createReconsideredVisitFact( {
			scopeId: state.scopeId,
			waitId: state.waitId,
			participantId: 'participant-departed',
			departureCause: DepartureCause.BACK,
			observedAtEpochMilliseconds: 1_800_000_000_000,
		} );

		expect( abandonWaitingState( state, participants, [ fact ] ) ).toEqual( {
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
			facts: [ {
				type: ProtectionFactType.RECONSIDERED_VISIT,
				factId: 'reconsidered-visit_13-scope-default_6-wait-a_20-participant-departed',
				scopeId: 'scope-default',
				waitId: 'wait-a',
				participantId: 'participant-departed',
				departureCause: DepartureCause.BACK,
				observedAtEpochMilliseconds: 1_800_000_000_000,
			} ],
		} );
	} );
} );
