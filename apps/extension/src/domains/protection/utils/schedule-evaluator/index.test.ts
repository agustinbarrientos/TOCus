import { ZodError } from 'zod';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { evaluateSchedule, getNextScheduleTransitionDeadline } from './index';

const MONDAY_MIDNIGHT_NEW_YORK = 1_704_085_200_000;
const MONDAY_UTC_0030 = 1_704_069_000_000;
const MONDAY_UTC_BEFORE_1000 = 1_704_103_199_999;
const MONDAY_UTC_1000 = 1_704_103_200_000;
const MONDAY_UTC_BEFORE_1100 = 1_704_106_799_999;
const MONDAY_UTC_1100 = 1_704_106_800_000;
const MONDAY_UTC_END_OF_DAY = 1_704_153_599_999;
const TUESDAY_UTC_MIDNIGHT = 1_704_153_600_000;
const SUNDAY_UTC_2330 = 1_704_670_200_000;
const MONDAY_UTC_0030_AFTER_SUNDAY = 1_704_673_800_000;
const MONDAY_UTC_0100_AFTER_SUNDAY = 1_704_675_600_000;
const SPRING_FORWARD_BEFORE_GAP = 1_710_053_999_999;
const SPRING_FORWARD_AFTER_GAP = 1_710_054_000_000;
const SPRING_FORWARD_0330 = 1_710_055_800_000;
const FALL_BACK_FIRST_0115 = 1_730_610_900_000;
const FALL_BACK_SECOND_0115 = 1_730_614_500_000;
const FALL_BACK_FIRST_0130 = 1_730_611_800_000;
const FALL_BACK_SECOND_0130 = 1_730_615_400_000;
const FALL_BACK_0200 = 1_730_617_200_000;
const MAXIMUM_DATE_EPOCH_MILLISECONDS = 8_640_000_000_000_000;
const SPRING_FORWARD_SECOND_SUNDAY_0210 = 1_710_655_800_000;
const FALL_BACK_FIRST_0145 = 1_730_612_700_000;
const FALL_BACK_SECOND_0100 = 1_730_613_600_000;

afterEach( () => {
	vi.restoreAllMocks();
} );

describe( 'evaluateSchedule', () => {
	describe( 'Always schedules and public-boundary validation', () => {
		it( 'returns active for a valid Always schedule', () => {
			expect( evaluateSchedule( { mode: 'always' }, 0, 'UTC' ) ).toEqual( { status: 'active' } );
		} );

		it( 'validates the instant before taking the Always shortcut', () => {
			expect( () => evaluateSchedule( { mode: 'always' }, Number.NaN, 'UTC' ) ).toThrow( ZodError );
		} );

		it( 'validates the time zone before taking the Always shortcut', () => {
			expect( evaluateSchedule( { mode: 'always' }, 0, 'Not/A_Zone' ) ).toEqual( {
				status: 'error',
				reason: 'invalid-time-zone',
			} );
		} );

		it( 'reports schedule validation before instant or time-zone failures', () => {
			expect( () => evaluateSchedule( { mode: 'sometimes' }, Number.NaN, '+01:00' ) ).toThrow( ZodError );
		} );

		it( 'reports instant validation before a time-zone failure', () => {
			expect( () => evaluateSchedule( { mode: 'always' }, Number.NaN, '+01:00' ) ).toThrow( ZodError );
		} );
	} );

	describe( 'inclusive start and exclusive end', () => {
		const schedule = {
			mode: 'custom',
			windows: [ { weekday: 'Monday', startMinute: 600, endMinute: 660 } ],
		};

		it( 'is inactive one millisecond before the start minute', () => {
			expect( evaluateSchedule( schedule, MONDAY_UTC_BEFORE_1000, 'UTC' ) ).toEqual( { status: 'inactive' } );
		} );

		it( 'includes the exact start instant', () => {
			expect( evaluateSchedule( schedule, MONDAY_UTC_1000, 'UTC' ) ).toEqual( { status: 'active' } );
		} );

		it( 'remains active through the final millisecond before the end minute', () => {
			expect( evaluateSchedule( schedule, MONDAY_UTC_BEFORE_1100, 'UTC' ) ).toEqual( { status: 'active' } );
		} );

		it( 'excludes the exact end instant', () => {
			expect( evaluateSchedule( schedule, MONDAY_UTC_1100, 'UTC' ) ).toEqual( { status: 'inactive' } );
		} );
	} );

	describe( 'weekday boundaries', () => {
		const schedule = {
			mode: 'custom',
			windows: [
				{ weekday: 'Monday', startMinute: 0, endMinute: 60 },
				{ weekday: 'Sunday', startMinute: 1_380, endMinute: 1_440 },
			],
		};

		it( 'evaluates the Sunday portion of an overnight range', () => {
			expect( evaluateSchedule( schedule, SUNDAY_UTC_2330, 'UTC' ) ).toEqual( { status: 'active' } );
		} );

		it( 'evaluates the Monday portion after Sunday rollover', () => {
			expect( evaluateSchedule( schedule, MONDAY_UTC_0030_AFTER_SUNDAY, 'UTC' ) ).toEqual( {
				status: 'active',
			} );
		} );

		it( 'uses an exclusive end after Sunday rollover', () => {
			expect( evaluateSchedule( schedule, MONDAY_UTC_0100_AFTER_SUNDAY, 'UTC' ) ).toEqual( {
				status: 'inactive',
			} );
		} );

		it( 'keeps a full day active through its final millisecond and ends it at next-day midnight', () => {
			const fullMonday = {
				mode: 'custom',
				windows: [ { weekday: 'Monday', startMinute: 0, endMinute: 1_440 } ],
			};

			expect( evaluateSchedule( fullMonday, MONDAY_UTC_END_OF_DAY, 'UTC' ) ).toEqual( { status: 'active' } );
			expect( evaluateSchedule( fullMonday, TUESDAY_UTC_MIDNIGHT, 'UTC' ) ).toEqual( { status: 'inactive' } );
		} );
	} );

	describe( 'deterministic local-time formatting', () => {
		it( 'uses h23 so local midnight is minute zero on the formatted weekday', () => {
			const mondaySchedule = {
				mode: 'custom',
				windows: [ { weekday: 'Monday', startMinute: 0, endMinute: 1 } ],
			};
			const sundaySchedule = {
				mode: 'custom',
				windows: [ { weekday: 'Sunday', startMinute: 1_439, endMinute: 1_440 } ],
			};

			expect( evaluateSchedule( mondaySchedule, MONDAY_MIDNIGHT_NEW_YORK, 'America/New_York' ) ).toEqual( {
				status: 'active',
			} );
			expect( evaluateSchedule( sundaySchedule, MONDAY_MIDNIGHT_NEW_YORK, 'America/New_York' ) ).toEqual( {
				status: 'inactive',
			} );
		} );

		it( 'pins the ISO calendar, Latin digits, long weekday, two-digit time, and h23 options', () => {
			const NativeDateTimeFormat = Intl.DateTimeFormat;
			const formatterSpy = vi.spyOn( Intl, 'DateTimeFormat' ).mockImplementation(
				/**
				 * Creates a native formatter while retaining a named constructor-compatible test double.
				 * @param locales - Requested locales.
				 * @param options - Requested date-time format options.
				 * @return Native date-time formatter.
				 */
				function DateTimeFormat( locales, options ) {
					return new NativeDateTimeFormat( locales, options );
				},
			);
			const schedule = {
				mode: 'custom',
				windows: [ { weekday: 'Monday', startMinute: 0, endMinute: 1 } ],
			};

			expect( evaluateSchedule( schedule, 1_704_067_200_000, 'UTC' ) ).toEqual( { status: 'active' } );
			expect( formatterSpy ).toHaveBeenCalledWith( 'en-US-u-ca-iso8601-nu-latn', {
				calendar: 'iso8601',
				numberingSystem: 'latn',
				weekday: 'long',
				hour: '2-digit',
				minute: '2-digit',
				hourCycle: 'h23',
				timeZone: 'UTC',
			} );
		} );

		it( 'evaluates the same instant independently in each explicit time zone', () => {
			const schedule = {
				mode: 'custom',
				windows: [ { weekday: 'Monday', startMinute: 540, endMinute: 600 } ],
			};

			expect( evaluateSchedule( schedule, MONDAY_UTC_0030, 'Asia/Tokyo' ) ).toEqual( { status: 'active' } );
			expect( evaluateSchedule( schedule, MONDAY_UTC_0030, 'UTC' ) ).toEqual( { status: 'inactive' } );
			expect( evaluateSchedule( schedule, MONDAY_UTC_0030, 'America/Los_Angeles' ) ).toEqual( {
				status: 'inactive',
			} );
			expect( evaluateSchedule( schedule, MONDAY_UTC_0030, 'Asia/Tokyo' ) ).toEqual( { status: 'active' } );
		} );
	} );

	describe( 'daylight-saving transitions', () => {
		it( 'activates at the first real instant after a missing spring-forward start', () => {
			const schedule = {
				mode: 'custom',
				windows: [ { weekday: 'Sunday', startMinute: 150, endMinute: 240 } ],
			};

			expect( evaluateSchedule( schedule, SPRING_FORWARD_BEFORE_GAP, 'America/New_York' ) ).toEqual( {
				status: 'inactive',
			} );
			expect( evaluateSchedule( schedule, SPRING_FORWARD_AFTER_GAP, 'America/New_York' ) ).toEqual( {
				status: 'active',
			} );
		} );

		it( 'deactivates at the first real instant after a missing spring-forward end', () => {
			const schedule = {
				mode: 'custom',
				windows: [ { weekday: 'Sunday', startMinute: 60, endMinute: 150 } ],
			};

			expect( evaluateSchedule( schedule, SPRING_FORWARD_BEFORE_GAP, 'America/New_York' ) ).toEqual( {
				status: 'active',
			} );
			expect( evaluateSchedule( schedule, SPRING_FORWARD_AFTER_GAP, 'America/New_York' ) ).toEqual( {
				status: 'inactive',
			} );
		} );

		it( 'never activates a range wholly contained in the skipped spring-forward hour', () => {
			const schedule = {
				mode: 'custom',
				windows: [ { weekday: 'Sunday', startMinute: 130, endMinute: 170 } ],
			};

			expect( evaluateSchedule( schedule, SPRING_FORWARD_BEFORE_GAP, 'America/New_York' ) ).toEqual( {
				status: 'inactive',
			} );
			expect( evaluateSchedule( schedule, SPRING_FORWARD_AFTER_GAP, 'America/New_York' ) ).toEqual( {
				status: 'inactive',
			} );
			expect( evaluateSchedule( schedule, SPRING_FORWARD_0330, 'America/New_York' ) ).toEqual( {
				status: 'inactive',
			} );
		} );

		it( 'keeps both fall-back occurrences active when both wall times match', () => {
			const schedule = {
				mode: 'custom',
				windows: [ { weekday: 'Sunday', startMinute: 60, endMinute: 90 } ],
			};

			expect( evaluateSchedule( schedule, FALL_BACK_FIRST_0115, 'America/New_York' ) ).toEqual( {
				status: 'active',
			} );
			expect( evaluateSchedule( schedule, FALL_BACK_SECOND_0115, 'America/New_York' ) ).toEqual( {
				status: 'active',
			} );
		} );

		it( 'applies the exclusive end to both repeated fall-back occurrences', () => {
			const schedule = {
				mode: 'custom',
				windows: [ { weekday: 'Sunday', startMinute: 60, endMinute: 90 } ],
			};

			expect( evaluateSchedule( schedule, FALL_BACK_FIRST_0130, 'America/New_York' ) ).toEqual( {
				status: 'inactive',
			} );
			expect( evaluateSchedule( schedule, FALL_BACK_SECOND_0130, 'America/New_York' ) ).toEqual( {
				status: 'inactive',
			} );
			expect( evaluateSchedule( schedule, FALL_BACK_0200, 'America/New_York' ) ).toEqual( {
				status: 'inactive',
			} );
		} );
	} );

	describe( 'invalid normalized schedules and instants', () => {
		it.each( [
			null,
			undefined,
			{},
			{ mode: 'sometimes' },
			{ mode: 'always', extra: true },
			{ mode: 'custom', windows: [] },
			{ mode: 'custom', windows: [ { weekday: 'Monday', startMinute: 120, endMinute: 60 } ] },
			{ mode: 'custom', windows: [ { weekday: 'Monday', startMinute: 60, endMinute: 60 } ] },
			{
				mode: 'custom',
				windows: [
					{ weekday: 'Tuesday', startMinute: 60, endMinute: 120 },
					{ weekday: 'Monday', startMinute: 60, endMinute: 120 },
				],
			},
			{
				mode: 'custom',
				windows: [
					{ weekday: 'Monday', startMinute: 60, endMinute: 120 },
					{ weekday: 'Monday', startMinute: 120, endMinute: 180 },
				],
			},
			{
				mode: 'custom',
				windows: [
					{ weekday: 'Monday', startMinute: 60, endMinute: 180 },
					{ weekday: 'Monday', startMinute: 120, endMinute: 240 },
				],
			},
		] )( 'rejects non-normalized schedule input %#', ( schedule ) => {
			expect( () => evaluateSchedule( schedule, 0, 'UTC' ) ).toThrow( ZodError );
		} );

		it.each( [
			{ label: 'negative', instant: -1 },
			{ label: 'fractional', instant: 0.5 },
			{ label: 'NaN', instant: Number.NaN },
			{ label: 'positive infinity', instant: Number.POSITIVE_INFINITY },
			{ label: 'negative infinity', instant: Number.NEGATIVE_INFINITY },
			{ label: 'outside the Date range', instant: MAXIMUM_DATE_EPOCH_MILLISECONDS + 1 },
			{ label: 'a numeric string', instant: '0' },
			{ label: 'null', instant: null },
		] )( 'rejects a $label epoch instant', ( { instant } ) => {
			expect( () => evaluateSchedule( { mode: 'always' }, instant, 'UTC' ) ).toThrow( ZodError );
		} );

		it( 'accepts the final epoch representable by Date', () => {
			expect( evaluateSchedule( { mode: 'always' }, MAXIMUM_DATE_EPOCH_MILLISECONDS, 'UTC' ) ).toEqual( {
				status: 'active',
			} );
		} );

		it( 'evaluates a negative-zero instant at Unix epoch zero', () => {
			const schedule = {
				mode: 'custom',
				windows: [ { weekday: 'Thursday', startMinute: 0, endMinute: 1 } ],
			};

			expect( evaluateSchedule( schedule, -0, 'UTC' ) ).toEqual( { status: 'active' } );
		} );
	} );

	describe( 'invalid time zones', () => {
		it.each( [
			{ label: 'null', timeZone: null },
			{ label: 'undefined', timeZone: undefined },
			{ label: 'numeric', timeZone: 0 },
			{ label: 'empty', timeZone: '' },
			{ label: 'whitespace', timeZone: '   ' },
			{ label: 'unknown IANA name', timeZone: 'Not/A_Zone' },
			{ label: 'positive fixed offset', timeZone: '+01:00' },
			{ label: 'negative fixed offset', timeZone: '-05:30' },
		] )( 'returns the stable typed error for a $label time zone', ( { timeZone } ) => {
			expect( evaluateSchedule( { mode: 'always' }, 0, timeZone ) ).toEqual( {
				status: 'error',
				reason: 'invalid-time-zone',
			} );
		} );

		it( 'accepts a named IANA fixed-offset zone', () => {
			expect( evaluateSchedule( { mode: 'always' }, 0, 'Etc/GMT-1' ) ).toEqual( { status: 'active' } );
		} );
	} );

	describe( 'immutability', () => {
		it( 'does not mutate a deeply frozen normalized schedule', () => {
			const window = Object.freeze( { weekday: 'Monday', startMinute: 0, endMinute: 60 } );
			const windows = Object.freeze( [ window ] );
			const schedule = Object.freeze( { mode: 'custom', windows } );

			expect( () => evaluateSchedule( schedule, MONDAY_UTC_0030, 'UTC' ) ).not.toThrow();
			expect( schedule ).toEqual( {
				mode: 'custom',
				windows: [ { weekday: 'Monday', startMinute: 0, endMinute: 60 } ],
			} );
		} );
	} );
} );

describe( 'getNextScheduleTransitionDeadline', () => {
	it( 'finds the exact next start from a sub-minute instant', () => {
		expect( getNextScheduleTransitionDeadline( [ {
			mode: 'custom',
			windows: [ { weekday: 'Monday', startMinute: 600, endMinute: 660 } ],
		} ], MONDAY_UTC_BEFORE_1000 - 29_999, 'UTC' ) ).toBe( MONDAY_UTC_1000 );
	} );

	it( 'finds the exclusive end when the schedule is already active', () => {
		expect( getNextScheduleTransitionDeadline( [ {
			mode: 'custom',
			windows: [ { weekday: 'Monday', startMinute: 600, endMinute: 660 } ],
		} ], MONDAY_UTC_1000, 'UTC' ) ).toBe( MONDAY_UTC_1100 );
	} );

	it( 'selects the earliest transition across independent schedules', () => {
		expect( getNextScheduleTransitionDeadline( [
			{
				mode: 'custom',
				windows: [ { weekday: 'Monday', startMinute: 660, endMinute: 720 } ],
			},
			{
				mode: 'custom',
				windows: [ { weekday: 'Monday', startMinute: 600, endMinute: 660 } ],
			},
		], MONDAY_UTC_BEFORE_1000, 'UTC' ) ).toBe( MONDAY_UTC_1000 );
	} );

	it( 'returns null when every schedule is permanently active', () => {
		expect( getNextScheduleTransitionDeadline( [
			{ mode: 'always' },
			{
				mode: 'custom',
				windows: [
					{ weekday: 'Monday', startMinute: 0, endMinute: 1_440 },
					{ weekday: 'Tuesday', startMinute: 0, endMinute: 1_440 },
					{ weekday: 'Wednesday', startMinute: 0, endMinute: 1_440 },
					{ weekday: 'Thursday', startMinute: 0, endMinute: 1_440 },
					{ weekday: 'Friday', startMinute: 0, endMinute: 1_440 },
					{ weekday: 'Saturday', startMinute: 0, endMinute: 1_440 },
					{ weekday: 'Sunday', startMinute: 0, endMinute: 1_440 },
				],
			},
		], MONDAY_UTC_1000, 'UTC' ) ).toBeNull();
	} );

	it( 'returns null when the time zone is invalid', () => {
		expect( getNextScheduleTransitionDeadline( [ {
			mode: 'custom',
			windows: [ { weekday: 'Monday', startMinute: 600, endMinute: 660 } ],
		} ], MONDAY_UTC_1000, 'Not/A_Zone' ) ).toBeNull();
	} );

	it( 'returns null when the time-zone input is a fixed offset', () => {
		expect( getNextScheduleTransitionDeadline( [ {
			mode: 'custom',
			windows: [ { weekday: 'Monday', startMinute: 600, endMinute: 660 } ],
		} ], MONDAY_UTC_1000, '+01:00' ) ).toBeNull();
	} );

	it( 'finds the first real transition after a missing spring-forward start', () => {
		expect( getNextScheduleTransitionDeadline( [ {
			mode: 'custom',
			windows: [ { weekday: 'Sunday', startMinute: 150, endMinute: 240 } ],
		} ], SPRING_FORWARD_BEFORE_GAP, 'America/New_York' ) ).toBe( SPRING_FORWARD_AFTER_GAP );
	} );

	it( 'continues into the following week when a window is wholly skipped', () => {
		expect( getNextScheduleTransitionDeadline( [ {
			mode: 'custom',
			windows: [ { weekday: 'Sunday', startMinute: 130, endMinute: 170 } ],
		} ], SPRING_FORWARD_BEFORE_GAP, 'America/New_York' ) ).toBe( SPRING_FORWARD_SECOND_SUNDAY_0210 );
	} );

	it( 'finds the repeated fall-back activation caused by the clock rollback', () => {
		expect( getNextScheduleTransitionDeadline( [ {
			mode: 'custom',
			windows: [ { weekday: 'Sunday', startMinute: 60, endMinute: 90 } ],
		} ], FALL_BACK_FIRST_0145, 'America/New_York' ) ).toBe( FALL_BACK_SECOND_0100 );
	} );

	it( 'constructs one formatter for the complete multi-schedule scan', () => {
		const NativeDateTimeFormat = Intl.DateTimeFormat;
		const formatterSpy = vi.spyOn( Intl, 'DateTimeFormat' ).mockImplementation(
			/**
			 * Creates a native formatter while retaining a named constructor-compatible test double.
			 * @param locales - Requested locales.
			 * @param options - Requested date-time format options.
			 * @return Native date-time formatter.
			 */
			function DateTimeFormat( locales, options ) {
				return new NativeDateTimeFormat( locales, options );
			},
		);

		expect( getNextScheduleTransitionDeadline( [
			{
				mode: 'custom',
				windows: [ { weekday: 'Monday', startMinute: 600, endMinute: 660 } ],
			},
			{
				mode: 'custom',
				windows: [ { weekday: 'Tuesday', startMinute: 600, endMinute: 660 } ],
			},
		], MONDAY_UTC_BEFORE_1000, 'UTC' ) ).toBe( MONDAY_UTC_1000 );
		expect( formatterSpy ).toHaveBeenCalledOnce();
	} );

	it( 'formats each candidate instant once regardless of the schedule count', () => {
		const nativeFormatter = new Intl.DateTimeFormat( 'en-US-u-ca-iso8601-nu-latn', {
			calendar: 'iso8601',
			numberingSystem: 'latn',
			weekday: 'long',
			hour: '2-digit',
			minute: '2-digit',
			hourCycle: 'h23',
			timeZone: 'UTC',
		} );
		const formatToParts = vi.spyOn( nativeFormatter, 'formatToParts' );

		vi.spyOn( Intl, 'DateTimeFormat' ).mockImplementation(
			/**
			 * Returns one observable formatter for a bounded-work regression.
			 * @return Observable date-time formatter.
			 */
			function DateTimeFormat() {
				return nativeFormatter;
			},
		);
		const schedules = Array.from( { length: 1_000 }, () => ( {
			mode: 'custom' as const,
			windows: [ { weekday: 'Monday' as const, startMinute: 600, endMinute: 660 } ],
		} ) );

		expect( getNextScheduleTransitionDeadline(
			schedules,
			MONDAY_UTC_BEFORE_1000,
			'UTC',
		) ).toBe( MONDAY_UTC_1000 );
		expect( formatToParts.mock.calls.length ).toBeLessThan( 25 );
	} );

	it( 'locates a transition that occurs between absolute minute samples', () => {
		const syntheticFormatter = new Intl.DateTimeFormat( 'en-US', { timeZone: 'UTC' } );
		/**
		 * Formats one instant around the synthetic local transition.
		 * @param date - Candidate instant.
		 * @return Synthetic local weekday and time parts.
		 */
		function formatSyntheticTransition(
			date?: Parameters<Intl.DateTimeFormat[ 'formatToParts' ]>[ 0 ],
		): Intl.DateTimeFormatPart[] {
			const instant = Number( date );

			return [
				{ type: 'weekday', value: 'Monday' },
				{ type: 'hour', value: instant < 30_000 ? '09' : '10' },
				{ type: 'minute', value: instant < 30_000 ? '59' : '00' },
			];
		}
		vi.spyOn( syntheticFormatter, 'formatToParts' ).mockImplementation( formatSyntheticTransition );
		vi.spyOn( Intl, 'DateTimeFormat' ).mockImplementation(
			/**
			 * Returns a formatter with one synthetic sub-minute local transition.
			 * @return Synthetic date-time formatter.
			 */
			function DateTimeFormat() {
				return syntheticFormatter;
			},
		);

		expect( getNextScheduleTransitionDeadline( [ {
			mode: 'custom',
			windows: [ { weekday: 'Monday', startMinute: 600, endMinute: 660 } ],
		} ], 0, 'UTC' ) ).toBe( 30_000 );
	} );

	it( 'does not scan beyond the representable Date range', () => {
		expect( getNextScheduleTransitionDeadline( [ {
			mode: 'custom',
			windows: [ { weekday: 'Monday', startMinute: 600, endMinute: 660 } ],
		} ], MAXIMUM_DATE_EPOCH_MILLISECONDS, 'UTC' ) ).toBeNull();
	} );

	it( 'returns null when no transition exists before the Date range ends', () => {
		expect( getNextScheduleTransitionDeadline( [ {
			mode: 'custom',
			windows: [ { weekday: 'Monday', startMinute: 600, endMinute: 660 } ],
		} ], MAXIMUM_DATE_EPOCH_MILLISECONDS - 1, 'UTC' ) ).toBeNull();
	} );
} );
