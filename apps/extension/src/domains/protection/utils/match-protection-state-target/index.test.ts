import { describe, expect, it } from 'vitest';
import {
	ProtectionStateTargetSchema,
	ProtectionStateType,
} from '../../types/protection-state';
import {
	createAllowanceState,
	createIdleState,
	createWaitingState,
} from '../../types/__fixtures__/protection-state';
import { protectionStateMatchesTarget } from './index';

describe( 'protectionStateMatchesTarget', () => {
	it( 'matches only the current Waiting transaction target', () => {
		const state = createWaitingState();

		expect( protectionStateMatchesTarget( state, ProtectionStateTargetSchema.parse( {
			stateType: ProtectionStateType.WAITING,
			waitId: state.waitId,
		} ) ) ).toBe( true );
		expect( protectionStateMatchesTarget( state, ProtectionStateTargetSchema.parse( {
			stateType: ProtectionStateType.WAITING,
			waitId: 'wait-stale',
		} ) ) ).toBe( false );
		expect( protectionStateMatchesTarget( state, ProtectionStateTargetSchema.parse( {
			stateType: ProtectionStateType.ALLOWANCE,
			allowanceId: 'allowance-a',
		} ) ) ).toBe( false );
	} );

	it( 'matches only the current Allowance transaction target', () => {
		const state = createAllowanceState();

		expect( protectionStateMatchesTarget( state, ProtectionStateTargetSchema.parse( {
			stateType: ProtectionStateType.ALLOWANCE,
			allowanceId: state.allowanceId,
		} ) ) ).toBe( true );
		expect( protectionStateMatchesTarget( state, ProtectionStateTargetSchema.parse( {
			stateType: ProtectionStateType.ALLOWANCE,
			allowanceId: 'allowance-stale',
		} ) ) ).toBe( false );
		expect( protectionStateMatchesTarget( state, ProtectionStateTargetSchema.parse( {
			stateType: ProtectionStateType.WAITING,
			waitId: 'wait-a',
		} ) ) ).toBe( false );
	} );

	it( 'never matches a transaction target against Idle state', () => {
		expect( protectionStateMatchesTarget( createIdleState(), ProtectionStateTargetSchema.parse( {
			stateType: ProtectionStateType.WAITING,
			waitId: 'wait-a',
		} ) ) ).toBe( false );
	} );
} );
