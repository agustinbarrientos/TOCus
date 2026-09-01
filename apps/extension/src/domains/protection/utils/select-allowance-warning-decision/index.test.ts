import { describe, expect, it } from 'vitest';
import {
	ProtectedUrlMatchStatus,
} from '../../types/protected-url-match';
import {
	ScheduleEvaluationFailureReason,
	ScheduleEvaluationStatus,
} from '../../types/schedule-evaluation';
import { ProtectionDecisionType } from '../../types/protection-decision';
import { AllowanceWarningDurationMilliseconds } from '../../types/allowance-warning';
import {
	createAllowanceState,
	createIdleState,
} from '../../types/__fixtures__/protection-state';
import {
	selectAllowanceWarningDecision,
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

const AllowanceExpiryInstant = 1_800_000_300_000;
const AllowanceState = {
	...createAllowanceState(),
	scopeId: 'scope-a',
	allowanceId: 'allowance-a',
	startedAtEpochMilliseconds: 1_800_000_000_000,
	expiresAtEpochMilliseconds: AllowanceExpiryInstant,
	readyParticipants: [],
};
const ProtectedMatch = {
	status: ProtectedUrlMatchStatus.PROTECTED,
	rule: {
		host: 'example.com',
		includeSubdomains: true,
		scopeId: 'scope-a',
	},
};
const EligibleInput = {
	scopeId: 'scope-a',
	allowanceId: 'allowance-a',
	pageId: 'page-a',
	nowEpochMilliseconds: AllowanceExpiryInstant - 1,
	focusEligible: true,
	match: ProtectedMatch,
	schedule: { status: ScheduleEvaluationStatus.ACTIVE },
	isWarningPresented: false,
};
const PresentDecision = {
	type: ProtectionDecisionType.PRESENT_ALLOWANCE_WARNING,
	pageId: 'page-a',
	allowanceId: 'allowance-a',
	expiresAtEpochMilliseconds: AllowanceExpiryInstant,
};
const RemoveDecision = {
	type: ProtectionDecisionType.REMOVE_ALLOWANCE_WARNING,
	pageId: 'page-a',
	allowanceId: 'allowance-a',
};

describe( 'allowance warnings', () => {
	it.each( [
		AllowanceExpiryInstant - AllowanceWarningDurationMilliseconds,
		AllowanceExpiryInstant - 1,
	] )( 'presents at the eligible warning-window boundary %i', ( nowEpochMilliseconds ) => {
		expect( selectAllowanceWarningDecision( AllowanceState, {
			...EligibleInput,
			nowEpochMilliseconds,
		} ) ).toStrictEqual( PresentDecision );
	} );

	it.each( [
		AllowanceExpiryInstant - AllowanceWarningDurationMilliseconds - 1,
		AllowanceExpiryInstant,
		AllowanceExpiryInstant + 1,
	] )( 'removes a presented warning outside the eligible time window at %i', ( nowEpochMilliseconds ) => {
		expect( selectAllowanceWarningDecision( AllowanceState, {
			...EligibleInput,
			nowEpochMilliseconds,
			isWarningPresented: true,
		} ) ).toStrictEqual( RemoveDecision );
	} );

	it.each( [
		[ 'an unfocused page', { focusEligible: false } ],
		[ 'an unprotected page', { match: { status: ProtectedUrlMatchStatus.UNPROTECTED } } ],
		[
			'an unsupported page',
			{
				match: {
					status: ProtectedUrlMatchStatus.UNSUPPORTED,
					reason: 'unsupported-scheme',
				},
			},
		],
		[
			'a page protected by another scope',
			{
				match: {
					...ProtectedMatch,
					rule: { ...ProtectedMatch.rule, scopeId: 'scope-other' },
				},
			},
		],
		[ 'an inactive schedule', { schedule: { status: ScheduleEvaluationStatus.INACTIVE } } ],
		[
			'a schedule evaluation error',
			{
				schedule: {
					status: ScheduleEvaluationStatus.ERROR,
					reason: ScheduleEvaluationFailureReason.INVALID_TIME_ZONE,
				},
			},
		],
		[ 'a different scope', { scopeId: 'scope-other' } ],
		[ 'a different allowance', { allowanceId: 'allowance-other' } ],
	] )( 'removes a presented warning for %s', ( _label, override ) => {
		const input = {
			...EligibleInput,
			...override,
			isWarningPresented: true,
		};

		expect( selectAllowanceWarningDecision( AllowanceState, input ) ).toStrictEqual( {
			...RemoveDecision,
			allowanceId: input.allowanceId,
		} );
	} );

	it( 'returns no decision when an eligible warning is already presented', () => {
		expect( selectAllowanceWarningDecision( AllowanceState, {
			...EligibleInput,
			isWarningPresented: true,
		} ) ).toBeNull();
	} );

	it( 'returns no decision when an ineligible warning is not presented', () => {
		expect( selectAllowanceWarningDecision( AllowanceState, {
			...EligibleInput,
			focusEligible: false,
		} ) ).toBeNull();
	} );

	it( 'removes a presented warning when the state is no longer Allowance', () => {
		expect( selectAllowanceWarningDecision( {
			...createIdleState(),
			scopeId: 'scope-a',
		}, {
			...EligibleInput,
			isWarningPresented: true,
		} ) ).toStrictEqual( RemoveDecision );
	} );

	it.each( [ null, undefined, {}, [], 'warning' ] )(
		'rejects malformed warning input %#',
		( input ) => {
			expect( () => selectAllowanceWarningDecision( AllowanceState, input ) ).toThrow();
		},
	);

	it( 'rejects malformed state before evaluating warning eligibility', () => {
		expect( () => selectAllowanceWarningDecision( {
			...AllowanceState,
			expiresAtEpochMilliseconds: AllowanceState.startedAtEpochMilliseconds,
		}, null ) ).toThrow( 'Allowance interval must span one through sixty whole minutes.' );
	} );

	it( 'does not mutate deeply frozen state or warning input', () => {
		const state = freezeDeeply( { ...AllowanceState } );
		const input = freezeDeeply( { ...EligibleInput } );

		expect( selectAllowanceWarningDecision( state, input ) ).toStrictEqual( PresentDecision );
		expect( state ).toStrictEqual( AllowanceState );
		expect( input ).toStrictEqual( EligibleInput );
	} );
} );
