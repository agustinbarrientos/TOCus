import { describe, expect, it } from 'vitest';
import { createReadyContinuation } from '../../types/__fixtures__/protection-event';
import { createReadyState } from '../../types/__fixtures__/protection-state';
import { ProtectionDecisionSchema, ProtectionDecisionType } from '../../types/protection-decision';
import { ProtectionParticipantOrigin } from '../../types/protection-participant';
import { CanonicalHostSchema } from '../../types/protected-site-rule';
import { MaximumStoredProtectionStatisticsDeliveryBatchCount, StoredProtectionStatisticsDeliverySchema,
	StoredProtectionStatisticsDeliveryStatus } from '../../types/stored-protection-statistics-delivery';
import { prepareProtectionContinuation } from './index';

/**
 * Creates a completed pause whose original participant has configured-site attribution.
 * @return Completed pause retaining its configured-site navigation participant.
 */
function createAttributedReadyState() {
	const state = createReadyState();
	state.readyParticipants = state.readyParticipants.map( ( participant ) =>
		participant.origin === ProtectionParticipantOrigin.NAVIGATION
			? { ...participant, siteHost: CanonicalHostSchema.parse( 'example.com' ) } : participant );
	return state;
}

const RELEASE = ProtectionDecisionSchema.parse( {
	type: ProtectionDecisionType.RELEASE_NAVIGATION, participantId: 'participant-a', pageId: 'page-a',
	retainedDestination: 'https://example.com/page-a',
} );
const RECEIPT = { scopeId: 'scope-default', allowanceId: 'allowance-a', participantId: 'participant-a', pageId: 'page-a',
	siteHost: 'example.com', measurementRevision: 'revision-1' };

describe( 'prepareProtectionContinuation', () => {
	it( 'does not duplicate durable work when the same participant release is prepared again', () => {
		const delivery = StoredProtectionStatisticsDeliverySchema.parse( {
			status: 'complete', outbox: [], pendingContinuations: [ RECEIPT ],
		} );
		expect( prepareProtectionContinuation( delivery, createAttributedReadyState(), createReadyContinuation(), [ RELEASE ], 'revision-1' ) ).toBe( delivery );
	} );

	it( 'preserves other exact identities instead of treating shared allowances as duplicate visits', () => {
		const delivery = StoredProtectionStatisticsDeliverySchema.parse( {
			status: 'complete', outbox: [], pendingContinuations: [
				{ ...RECEIPT, scopeId: 'other-scope' }, { ...RECEIPT, allowanceId: 'other-allowance' },
				{ ...RECEIPT, participantId: 'other-participant' }, { ...RECEIPT, pageId: 'other-page' },
			],
		} );
		const result = prepareProtectionContinuation( delivery, createAttributedReadyState(), createReadyContinuation(), [ RELEASE ], 'revision-1' );
		expect( result.pendingContinuations ).toEqual( [ ...delivery.pendingContinuations ?? [], RECEIPT ] );
	} );

	it( 'bounds unacknowledged work and marks delivery incomplete instead of inventing acceptance', () => {
		const delivery = StoredProtectionStatisticsDeliverySchema.parse( {
			status: 'complete', outbox: [], pendingContinuations: Array.from(
				{ length: MaximumStoredProtectionStatisticsDeliveryBatchCount }, ( _, index ) =>
					( { ...RECEIPT, participantId: `pending-${ String( index ) }` } ) ),
		} );
		const result = prepareProtectionContinuation( delivery, createAttributedReadyState(), createReadyContinuation(), [ RELEASE ], 'revision-1' );
		expect( result ).toEqual( { ...delivery, status: StoredProtectionStatisticsDeliveryStatus.INCOMPLETE } );
	} );
} );
