import { describe, expect, it } from 'vitest';
import {
	createAllowanceExpiry,
	createLiveExpiryCandidate,
	createReadyExpiryCandidate,
} from '../../types/__fixtures__/protection-event';
import {
	createNavigationParticipant,
} from '../../types/__fixtures__/protection-state';
import { ProtectedUrlMatchStatus } from '../../types/protected-url-match';
import { canonicalizeAllowanceExpiryCandidates } from './index';

describe( 'allowance-expiry candidate canonicalization', () => {
	it( 'partitions one complete Ready observation and one live observation by source', () => {
		const readyCandidate = createReadyExpiryCandidate();
		const liveCandidate = createLiveExpiryCandidate();

		expect( canonicalizeAllowanceExpiryCandidates(
			[ createNavigationParticipant() ],
			createAllowanceExpiry( [ liveCandidate, readyCandidate ] ),
		) ).toEqual( {
			readyCandidates: [ readyCandidate ],
			liveCandidates: [ liveCandidate ],
		} );
	} );

	it( 'accepts an empty batch when no Ready participant requires an observation', () => {
		expect( canonicalizeAllowanceExpiryCandidates( [], createAllowanceExpiry( [] ) ) ).toEqual( {
			readyCandidates: [],
			liveCandidates: [],
		} );
	} );

	it( 'rejects a batch missing an observation for a current Ready participant', () => {
		expect( canonicalizeAllowanceExpiryCandidates(
			[ createNavigationParticipant() ],
			createAllowanceExpiry( [] ),
		) ).toBeNull();
	} );

	it.each( [
		createReadyExpiryCandidate( 'participant-a', 'page-stale' ),
		createReadyExpiryCandidate( 'participant-stale', 'page-a' ),
	] )( 'rejects a Ready observation when exactly one identity is current', ( candidate ) => {
		expect( canonicalizeAllowanceExpiryCandidates(
			[ createNavigationParticipant() ],
			createAllowanceExpiry( [ candidate ] ),
		) ).toBeNull();
	} );

	it( 'ignores a Ready observation when both identities are stale', () => {
		const currentCandidate = createReadyExpiryCandidate();
		const staleCandidate = createReadyExpiryCandidate( 'participant-stale', 'page-stale' );

		expect( canonicalizeAllowanceExpiryCandidates(
			[ createNavigationParticipant() ],
			createAllowanceExpiry( [ staleCandidate, currentCandidate ] ),
		) ).toEqual( {
			readyCandidates: [ currentCandidate ],
			liveCandidates: [],
		} );
	} );

	it( 'rejects a Ready observation that crosses two current identities', () => {
		expect( canonicalizeAllowanceExpiryCandidates(
			[
				createNavigationParticipant(),
				createNavigationParticipant( 'participant-b', 'page-b' ),
			],
			createAllowanceExpiry( [
				createReadyExpiryCandidate( 'participant-a', 'page-b' ),
			] ),
		) ).toBeNull();
	} );

	it.each( [
		{
			label: 'destination difference',
			conflictingCandidate: createReadyExpiryCandidate(
				'participant-a',
				'page-a',
				'https://example.com/other',
			),
		},
		{
			label: 'focus difference',
			conflictingCandidate: createReadyExpiryCandidate(
				'participant-a',
				'page-a',
				'https://example.com/page-a',
				false,
			),
		},
		{
			label: 'status difference',
			conflictingCandidate: createReadyExpiryCandidate(
				'participant-a',
				'page-a',
				'https://example.com/page-a',
				true,
				{ status: ProtectedUrlMatchStatus.UNPROTECTED },
			),
		},
		{
			label: 'unsupported reason difference',
			candidate: createReadyExpiryCandidate(
				'participant-a',
				'page-a',
				'https://example.com/page-a',
				true,
				{ status: ProtectedUrlMatchStatus.UNSUPPORTED, reason: 'unsupported-scheme' },
			),
			conflictingCandidate: createReadyExpiryCandidate(
				'participant-a',
				'page-a',
				'https://example.com/page-a',
				true,
				{ status: ProtectedUrlMatchStatus.UNSUPPORTED, reason: 'browser-controlled-scheme' },
			),
		},
		{
			label: 'protected host difference',
			conflictingCandidate: createReadyExpiryCandidate(
				'participant-a',
				'page-a',
				'https://example.com/page-a',
				true,
				{
					status: ProtectedUrlMatchStatus.PROTECTED,
					rule: {
						host: 'other.example.com',
						includeSubdomains: true,
						scopeId: 'scope-default',
					},
				},
			),
		},
		{
			label: 'protected subdomain policy difference',
			conflictingCandidate: createReadyExpiryCandidate(
				'participant-a',
				'page-a',
				'https://example.com/page-a',
				true,
				{
					status: ProtectedUrlMatchStatus.PROTECTED,
					rule: {
						host: 'example.com',
						includeSubdomains: false,
						scopeId: 'scope-default',
					},
				},
			),
		},
		{
			label: 'protected scope difference',
			conflictingCandidate: createReadyExpiryCandidate(
				'participant-a',
				'page-a',
				'https://example.com/page-a',
				true,
				{
					status: ProtectedUrlMatchStatus.PROTECTED,
					rule: {
						host: 'example.com',
						includeSubdomains: true,
						scopeId: 'scope-independent',
					},
				},
			),
		},
	] )( 'rejects duplicate Ready observations with a $label', ( {
		candidate = createReadyExpiryCandidate(),
		conflictingCandidate,
	} ) => {
		expect( canonicalizeAllowanceExpiryCandidates(
			[ createNavigationParticipant() ],
			createAllowanceExpiry( [ candidate, conflictingCandidate ] ),
		) ).toBeNull();
	} );

	it.each( [
		{
			label: 'protected',
			candidate: createReadyExpiryCandidate(),
		},
		{
			label: 'unprotected',
			candidate: createReadyExpiryCandidate(
				'participant-a',
				'page-a',
				'https://example.com/page-a',
				true,
				{ status: ProtectedUrlMatchStatus.UNPROTECTED },
			),
		},
		{
			label: 'unsupported',
			candidate: createReadyExpiryCandidate(
				'participant-a',
				'page-a',
				'https://example.com/page-a',
				true,
				{ status: ProtectedUrlMatchStatus.UNSUPPORTED, reason: 'unsupported-scheme' },
			),
		},
	] )( 'deduplicates fully equal $label Ready observations', ( { candidate } ) => {
		expect( canonicalizeAllowanceExpiryCandidates(
			[ createNavigationParticipant() ],
			createAllowanceExpiry( [ candidate, { ...candidate } ] ),
		) ).toEqual( {
			readyCandidates: [ candidate ],
			liveCandidates: [],
		} );
	} );

	it( 'rejects a live observation that reassigns a current Ready participant to another page', () => {
		expect( canonicalizeAllowanceExpiryCandidates(
			[ createNavigationParticipant() ],
			createAllowanceExpiry( [
				createReadyExpiryCandidate(),
				createLiveExpiryCandidate( 'participant-a', 'page-live' ),
			] ),
		) ).toBeNull();
	} );

	it.each( [
		{
			label: 'participant',
			candidates: [
				createLiveExpiryCandidate( 'participant-live', 'page-a' ),
				createLiveExpiryCandidate( 'participant-live', 'page-b' ),
			],
		},
		{
			label: 'page',
			candidates: [
				createLiveExpiryCandidate( 'participant-a', 'page-live' ),
				createLiveExpiryCandidate( 'participant-b', 'page-live' ),
			],
		},
	] )( 'rejects $label reassignment within the live batch', ( { candidates } ) => {
		expect( canonicalizeAllowanceExpiryCandidates(
			[],
			createAllowanceExpiry( candidates ),
		) ).toBeNull();
	} );

	it( 'rejects conflicting duplicate live observations for one identity', () => {
		const candidate = createLiveExpiryCandidate();

		expect( canonicalizeAllowanceExpiryCandidates(
			[],
			createAllowanceExpiry( [ candidate, { ...candidate, focusEligible: false } ] ),
		) ).toBeNull();
	} );

	it( 'deduplicates fully equal live observations', () => {
		const candidate = createLiveExpiryCandidate();

		expect( canonicalizeAllowanceExpiryCandidates(
			[],
			createAllowanceExpiry( [ candidate, { ...candidate } ] ),
		) ).toEqual( {
			readyCandidates: [],
			liveCandidates: [ candidate ],
		} );
	} );

	it.each( [
		{
			label: 'destination difference',
			liveCandidate: createLiveExpiryCandidate(
				'participant-a',
				'page-a',
				'https://example.com/other',
			),
		},
		{
			label: 'focus difference',
			liveCandidate: createLiveExpiryCandidate(
				'participant-a',
				'page-a',
				'https://example.com/page-a',
				false,
			),
		},
		{
			label: 'match difference',
			liveCandidate: createLiveExpiryCandidate(
				'participant-a',
				'page-a',
				'https://example.com/page-a',
				true,
				{ status: ProtectedUrlMatchStatus.UNPROTECTED },
			),
		},
	] )( 'rejects cross-source observations with a $label', ( { liveCandidate } ) => {
		expect( canonicalizeAllowanceExpiryCandidates(
			[ createNavigationParticipant() ],
			createAllowanceExpiry( [ createReadyExpiryCandidate(), liveCandidate ] ),
		) ).toBeNull();
	} );

	it( 'retains fully equal cross-source observations in their source partitions', () => {
		const readyCandidate = createReadyExpiryCandidate();
		const liveCandidate = createLiveExpiryCandidate(
			'participant-a',
			'page-a',
			'https://example.com/page-a',
		);

		expect( canonicalizeAllowanceExpiryCandidates(
			[ createNavigationParticipant() ],
			createAllowanceExpiry( [ readyCandidate, liveCandidate ] ),
		) ).toEqual( {
			readyCandidates: [ readyCandidate ],
			liveCandidates: [ liveCandidate ],
		} );
	} );
} );
