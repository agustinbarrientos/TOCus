import { ZodError } from 'zod';
import { describe, expect, it } from 'vitest';
import { CompletionAction } from '../../types/completion-action';
import { getNextWaitDuration } from './index';

const VALID_TIMING_CONFIGURATION = Object.freeze( {
	initialWaitMilliseconds: 10_000,
	ladderIncreaseMilliseconds: 5_000,
	maximumWaitMilliseconds: 60_000,
	allowanceMilliseconds: 300_000,
	completionAction: 'show-continue',
} );

const VALID_DAILY_LADDER = Object.freeze( {
	completedWaits: 0,
	greatestObservedLocalDate: '2026-08-31',
} );

describe( 'timing configuration', () => {
	describe( 'valid grids and boundaries', () => {
		it.each( [ 10_000, 15_000, 20_000, 25_000, 30_000, 35_000, 40_000, 45_000, 50_000, 55_000, 60_000 ] )(
			'accepts an initial wait of %i milliseconds',
			( initialWaitMilliseconds ) => {
				expect(
					getNextWaitDuration(
						{
							...VALID_TIMING_CONFIGURATION,
							initialWaitMilliseconds,
						},
						VALID_DAILY_LADDER,
					),
				).toBe( initialWaitMilliseconds );
			},
		);

		it.each( [ 5_000, 10_000, 15_000, 20_000, 25_000, 30_000, 35_000, 40_000, 45_000, 50_000, 55_000, 60_000 ] )(
			'accepts a ladder increase of %i milliseconds',
			( ladderIncreaseMilliseconds ) => {
				expect(
					getNextWaitDuration(
						{
							...VALID_TIMING_CONFIGURATION,
							ladderIncreaseMilliseconds,
						},
						{
							...VALID_DAILY_LADDER,
							completedWaits: 1,
						},
					),
				).toBe( Math.min( 10_000 + ladderIncreaseMilliseconds, 60_000 ) );
			},
		);

		it.each( [ 10_000, 15_000, 20_000, 25_000, 30_000, 35_000, 40_000, 45_000, 50_000, 55_000, 60_000 ] )(
			'accepts a maximum wait of %i milliseconds',
			( maximumWaitMilliseconds ) => {
				expect(
					getNextWaitDuration(
						{
							...VALID_TIMING_CONFIGURATION,
							maximumWaitMilliseconds,
						},
						{
							...VALID_DAILY_LADDER,
							completedWaits: 1_000,
						},
					),
				).toBe( maximumWaitMilliseconds );
			},
		);

		it.each( [ 10_000, 15_000, 20_000, 25_000, 30_000, 35_000, 40_000, 45_000, 50_000, 55_000, 60_000 ] )(
			'accepts a maximum equal to an initial wait of %i milliseconds',
			( waitMilliseconds ) => {
				expect(
					getNextWaitDuration(
						{
							...VALID_TIMING_CONFIGURATION,
							initialWaitMilliseconds: waitMilliseconds,
							maximumWaitMilliseconds: waitMilliseconds,
						},
						{
							...VALID_DAILY_LADDER,
							completedWaits: 1,
						},
					),
				).toBe( waitMilliseconds );
			},
		);

		it.each( Array.from( { length: 60 }, ( _, index ) => ( index + 1 ) * 60_000 ) )(
			'accepts a whole-minute allowance of %i milliseconds',
			( allowanceMilliseconds ) => {
				expect(
					getNextWaitDuration(
						{
							...VALID_TIMING_CONFIGURATION,
							allowanceMilliseconds,
						},
						VALID_DAILY_LADDER,
					),
				).toBe( 10_000 );
			},
		);

		it.each( [ CompletionAction.SHOW_CONTINUE, CompletionAction.OPEN_AUTOMATICALLY ] )(
			'accepts the completion action %s',
			( completionAction ) => {
				expect(
					getNextWaitDuration(
						{
							...VALID_TIMING_CONFIGURATION,
							completionAction,
						},
						VALID_DAILY_LADDER,
					),
				).toBe( 10_000 );
			},
		);
	} );

	describe( 'invalid values and relationships', () => {
		it.each( [
			{ label: 'initial wait below the minimum', overrides: { initialWaitMilliseconds: 5_000 } },
			{ label: 'initial wait above the maximum', overrides: { initialWaitMilliseconds: 65_000 } },
			{ label: 'initial wait off the five-second grid', overrides: { initialWaitMilliseconds: 10_001 } },
			{ label: 'fractional initial wait', overrides: { initialWaitMilliseconds: 10_000.5 } },
			{ label: 'ladder increase below the minimum', overrides: { ladderIncreaseMilliseconds: 0 } },
			{ label: 'ladder increase above the maximum', overrides: { ladderIncreaseMilliseconds: 65_000 } },
			{ label: 'ladder increase off the five-second grid', overrides: { ladderIncreaseMilliseconds: 5_001 } },
			{ label: 'fractional ladder increase', overrides: { ladderIncreaseMilliseconds: 5_000.5 } },
			{ label: 'maximum wait below the minimum', overrides: { maximumWaitMilliseconds: 5_000 } },
			{ label: 'maximum wait above the hard cap', overrides: { maximumWaitMilliseconds: 65_000 } },
			{ label: 'maximum wait off the five-second grid', overrides: { maximumWaitMilliseconds: 59_999 } },
			{ label: 'fractional maximum wait', overrides: { maximumWaitMilliseconds: 60_000.5 } },
			{ label: 'allowance below one minute', overrides: { allowanceMilliseconds: 0 } },
			{ label: 'allowance above sixty minutes', overrides: { allowanceMilliseconds: 3_660_000 } },
			{ label: 'allowance off the whole-minute grid', overrides: { allowanceMilliseconds: 300_001 } },
			{ label: 'fractional allowance', overrides: { allowanceMilliseconds: 300_000.5 } },
			{ label: 'unknown completion action', overrides: { completionAction: 'skip' } },
			{ label: 'non-finite initial wait', overrides: { initialWaitMilliseconds: Number.NaN } },
		] )( 'rejects a configuration with $label', ( { overrides } ) => {
			expect( () =>
				getNextWaitDuration(
					{
						...VALID_TIMING_CONFIGURATION,
						...overrides,
					},
					VALID_DAILY_LADDER,
				),
			).toThrow( ZodError );
		} );

		it.each( [
			{ initialWaitMilliseconds: 15_000, maximumWaitMilliseconds: 10_000 },
			{ initialWaitMilliseconds: 60_000, maximumWaitMilliseconds: 55_000 },
		] )( 'rejects a maximum below the initial wait %#', ( relationship ) => {
			expect( () =>
				getNextWaitDuration(
					{
						...VALID_TIMING_CONFIGURATION,
						...relationship,
					},
					VALID_DAILY_LADDER,
				),
			).toThrow( ZodError );
		} );

		it.each( [
			null,
			undefined,
			{},
			[],
			'slow',
			{ ...VALID_TIMING_CONFIGURATION, extra: true },
			{
				initialWaitMilliseconds: 10_000,
				ladderIncreaseMilliseconds: 5_000,
				maximumWaitMilliseconds: 60_000,
				allowanceMilliseconds: 300_000,
			},
		] )( 'rejects malformed timing configuration input %#', ( configuration ) => {
			expect( () => getNextWaitDuration( configuration, VALID_DAILY_LADDER ) ).toThrow( ZodError );
		} );
	} );
} );

describe( 'getNextWaitDuration', () => {
	describe( 'daily progression and cap behavior', () => {
		it.each( [
			{ completedWaits: 0, expected: 10_000 },
			{ completedWaits: 1, expected: 15_000 },
			{ completedWaits: 2, expected: 20_000 },
			{ completedWaits: 9, expected: 55_000 },
			{ completedWaits: 10, expected: 60_000 },
			{ completedWaits: 11, expected: 60_000 },
			{ completedWaits: 1_000, expected: 60_000 },
		] )( 'returns $expected after $completedWaits completed waits', ( { completedWaits, expected } ) => {
			expect(
				getNextWaitDuration( VALID_TIMING_CONFIGURATION, {
					...VALID_DAILY_LADDER,
					completedWaits,
				} ),
			).toBe( expected );
		} );

		it.each( [
			{ completedWaits: 0, expected: 20_000 },
			{ completedWaits: 1, expected: 35_000 },
			{ completedWaits: 2, expected: 50_000 },
			{ completedWaits: 3, expected: 50_000 },
		] )( 'applies a custom timing formula after $completedWaits completions', ( { completedWaits, expected } ) => {
			expect(
				getNextWaitDuration(
					{
						initialWaitMilliseconds: 20_000,
						ladderIncreaseMilliseconds: 15_000,
						maximumWaitMilliseconds: 50_000,
						allowanceMilliseconds: 60_000,
						completionAction: 'open-automatically',
					},
					{
						...VALID_DAILY_LADDER,
						completedWaits,
					},
				),
			).toBe( expected );
		} );
	} );

	describe( 'public-boundary validation', () => {
		it.each( [
			null,
			undefined,
			{},
			[],
			{ completedWaits: -1, greatestObservedLocalDate: '2026-08-31' },
			{ completedWaits: 0.5, greatestObservedLocalDate: '2026-08-31' },
			{ completedWaits: '0', greatestObservedLocalDate: '2026-08-31' },
			{ completedWaits: Number.NaN, greatestObservedLocalDate: '2026-08-31' },
			{ completedWaits: Number.POSITIVE_INFINITY, greatestObservedLocalDate: '2026-08-31' },
			{ completedWaits: 0, greatestObservedLocalDate: '2026-02-29' },
			{ completedWaits: 0, greatestObservedLocalDate: '2026-8-31' },
			{ completedWaits: 0, greatestObservedLocalDate: '2026-08-31', extra: true },
		] )( 'rejects malformed ladder input %#', ( ladder ) => {
			expect( () => getNextWaitDuration( VALID_TIMING_CONFIGURATION, ladder ) ).toThrow( ZodError );
		} );
	} );

	describe( 'immutability', () => {
		it( 'does not mutate frozen configuration or ladder inputs', () => {
			const configuration = Object.freeze( { ...VALID_TIMING_CONFIGURATION } );
			const ladder = Object.freeze( {
				completedWaits: 4,
				greatestObservedLocalDate: '2026-08-31',
			} );

			expect( getNextWaitDuration( configuration, ladder ) ).toBe( 30_000 );
			expect( configuration ).toEqual( VALID_TIMING_CONFIGURATION );
			expect( ladder ).toEqual( {
				completedWaits: 4,
				greatestObservedLocalDate: '2026-08-31',
			} );
		} );
	} );
} );
