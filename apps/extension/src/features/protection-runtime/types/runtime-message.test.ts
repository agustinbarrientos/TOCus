import { describe, expect, it } from 'vitest';
import {
	InterruptionPageRequestSchema,
	InterruptionPageRequestType,
	InterruptionPageResponseSchema,
	InterruptionPageResponseState,
	ProtectionClockRequestSchema,
	ProtectionClockRequestType,
} from './runtime-message';

describe( 'InterruptionPageRequestSchema', () => {
	it( 'accepts connect and synchronization requests with current visibility', () => {
		expect( InterruptionPageRequestSchema.parse( {
			type: InterruptionPageRequestType.CONNECT,
			documentVisible: true,
		} ) ).toEqual( {
			type: 'connect',
			documentVisible: true,
		} );
		expect( InterruptionPageRequestSchema.parse( {
			type: InterruptionPageRequestType.SYNCHRONIZE,
			documentVisible: false,
		} ) ).toEqual( {
			type: 'synchronize',
			documentVisible: false,
		} );
	} );

	it( 'accepts a checkpoint with displayed focused progress', () => {
		expect( InterruptionPageRequestSchema.parse( {
			type: InterruptionPageRequestType.CHECKPOINT,
			documentVisible: true,
			displayedFocusedDurationMilliseconds: 4_250,
		} ) ).toMatchObject( {
			type: 'checkpoint',
			displayedFocusedDurationMilliseconds: 4_250,
		} );
	} );

} );

describe( 'ProtectionClockRequestSchema', () => {
	it( 'accepts one allowance-keyed local expiry reconciliation request', () => {
		expect( ProtectionClockRequestSchema.parse( {
			type: ProtectionClockRequestType.RECONCILE_ALLOWANCE_EXPIRY,
			allowanceId: 'allowance_a',
		} ) ).toEqual( {
			type: 'reconcile-allowance-expiry',
			allowanceId: 'allowance_a',
		} );
	} );

	it( 'rejects malformed or unrelated clock requests', () => {
		expect( () => ProtectionClockRequestSchema.parse( {
			type: ProtectionClockRequestType.RECONCILE_ALLOWANCE_EXPIRY,
		} ) ).toThrow();
		expect( () => ProtectionClockRequestSchema.parse( {
			type: 'synchronize',
			allowanceId: 'allowance_a',
		} ) ).toThrow();
	} );
} );

describe( 'InterruptionPageResponseSchema', () => {
	it( 'accepts authoritative Waiting and Ready projections', () => {
		expect( InterruptionPageResponseSchema.parse( {
			state: InterruptionPageResponseState.WAITING,
			capturedWaitDurationMilliseconds: 10_000,
			focusedProgressMilliseconds: 3_000,
			progressing: true,
		} ) ).toMatchObject( { state: 'waiting', progressing: true } );
		expect( InterruptionPageResponseSchema.parse( {
			state: InterruptionPageResponseState.READY,
			allowanceExpiresAtEpochMilliseconds: 300_000,
		} ) ).toEqual( {
			state: 'ready',
			allowanceExpiresAtEpochMilliseconds: 300_000,
		} );
	} );

	it( 'accepts an unavailable page without exposing a retained destination', () => {
		expect( InterruptionPageResponseSchema.parse( {
			state: InterruptionPageResponseState.UNAVAILABLE,
		} ) ).toEqual( { state: 'unavailable' } );
	} );
} );
