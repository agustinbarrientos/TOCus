import { describe, expect, it } from 'vitest';
import {
	AllowanceProtectionStateSchema,
	IdleProtectionStateSchema,
	ProtectionStateType,
	WaitingProtectionStateSchema,
} from '../../../../domains/protection/types/protection-state';
import {
	createRuntimePageId,
	createRuntimeStateTarget,
	findRuntimeParticipantContext,
	getRuntimeTabId,
} from './index';

/** Waiting state used by runtime-page lookup fixtures. */
const WAITING_STATE = WaitingProtectionStateSchema.parse( {
	type: ProtectionStateType.WAITING,
	scopeId: 'scope_default',
	waitId: 'wait_a',
	capturedWaitDurationMilliseconds: 10_000,
	confirmedFocusedDurationMilliseconds: 0,
	participants: [ {
		origin: 'navigation',
		participantId: 'participant_a',
		pageId: 'page_tab_7_alpha',
		retainedDestination: 'https://example.com/',
		focusEligible: true,
		joinSequence: 0,
	} ],
	ownerParticipantId: 'participant_a',
	ownerEpoch: 1,
	checkpointHighWaterMilliseconds: 0,
	ladder: {
		completedWaits: 0,
		greatestObservedLocalDate: '2026-09-02',
	},
} );

/** Allowance state used by runtime-page lookup fixtures. */
const ALLOWANCE_STATE = AllowanceProtectionStateSchema.parse( {
	type: ProtectionStateType.ALLOWANCE,
	scopeId: 'scope_default',
	allowanceId: 'allowance_a',
	completedWaitId: 'wait_a',
	startedAtEpochMilliseconds: 1_000,
	expiresAtEpochMilliseconds: 301_000,
	ladder: {
		completedWaits: 1,
		greatestObservedLocalDate: '2026-09-02',
	},
	readyParticipants: [ {
		origin: 'navigation',
		participantId: 'participant_a',
		pageId: 'page_tab_7_alpha',
		retainedDestination: 'https://example.com/',
		focusEligible: true,
		joinSequence: 0,
	} ],
} );

/** Idle state used to verify participant-search filtering. */
const IDLE_STATE = IdleProtectionStateSchema.parse( {
	type: ProtectionStateType.IDLE,
	scopeId: 'scope_other',
	ladder: {
		completedWaits: 0,
		greatestObservedLocalDate: '2026-09-02',
	},
} );

describe( 'runtime page context', () => {
	it( 'creates and decodes a page identifier without exposing a destination', () => {
		const pageId = createRuntimePageId( 7, 'alpha' );

		expect( pageId ).toBe( 'page_tab_7_alpha' );
		expect( getRuntimeTabId( pageId ) ).toBe( 7 );
		expect( pageId ).not.toContain( 'example.com' );
	} );

	it.each( [ 'page_a', 'page_tab_-1_alpha', 'page_tab_nope_alpha' ] )(
		'rejects the unsupported page identifier %s',
		( pageId ) => {
			expect( getRuntimeTabId( pageId ) ).toBeNull();
		},
	);

	it( 'finds a retained participant by encoded tab and creates its transaction target', () => {
		const context = findRuntimeParticipantContext( { scope_default: WAITING_STATE }, 7 );

		expect( context?.participant.participantId ).toBe( 'participant_a' );
		expect( createRuntimeStateTarget( WAITING_STATE ) ).toEqual( {
			stateType: ProtectionStateType.WAITING,
			waitId: 'wait_a',
		} );
		expect( findRuntimeParticipantContext( { scope_default: WAITING_STATE }, 8 ) ).toBeNull();
	} );

	it( 'finds an allowance participant and creates its transaction target', () => {
		const context = findRuntimeParticipantContext( { scope_default: ALLOWANCE_STATE }, 7 );

		expect( context?.participant.participantId ).toBe( 'participant_a' );
		expect( createRuntimeStateTarget( ALLOWANCE_STATE ) ).toEqual( {
			stateType: ProtectionStateType.ALLOWANCE,
			allowanceId: 'allowance_a',
		} );
	} );

	it( 'skips idle scopes while searching for a participant', () => {
		expect( findRuntimeParticipantContext( {
			scope_other: IDLE_STATE,
			scope_default: WAITING_STATE,
		}, 7 )?.state.scopeId ).toBe( 'scope_default' );
	} );
} );
