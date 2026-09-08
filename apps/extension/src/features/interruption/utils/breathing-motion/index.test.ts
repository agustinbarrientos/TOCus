import { BreathingMotionPhase } from './types';
import { describe, expect, it } from 'vitest';
import { getBreathingMotionFrame } from './index';

describe( 'getBreathingMotionFrame', () => {
	it( 'starts a ten-second wait at rest in the inhale phase', () => {
		expect( getBreathingMotionFrame( 0, 10_000 ) ).toEqual( {
			breathProgress: 0,
			complete: false,
			phase: BreathingMotionPhase.INHALE,
			remainingMilliseconds: 10_000,
		} );
	} );

	it( 'reaches the inhale peak at the exact four-second boundary', () => {
		expect( getBreathingMotionFrame( 4_000, 10_000 ) ).toEqual( {
			breathProgress: 1,
			complete: false,
			phase: BreathingMotionPhase.EXHALE,
			remainingMilliseconds: 6_000,
		} );
	} );

	it( 'settles through the midpoint of the six-second exhale', () => {
		expect( getBreathingMotionFrame( 7_000, 10_000 ) ).toEqual( {
			breathProgress: 0.5,
			complete: false,
			phase: BreathingMotionPhase.EXHALE,
			remainingMilliseconds: 3_000,
		} );
	} );

	it( 'finishes at rest without beginning another visual cycle', () => {
		expect( getBreathingMotionFrame( 10_000, 10_000 ) ).toEqual( {
			breathProgress: 0,
			complete: true,
			phase: BreathingMotionPhase.EXHALE,
			remainingMilliseconds: 0,
		} );
	} );

	it( 'uses two complete seven-and-a-half-second breaths for a fifteen-second wait', () => {
		const firstCycleFrame = getBreathingMotionFrame( 1_000, 15_000 );

		expect( firstCycleFrame.breathProgress ).toBeCloseTo( 0.25 );
		expect( firstCycleFrame.phase ).toBe( BreathingMotionPhase.INHALE );
		expect( firstCycleFrame.remainingMilliseconds ).toBe( 14_000 );
		expect( getBreathingMotionFrame( 7_500, 15_000 ) ).toEqual( {
			breathProgress: 0,
			complete: false,
			phase: BreathingMotionPhase.INHALE,
			remainingMilliseconds: 7_500,
		} );
		expect( getBreathingMotionFrame( 10_500, 15_000 ) ).toEqual( {
			breathProgress: 1,
			complete: false,
			phase: BreathingMotionPhase.EXHALE,
			remainingMilliseconds: 4_500,
		} );
	} );

	it( 'keeps the reduced-motion sphere still while time and textual phase advance', () => {
		expect( getBreathingMotionFrame( 4_000, 10_000, true ) ).toEqual( {
			breathProgress: 0,
			complete: false,
			phase: BreathingMotionPhase.EXHALE,
			remainingMilliseconds: 6_000,
		} );
	} );

	it( 'clamps elapsed progress before the start and after completion', () => {
		expect( getBreathingMotionFrame( -250, 10_000 ).remainingMilliseconds ).toBe( 10_000 );
		expect( getBreathingMotionFrame( 10_250, 10_000 ).remainingMilliseconds ).toBe( 0 );
	} );
} );
