import { ZodError } from 'zod';
import { describe, expect, it } from 'vitest';
import { BreathingCycleSchema, BreathingPlanSchema, createBreathingPlan } from './index';
import { getNextWaitDuration } from '../wait-duration-calculator';
import { DefaultTimingConfiguration } from '../../types/timing-configuration';

describe( 'one-second ladder breathing plans', () => {
	it( 'creates two complete cycles for the eleven-second second wait', () => {
		const duration = getNextWaitDuration( {
			...DefaultTimingConfiguration,
			ladderIncreaseMilliseconds: 1_000,
		}, { completedWaits: 1, greatestObservedLocalDate: '2026-09-06' } );

		expect( createBreathingPlan( duration ) ).toEqual( {
			durationMilliseconds: 11_000,
			cycles: [
				{ inhaleDurationMilliseconds: 2_200, exhaleDurationMilliseconds: 3_300 },
				{ inhaleDurationMilliseconds: 2_200, exhaleDurationMilliseconds: 3_300 },
			],
		} );
	} );

	it.each( Array.from( { length: 111 }, ( _, index ) => 10_000 + index * 1_000 ) )( 'builds a valid complete plan for a captured %i millisecond wait', ( durationMilliseconds ) => {
		const plan = createBreathingPlan( durationMilliseconds );

		expect( plan.durationMilliseconds ).toBe( durationMilliseconds );
		const completeDuration = plan.cycles.reduce(
			( total, cycle ) => total + cycle.inhaleDurationMilliseconds + cycle.exhaleDurationMilliseconds,
			0,
		);

		expect( completeDuration ).toBeCloseTo( durationMilliseconds, 8 );
		expect( BreathingPlanSchema.parse( plan ) ).toEqual( plan );
	} );
} );

describe( 'breathing cycle schema', () => {
	it( 'rejects a meaningful phase deviation even when the complete duration is unchanged', () => {
		expect( () => BreathingCycleSchema.parse( {
			inhaleDurationMilliseconds: 2_200.001,
			exhaleDurationMilliseconds: 3_299.999,
		} ) ).toThrow( ZodError );
	} );

	it( 'rejects a complete cycle whose combined duration exceeds ten seconds', () => {
		expect( () =>
			BreathingCycleSchema.parse( {
				inhaleDurationMilliseconds: 4_400,
				exhaleDurationMilliseconds: 6_600,
			} ),
		).toThrow( ZodError );
	} );

	it( 'rejects a complete cycle without the exact 40/60 phase split', () => {
		expect( () =>
			BreathingCycleSchema.parse( {
				inhaleDurationMilliseconds: 5_000,
				exhaleDurationMilliseconds: 5_000,
			} ),
		).toThrow( ZodError );
	} );

	it( 'accepts the deterministic fractional cycle emitted for a twenty-five-second wait', () => {
		expect(
			BreathingCycleSchema.parse( {
				inhaleDurationMilliseconds: 3_333.333333333334,
				exhaleDurationMilliseconds: 5_000,
			} ),
		).toEqual( {
			inhaleDurationMilliseconds: 3_333.333333333334,
			exhaleDurationMilliseconds: 5_000,
		} );
	} );
} );

describe( 'createBreathingPlan', () => {
	describe( 'complete cycle counts', () => {
		it.each( [
			{ durationMilliseconds: 10_000, expectedCycles: 1 },
			{ durationMilliseconds: 15_000, expectedCycles: 2 },
			{ durationMilliseconds: 20_000, expectedCycles: 2 },
			{ durationMilliseconds: 25_000, expectedCycles: 3 },
			{ durationMilliseconds: 55_000, expectedCycles: 6 },
			{ durationMilliseconds: 60_000, expectedCycles: 6 },
			{ durationMilliseconds: 120_000, expectedCycles: 12 },
		] )( 'uses $expectedCycles complete cycles for $durationMilliseconds milliseconds', ( {
			durationMilliseconds,
			expectedCycles,
		} ) => {
			const plan = createBreathingPlan( durationMilliseconds );

			expect( plan.durationMilliseconds ).toBe( durationMilliseconds );
			expect( plan.cycles ).toHaveLength( expectedCycles );
		} );
	} );

	describe( 'equal phase allocation', () => {
		it.each( [ 15_000, 25_000, 55_000 ] )(
			'allocates equal complete cycles with a 40/60 split for %i milliseconds',
			( durationMilliseconds ) => {
				const plan = createBreathingPlan( durationMilliseconds );
				const firstCycle = plan.cycles.at( 0 );

				if ( firstCycle === undefined ) {
					throw new Error( 'A valid breathing plan must contain at least one cycle.' );
				}

				const expectedCycleDuration = durationMilliseconds / plan.cycles.length;
				const firstCycleDuration =
					firstCycle.inhaleDurationMilliseconds + firstCycle.exhaleDurationMilliseconds;
				const firstInhaleDuration = firstCycle.inhaleDurationMilliseconds;
				const firstExhaleDuration = firstCycle.exhaleDurationMilliseconds;

				for ( const cycle of plan.cycles ) {
					const cycleDuration = cycle.inhaleDurationMilliseconds + cycle.exhaleDurationMilliseconds;

					expect( cycle.inhaleDurationMilliseconds ).toBe( firstInhaleDuration );
					expect( cycle.exhaleDurationMilliseconds ).toBe( firstExhaleDuration );
					expect( cycleDuration ).toBe( firstCycleDuration );
					expect( cycleDuration ).toBe( expectedCycleDuration );
					expect( cycleDuration ).toBeLessThanOrEqual( 10_000 );
					expect( cycle.inhaleDurationMilliseconds / cycleDuration ).toBeCloseTo( 0.4, 14 );
					expect( cycle.exhaleDurationMilliseconds / cycleDuration ).toBeCloseTo( 0.6, 14 );
				}
			},
		);

		it( 'uses the exact four-second inhale and six-second exhale for a ten-second wait', () => {
			expect( createBreathingPlan( 10_000 ) ).toEqual( {
				durationMilliseconds: 10_000,
				cycles: [
					{
						inhaleDurationMilliseconds: 4_000,
						exhaleDurationMilliseconds: 6_000,
					},
				],
			} );
		} );

		it( 'allows fractional phase durations required by complete breaths', () => {
			const plan = createBreathingPlan( 25_000 );
			const firstCycle = plan.cycles.at( 0 );

			if ( firstCycle === undefined ) {
				throw new Error( 'A valid breathing plan must contain at least one cycle.' );
			}

			expect( Number.isInteger( firstCycle.inhaleDurationMilliseconds ) ).toBe( false );
			expect( firstCycle.exhaleDurationMilliseconds ).toBe( 5_000 );
		} );
	} );

	describe( 'exact plan totals', () => {
		it.each( [ 10_000, 15_000, 20_000, 25_000, 30_000, 35_000, 40_000, 45_000, 50_000, 55_000, 60_000 ] )(
			'sums every emitted phase exactly to %i milliseconds',
			( durationMilliseconds ) => {
				const plan = createBreathingPlan( durationMilliseconds );
				const total = plan.cycles.reduce(
					( sum, cycle ) =>
						sum + cycle.inhaleDurationMilliseconds + cycle.exhaleDurationMilliseconds,
					0,
				);

				expect( total ).toBe( durationMilliseconds );
				expect( BreathingPlanSchema.parse( plan ) ).toEqual( plan );
			},
		);
	} );

	describe( 'semantic schema validation', () => {
		it.each( [
			{
				label: 'the cycle count does not match the duration',
				plan: {
					durationMilliseconds: 20_000,
					cycles: [ { inhaleDurationMilliseconds: 4_000, exhaleDurationMilliseconds: 6_000 } ],
				},
			},
			{
				label: 'complete cycles receive unequal shares',
				plan: {
					durationMilliseconds: 25_000,
					cycles: [
						{ inhaleDurationMilliseconds: 3_200, exhaleDurationMilliseconds: 4_800 },
						{ inhaleDurationMilliseconds: 3_200, exhaleDurationMilliseconds: 4_800 },
						{ inhaleDurationMilliseconds: 3_600, exhaleDurationMilliseconds: 5_400 },
					],
				},
			},
			{
				label: 'cycles do not use the 40/60 phase split',
				plan: {
					durationMilliseconds: 20_000,
					cycles: [
						{ inhaleDurationMilliseconds: 5_000, exhaleDurationMilliseconds: 5_000 },
						{ inhaleDurationMilliseconds: 5_000, exhaleDurationMilliseconds: 5_000 },
					],
				},
			},
			{
				label: 'the phases do not sum to the captured duration',
				plan: {
					durationMilliseconds: 20_000,
					cycles: [
						{ inhaleDurationMilliseconds: 3_600, exhaleDurationMilliseconds: 5_400 },
						{ inhaleDurationMilliseconds: 3_600, exhaleDurationMilliseconds: 5_400 },
					],
				},
			},
			{
				label: 'a complete cycle exceeds ten seconds',
				plan: {
					durationMilliseconds: 20_000,
					cycles: [
						{ inhaleDurationMilliseconds: 4_400, exhaleDurationMilliseconds: 6_600 },
						{ inhaleDurationMilliseconds: 3_600, exhaleDurationMilliseconds: 5_400 },
					],
				},
			},
		] )( 'rejects a plan when $label', ( { plan } ) => {
			expect( () => BreathingPlanSchema.parse( plan ) ).toThrow( ZodError );
		} );
	} );

	describe( 'public-boundary validation', () => {
		it.each( [
			0,
			-1,
			5_000,
			9_999,
			10_001,
			15_000.5,
			120_001,
			Number.NaN,
			Number.POSITIVE_INFINITY,
			Number.NEGATIVE_INFINITY,
			'15000',
			null,
			undefined,
		] )( 'rejects invalid wait duration input %#', ( durationMilliseconds ) => {
			expect( () => createBreathingPlan( durationMilliseconds ) ).toThrow( ZodError );
		} );
	} );
} );
