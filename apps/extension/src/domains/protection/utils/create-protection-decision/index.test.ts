import { describe, expect, it } from 'vitest';
import {
	ProtectionParticipantOrigin,
	ProtectionParticipantSchema,
} from '../../types/protection-participant';
import {
	createFailOpenDecision,
	createObservedParticipantActionDecision,
} from './index';
import {
	ProtectionDecisionSchema,
	ProtectionDecisionType,
} from '../../types/protection-decision';

describe( 'protection decisions', () => {
	it( 'rejects a navigation-release decision without a retained destination', () => {
		expect( () => ProtectionDecisionSchema.parse( {
			type: ProtectionDecisionType.RELEASE_NAVIGATION,
			participantId: 'participant-a',
			pageId: 'page-a',
			retainedDestination: null,
		} ) ).toThrow();
	} );

	it( 'fails open by releasing navigation participants and dismissing expiry participants', () => {
		const navigationParticipant = ProtectionParticipantSchema.parse( {
			origin: ProtectionParticipantOrigin.NAVIGATION,
			participantId: 'participant-a',
			pageId: 'page-a',
			retainedDestination: 'https://example.com/a',
			focusEligible: true,
			joinSequence: 0,
		} );
		const expiryParticipant = ProtectionParticipantSchema.parse( {
			origin: ProtectionParticipantOrigin.ALLOWANCE_EXPIRY,
			participantId: 'participant-b',
			pageId: 'page-b',
			retainedDestination: null,
			focusEligible: false,
			joinSequence: 1,
		} );

		expect( createFailOpenDecision( navigationParticipant ) ).toStrictEqual( {
			type: ProtectionDecisionType.RELEASE_NAVIGATION,
			participantId: 'participant-a',
			pageId: 'page-a',
			retainedDestination: 'https://example.com/a',
		} );
		expect( createFailOpenDecision( expiryParticipant ) ).toStrictEqual( {
			type: ProtectionDecisionType.DISMISS_INTERRUPTION,
			participantId: 'participant-b',
			pageId: 'page-b',
		} );
	} );

	it( 'acts on a participant only when its fresh destination matches its origin contract', () => {
		const participant = ProtectionParticipantSchema.parse( {
			origin: ProtectionParticipantOrigin.NAVIGATION,
			participantId: 'participant-a',
			pageId: 'page-a',
			retainedDestination: 'https://example.com/a',
			focusEligible: true,
			joinSequence: 0,
		} );

		expect( createObservedParticipantActionDecision(
			participant,
			'https://example.com/changed',
		) ).toBeNull();
		expect( createObservedParticipantActionDecision(
			participant,
			participant.retainedDestination,
		) ).toStrictEqual( createFailOpenDecision( participant ) );
	} );

	it( 'acts on an allowance-expiry participant only when the observed destination remains null', () => {
		const participant = ProtectionParticipantSchema.parse( {
			origin: ProtectionParticipantOrigin.ALLOWANCE_EXPIRY,
			participantId: 'participant-a',
			pageId: 'page-a',
			retainedDestination: null,
			focusEligible: true,
			joinSequence: 0,
		} );

		expect( createObservedParticipantActionDecision(
			participant,
			null,
		) ).toStrictEqual( {
			type: ProtectionDecisionType.DISMISS_INTERRUPTION,
			participantId: 'participant-a',
			pageId: 'page-a',
		} );
		expect( createObservedParticipantActionDecision(
			participant,
			'https://example.com/unexpected',
		) ).toBeNull();
	} );
} );
