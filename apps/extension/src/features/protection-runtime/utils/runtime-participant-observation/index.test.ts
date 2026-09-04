import { describe, expect, it } from 'vitest';
import { TestEmptyProtectionConfiguration } from '../../../../domains/protection/types/__fixtures__';
import { AllowanceExpiryCandidateSource } from '../../../../domains/protection/types/protection-event';
import { ProtectionStateType, type AllowanceProtectionState } from '../../../../domains/protection/types/protection-state';
import {
	AllowanceIdSchema,
	DefaultProtectionScopeId,
	LocalDateSchema,
	PageIdSchema,
	ParticipantIdSchema,
	ProtectionScopeIdSchema,
} from '../../../../domains/protection/types/protection-value';
import {
	createFreshRuntimeObservation,
	createReadyRuntimeExpiryCandidates,
} from './index';

/**
 * Protected-site configuration used by runtime-observation fixtures.
 * @since 0.1.0 Initial implementation.
 */
const CONFIGURATION = {
	...TestEmptyProtectionConfiguration,
	sites: [ {
		identityHost: 'example.com',
		rule: {
			host: 'example.com',
			includeSubdomains: true,
			scopeId: DefaultProtectionScopeId,
		},
	} ],
};

/**
 * Navigation participant used by runtime-observation fixtures.
 * @since 0.1.0 Initial implementation.
 */
const PARTICIPANT = {
	origin: 'navigation' as const,
	participantId: ParticipantIdSchema.parse( 'participant_1' ),
	pageId: PageIdSchema.parse( 'page_tab_7_one' ),
	retainedDestination: 'https://example.com/watch',
	focusEligible: true,
	statisticsEligible: true,
	joinSequence: 0,
};

describe( 'createFreshRuntimeObservation', () => {
	it( 'evaluates the matched scope schedule without exposing another destination', () => {
		const observation = createFreshRuntimeObservation(
			PARTICIPANT,
			CONFIGURATION,
			Date.UTC( 2026, 8, 2, 12 ),
			'UTC',
		);

		expect( observation ).toMatchObject( {
			participantId: PARTICIPANT.participantId,
			pageId: PARTICIPANT.pageId,
			observedDestination: PARTICIPANT.retainedDestination,
			match: { status: 'protected' },
			schedule: { status: 'active' },
		} );
	} );

	it( 'marks a missing retained destination as unprotected and inactive', () => {
		const observation = createFreshRuntimeObservation(
			{ ...PARTICIPANT, origin: 'allowance-expiry', retainedDestination: null },
			CONFIGURATION,
			Date.UTC( 2026, 8, 2, 12 ),
			'UTC',
		);

		expect( observation ).toMatchObject( {
			observedDestination: null,
			match: { status: 'unprotected' },
			schedule: { status: 'inactive' },
		} );
	} );
} );

describe( 'createReadyRuntimeExpiryCandidates', () => {
	it( 'projects every Ready participant and marks only the focused tab eligible', () => {
		const allowanceState: AllowanceProtectionState = {
			type: ProtectionStateType.ALLOWANCE,
			scopeId: ProtectionScopeIdSchema.parse( 'scope_default' ),
			allowanceId: AllowanceIdSchema.parse( 'allowance_1' ),
			completedWaitId: null,
			startedAtEpochMilliseconds: 1,
			expiresAtEpochMilliseconds: 301_000,
			ladder: {
				completedWaits: 0,
				greatestObservedLocalDate: LocalDateSchema.parse( '2026-09-02' ),
			},
			readyParticipants: [
				PARTICIPANT,
				{
					...PARTICIPANT,
					participantId: ParticipantIdSchema.parse( 'participant_2' ),
					pageId: PageIdSchema.parse( 'page_tab_8_two' ),
				},
			],
		};

		expect( createReadyRuntimeExpiryCandidates(
			allowanceState,
			CONFIGURATION,
			8,
			new Set( [ 7, 8 ] ),
			new Map(),
		) ).toEqual( [
			{
				source: AllowanceExpiryCandidateSource.READY_PARTICIPANT,
				participantId: PARTICIPANT.participantId,
				pageId: PARTICIPANT.pageId,
				observedDestination: PARTICIPANT.retainedDestination,
				focusEligible: false,
				match: { status: 'protected', rule: CONFIGURATION.sites[ 0 ]?.rule },
			},
			{
				source: AllowanceExpiryCandidateSource.READY_PARTICIPANT,
				participantId: 'participant_2',
				pageId: 'page_tab_8_two',
				observedDestination: PARTICIPANT.retainedDestination,
				focusEligible: true,
				match: { status: 'protected', rule: CONFIGURATION.sites[ 0 ]?.rule },
			},
		] );
	} );

	it( 'matches an expiry-origin Ready participant from its preserved live page', () => {
		const allowanceState: AllowanceProtectionState = {
			type: ProtectionStateType.ALLOWANCE,
			scopeId: ProtectionScopeIdSchema.parse( 'scope_default' ),
			allowanceId: AllowanceIdSchema.parse( 'allowance_1' ),
			completedWaitId: null,
			startedAtEpochMilliseconds: 1,
			expiresAtEpochMilliseconds: 301_000,
			ladder: {
				completedWaits: 0,
				greatestObservedLocalDate: LocalDateSchema.parse( '2026-09-02' ),
			},
			readyParticipants: [ {
				...PARTICIPANT,
				origin: 'allowance-expiry',
				retainedDestination: null,
			} ],
		};

		expect( createReadyRuntimeExpiryCandidates(
			allowanceState,
			CONFIGURATION,
			7,
			new Set( [ 7 ] ),
			new Map( [ [ 7, 'https://example.com/preserved-draft' ] ] ),
		) ).toEqual( [
			expect.objectContaining( {
				focusEligible: true,
				match: { status: 'protected', rule: CONFIGURATION.sites[ 0 ]?.rule },
				observedDestination: null,
			} ),
		] );
	} );

	it( 'marks an expiry-origin Ready participant without a live page as unprotected', () => {
		const allowanceState: AllowanceProtectionState = {
			type: ProtectionStateType.ALLOWANCE,
			scopeId: ProtectionScopeIdSchema.parse( 'scope_default' ),
			allowanceId: AllowanceIdSchema.parse( 'allowance_1' ),
			completedWaitId: null,
			startedAtEpochMilliseconds: 1,
			expiresAtEpochMilliseconds: 301_000,
			ladder: {
				completedWaits: 0,
				greatestObservedLocalDate: LocalDateSchema.parse( '2026-09-02' ),
			},
			readyParticipants: [ {
				...PARTICIPANT,
				origin: 'allowance-expiry',
				retainedDestination: null,
			} ],
		};

		expect( createReadyRuntimeExpiryCandidates(
			allowanceState,
			CONFIGURATION,
			null,
			new Set(),
			new Map(),
		) ).toEqual( [
			expect.objectContaining( {
				focusEligible: false,
				match: { status: 'unprotected' },
				observedDestination: null,
			} ),
		] );
	} );
} );
