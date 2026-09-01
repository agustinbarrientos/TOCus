import { describe, expect, it } from 'vitest';
import { ProtectionStateSchema, ProtectionStateType } from '../../types/protection-state';
import { createTransitionResult } from './index';

describe( 'protection transition results', () => {
	it( 'constructs a validated cloned result with empty decision and fact defaults', () => {
		const state = ProtectionStateSchema.parse( {
			type: ProtectionStateType.IDLE,
			scopeId: 'scope-a',
			ladder: { completedWaits: 0, greatestObservedLocalDate: '2026-08-31' },
		} );
		const result = createTransitionResult( state );

		expect( result ).toStrictEqual( { state, decisions: [], facts: [] } );
		expect( result.state ).not.toBe( state );
	} );

	it( 'rejects an invalid derived decision at construction time', () => {
		const state = ProtectionStateSchema.parse( {
			type: ProtectionStateType.IDLE,
			scopeId: 'scope-a',
			ladder: { completedWaits: 0, greatestObservedLocalDate: '2026-08-31' },
		} );

		expect( () => createTransitionResult( state, [ {
			type: 'present-waiting',
			participantId: 'participant-a',
			pageId: 'page-a',
			waitId: '',
		} ] ) ).toThrow();
	} );
} );
