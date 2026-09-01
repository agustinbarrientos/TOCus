import { describe, expect, it } from 'vitest';
import {
	ProtectionParticipantOrigin,
	ProtectionParticipantSchema,
} from '../../types/protection-participant';
import { selectOwner } from './index';

describe( 'protection participants', () => {
	it( 'selects the eligible participant with the lowest join sequence and lexical identifier', () => {
		const participants = ProtectionParticipantSchema.array().parse( [
			{
				origin: ProtectionParticipantOrigin.NAVIGATION,
				participantId: 'participant-c',
				pageId: 'page-c',
				retainedDestination: 'https://example.com/c',
				focusEligible: true,
				joinSequence: 0,
			},
			{
				origin: ProtectionParticipantOrigin.NAVIGATION,
				participantId: 'participant-a',
				pageId: 'page-a',
				retainedDestination: 'https://example.com/a',
				focusEligible: true,
				joinSequence: 0,
			},
			{
				origin: ProtectionParticipantOrigin.ALLOWANCE_EXPIRY,
				participantId: 'participant-b',
				pageId: 'page-b',
				retainedDestination: null,
				focusEligible: false,
				joinSequence: 0,
			},
		] );

		expect( selectOwner( Object.freeze( participants ) )?.participantId ).toBe( 'participant-a' );
	} );

	it( 'returns no owner when every participant is ineligible', () => {
		const participants = ProtectionParticipantSchema.array().parse( [ {
			origin: ProtectionParticipantOrigin.ALLOWANCE_EXPIRY,
			participantId: 'participant-a',
			pageId: 'page-a',
			retainedDestination: null,
			focusEligible: false,
			joinSequence: 0,
		} ] );

		expect( selectOwner( participants ) ).toBeNull();
	} );
} );
