import { ZodError } from 'zod';
import { describe, expect, it } from 'vitest';
import { normalizeSchedule } from './index';

describe( 'normalizeSchedule', () => {
	describe( 'Always schedules', () => {
		it( 'normalizes Always without adding custom state', () => {
			expect( normalizeSchedule( { mode: 'always' } ) ).toEqual( { mode: 'always' } );
		} );
	} );

	describe( 'minute bounds', () => {
		it.each( [
			{
				label: 'the earliest one-minute range',
				window: { weekday: 'Monday', startMinute: 0, endMinute: 1 },
				expected: [ { weekday: 'Monday', startMinute: 0, endMinute: 1 } ],
			},
			{
				label: 'the latest one-minute range',
				window: { weekday: 'Monday', startMinute: 1_439, endMinute: 1_440 },
				expected: [ { weekday: 'Monday', startMinute: 1_439, endMinute: 1_440 } ],
			},
			{
				label: 'a full local day',
				window: { weekday: 'Monday', startMinute: 0, endMinute: 1_440 },
				expected: [ { weekday: 'Monday', startMinute: 0, endMinute: 1_440 } ],
			},
			{
				label: 'an overnight range ending exactly at midnight',
				window: { weekday: 'Monday', startMinute: 1, endMinute: 0 },
				expected: [ { weekday: 'Monday', startMinute: 1, endMinute: 1_440 } ],
			},
		] )( 'accepts $label', ( { window, expected } ) => {
			expect( normalizeSchedule( { mode: 'custom', windows: [ window ] } ) ).toEqual( {
				mode: 'custom',
				windows: expected,
			} );
		} );

		it( 'canonicalizes a negative-zero start minute to positive zero', () => {
			expect(
				normalizeSchedule( {
					mode: 'custom',
					windows: [ { weekday: 'Monday', startMinute: -0, endMinute: 1 } ],
				} ),
			).toEqual( {
				mode: 'custom',
				windows: [ { weekday: 'Monday', startMinute: 0, endMinute: 1 } ],
			} );
		} );

		it( 'canonicalizes a negative-zero end minute to positive zero before normalization', () => {
			expect(
				normalizeSchedule( {
					mode: 'custom',
					windows: [ { weekday: 'Monday', startMinute: 1, endMinute: -0 } ],
				} ),
			).toEqual( {
				mode: 'custom',
				windows: [ { weekday: 'Monday', startMinute: 1, endMinute: 1_440 } ],
			} );
		} );

		it.each( [
			{ label: 'start below zero', field: 'startMinute', value: -1 },
			{ label: 'start at 1440', field: 'startMinute', value: 1_440 },
			{ label: 'fractional start', field: 'startMinute', value: 1.5 },
			{ label: 'NaN start', field: 'startMinute', value: Number.NaN },
			{ label: 'positive infinite start', field: 'startMinute', value: Number.POSITIVE_INFINITY },
			{ label: 'negative infinite start', field: 'startMinute', value: Number.NEGATIVE_INFINITY },
			{ label: 'end below zero', field: 'endMinute', value: -1 },
			{ label: 'end above 1440', field: 'endMinute', value: 1_441 },
			{ label: 'fractional end', field: 'endMinute', value: 1.5 },
			{ label: 'NaN end', field: 'endMinute', value: Number.NaN },
			{ label: 'positive infinite end', field: 'endMinute', value: Number.POSITIVE_INFINITY },
			{ label: 'negative infinite end', field: 'endMinute', value: Number.NEGATIVE_INFINITY },
		] )( 'rejects $label', ( { field, value } ) => {
			const window = {
				weekday: 'Monday',
				startMinute: 60,
				endMinute: 120,
				[ field ]: value,
			};

			expect( () => normalizeSchedule( { mode: 'custom', windows: [ window ] } ) ).toThrow( ZodError );
		} );
	} );

	describe( 'custom schedule validity', () => {
		it( 'rejects a custom schedule without windows', () => {
			expect( () => normalizeSchedule( { mode: 'custom', windows: [] } ) ).toThrow( ZodError );
		} );

		it.each( [ 0, 1, 720, 1_439 ] )( 'rejects equal endpoints at minute %i', ( minute ) => {
			expect( () =>
				normalizeSchedule( {
					mode: 'custom',
					windows: [ { weekday: 'Monday', startMinute: minute, endMinute: minute } ],
				} ),
			).toThrow( ZodError );
		} );

		it.each( [
			null,
			undefined,
			'always',
			[],
			{},
			{ mode: 'sometimes' },
			{ mode: 'always', windows: [] },
			{ mode: 'custom' },
			{ mode: 'custom', windows: 'Monday' },
			{ mode: 'custom', windows: [ null ] },
			{ mode: 'custom', windows: [ {} ] },
			{ mode: 'custom', windows: [ { weekday: 'monday', startMinute: 60, endMinute: 120 } ] },
			{ mode: 'custom', windows: [ { weekday: 'Funday', startMinute: 60, endMinute: 120 } ] },
			{ mode: 'custom', windows: [ { weekday: 'Monday', startMinute: 60 } ] },
			{ mode: 'custom', windows: [ { weekday: 'Monday', startMinute: 60, endMinute: 120, extra: true } ] },
		] )( 'rejects malformed schedule input %#', ( schedule ) => {
			expect( () => normalizeSchedule( schedule ) ).toThrow( ZodError );
		} );
	} );

	describe( 'overnight ranges', () => {
		it( 'splits an overnight range across the following weekday', () => {
			expect(
				normalizeSchedule( {
					mode: 'custom',
					windows: [ { weekday: 'Monday', startMinute: 1_380, endMinute: 90 } ],
				} ),
			).toEqual( {
				mode: 'custom',
				windows: [
					{ weekday: 'Monday', startMinute: 1_380, endMinute: 1_440 },
					{ weekday: 'Tuesday', startMinute: 0, endMinute: 90 },
				],
			} );
		} );

		it( 'rolls a Sunday overnight range into Monday', () => {
			expect(
				normalizeSchedule( {
					mode: 'custom',
					windows: [ { weekday: 'Sunday', startMinute: 1_380, endMinute: 60 } ],
				} ),
			).toEqual( {
				mode: 'custom',
				windows: [
					{ weekday: 'Monday', startMinute: 0, endMinute: 60 },
					{ weekday: 'Sunday', startMinute: 1_380, endMinute: 1_440 },
				],
			} );
		} );

		it( 'does not emit an empty next-day fragment for endMinute zero', () => {
			expect(
				normalizeSchedule( {
					mode: 'custom',
					windows: [ { weekday: 'Sunday', startMinute: 1_380, endMinute: 0 } ],
				} ),
			).toEqual( {
				mode: 'custom',
				windows: [ { weekday: 'Sunday', startMinute: 1_380, endMinute: 1_440 } ],
			} );
		} );
	} );

	describe( 'deterministic sorting and merging', () => {
		it( 'sorts windows by weekday and minute regardless of input order', () => {
			expect(
				normalizeSchedule( {
					mode: 'custom',
					windows: [
						{ weekday: 'Sunday', startMinute: 600, endMinute: 660 },
						{ weekday: 'Monday', startMinute: 720, endMinute: 780 },
						{ weekday: 'Monday', startMinute: 60, endMinute: 120 },
						{ weekday: 'Wednesday', startMinute: 300, endMinute: 360 },
					],
				} ),
			).toEqual( {
				mode: 'custom',
				windows: [
					{ weekday: 'Monday', startMinute: 60, endMinute: 120 },
					{ weekday: 'Monday', startMinute: 720, endMinute: 780 },
					{ weekday: 'Wednesday', startMinute: 300, endMinute: 360 },
					{ weekday: 'Sunday', startMinute: 600, endMinute: 660 },
				],
			} );
		} );

		it( 'merges duplicate and contained windows', () => {
			expect(
				normalizeSchedule( {
					mode: 'custom',
					windows: [
						{ weekday: 'Monday', startMinute: 60, endMinute: 300 },
						{ weekday: 'Monday', startMinute: 60, endMinute: 300 },
						{ weekday: 'Monday', startMinute: 120, endMinute: 180 },
					],
				} ),
			).toEqual( {
				mode: 'custom',
				windows: [ { weekday: 'Monday', startMinute: 60, endMinute: 300 } ],
			} );
		} );

		it( 'merges overlapping windows', () => {
			expect(
				normalizeSchedule( {
					mode: 'custom',
					windows: [
						{ weekday: 'Monday', startMinute: 60, endMinute: 180 },
						{ weekday: 'Monday', startMinute: 120, endMinute: 240 },
					],
				} ),
			).toEqual( {
				mode: 'custom',
				windows: [ { weekday: 'Monday', startMinute: 60, endMinute: 240 } ],
			} );
		} );

		it( 'merges adjacent windows', () => {
			expect(
				normalizeSchedule( {
					mode: 'custom',
					windows: [
						{ weekday: 'Monday', startMinute: 60, endMinute: 120 },
						{ weekday: 'Monday', startMinute: 120, endMinute: 180 },
					],
				} ),
			).toEqual( {
				mode: 'custom',
				windows: [ { weekday: 'Monday', startMinute: 60, endMinute: 180 } ],
			} );
		} );

		it( 'merges a transitive chain of overlap and adjacency', () => {
			expect(
				normalizeSchedule( {
					mode: 'custom',
					windows: [
						{ weekday: 'Monday', startMinute: 240, endMinute: 360 },
						{ weekday: 'Monday', startMinute: 60, endMinute: 180 },
						{ weekday: 'Monday', startMinute: 180, endMinute: 300 },
					],
				} ),
			).toEqual( {
				mode: 'custom',
				windows: [ { weekday: 'Monday', startMinute: 60, endMinute: 360 } ],
			} );
		} );

		it.each( [
			{ windows: [
				{ weekday: 'Monday', startMinute: 60, endMinute: 180 },
				{ weekday: 'Monday', startMinute: 120, endMinute: 240 },
				{ weekday: 'Monday', startMinute: 240, endMinute: 300 },
			] },
			{ windows: [
				{ weekday: 'Monday', startMinute: 240, endMinute: 300 },
				{ weekday: 'Monday', startMinute: 60, endMinute: 180 },
				{ weekday: 'Monday', startMinute: 120, endMinute: 240 },
			] },
			{ windows: [
				{ weekday: 'Monday', startMinute: 120, endMinute: 240 },
				{ weekday: 'Monday', startMinute: 240, endMinute: 300 },
				{ weekday: 'Monday', startMinute: 60, endMinute: 180 },
			] },
		] )( 'produces the same canonical result for permutation %#', ( { windows } ) => {
			expect( normalizeSchedule( { mode: 'custom', windows } ) ).toEqual( {
				mode: 'custom',
				windows: [ { weekday: 'Monday', startMinute: 60, endMinute: 300 } ],
			} );
		} );

		it( 'merges split overnight fragments with existing next-day windows', () => {
			expect(
				normalizeSchedule( {
					mode: 'custom',
					windows: [
						{ weekday: 'Monday', startMinute: 1_380, endMinute: 60 },
						{ weekday: 'Tuesday', startMinute: 30, endMinute: 120 },
					],
				} ),
			).toEqual( {
				mode: 'custom',
				windows: [
					{ weekday: 'Monday', startMinute: 1_380, endMinute: 1_440 },
					{ weekday: 'Tuesday', startMinute: 0, endMinute: 120 },
				],
			} );
		} );
	} );

	describe( 'idempotence and immutability', () => {
		it( 'is idempotent for an already normalized schedule', () => {
			const normalized = {
				mode: 'custom',
				windows: [
					{ weekday: 'Monday', startMinute: 60, endMinute: 120 },
					{ weekday: 'Sunday', startMinute: 1_380, endMinute: 1_440 },
				],
			};
			const expected = {
				mode: 'custom',
				windows: [
					{ weekday: 'Monday', startMinute: 60, endMinute: 120 },
					{ weekday: 'Sunday', startMinute: 1_380, endMinute: 1_440 },
				],
			};
			const firstNormalization = normalizeSchedule( normalized );

			expect( firstNormalization ).toEqual( expected );
			expect( normalizeSchedule( firstNormalization ) ).toEqual( expected );
		} );

		it( 'does not mutate a deeply frozen schedule', () => {
			const monday = Object.freeze( { weekday: 'Monday', startMinute: 600, endMinute: 720 } );
			const tuesday = Object.freeze( { weekday: 'Tuesday', startMinute: 1_380, endMinute: 60 } );
			const windows = Object.freeze( [ monday, tuesday ] );
			const schedule = Object.freeze( { mode: 'custom', windows } );

			expect( () => normalizeSchedule( schedule ) ).not.toThrow();
			expect( schedule ).toEqual( {
				mode: 'custom',
				windows: [
					{ weekday: 'Monday', startMinute: 600, endMinute: 720 },
					{ weekday: 'Tuesday', startMinute: 1_380, endMinute: 60 },
				],
			} );
		} );
	} );
} );
