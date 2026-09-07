import { describe, expect, it } from 'vitest';
import { ScheduleMode, Weekday } from '../../../../domains/protection/types/protection-schedule';
import { blankWindow, endMinute, fromSchedule, parseTime, schedulesEqual, windowErrors } from './index';
import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';

describe( 'Schedule draft conversion', () => {
	it( 'preserves partial editable drafts and reports required or equal-time errors', () => {
		const blank = blankWindow( 0 );
		const incomplete = { mode: ScheduleMode.CUSTOM, windows: [ blank ] };
		expect( schedulesEqual( incomplete, incomplete ) ).toBe( true );
		expect( schedulesEqual( incomplete, { ...incomplete, windows: [ { ...blank, start: '09:00' } ] } ) ).toBe( false );
		const copy = TestEnglishLocalizationBundle.schedule;
		expect( windowErrors( blank, copy ) ).toEqual( {
			start: copy.startTimeRequiredError, end: copy.endTimeRequiredError,
		} );
		expect( windowErrors( { ...blank, start: '09:00', end: '09:00' }, copy ) ).toEqual( {
			start: null, end: copy.equalTimeError,
		} );
		expect( windowErrors( { ...blank, start: '09:00', end: '10:00' }, copy ) ).toEqual( { start: null, end: null } );
	} );
	it( 'projects always-on and ordinary persisted intervals without full-day flags', () => {
		expect( fromSchedule( { mode: ScheduleMode.ALWAYS } ) ).toEqual( { mode: ScheduleMode.ALWAYS, windows: [] } );
		const draft = fromSchedule( { mode: ScheduleMode.CUSTOM, windows: [
			{ weekday: Weekday.MONDAY, startMinute: 0, endMinute: 60 },
			{ weekday: Weekday.TUESDAY, startMinute: 90, endMinute: 120 },
		] } );
		expect( draft.windows ).toEqual( [
			{ id: 0, weekday: Weekday.MONDAY, start: '00:00', end: '01:00', fullDay: false },
			{ id: 1, weekday: Weekday.TUESDAY, start: '01:30', end: '02:00', fullDay: false },
		] );
		expect( endMinute( { ...blankWindow( 0 ), fullDay: true, end: '01:00' } ) ).toBe( 60 );
	} );
	it( 'compares effective protection rather than inactive windows or presentation row identifiers', () => {
		expect( schedulesEqual( { mode: ScheduleMode.ALWAYS, windows: [] },
			{ mode: ScheduleMode.ALWAYS, windows: [ blankWindow( 0 ) ] } ) ).toBe( true );
		const window = { ...blankWindow( 0 ), start: '09:00', end: '10:00' };
		expect( schedulesEqual( { mode: ScheduleMode.CUSTOM, windows: [ window ] },
			{ mode: ScheduleMode.CUSTOM, windows: [ { ...window, id: 5 } ] } ) ).toBe( true );
	} );
	it( 'parses only complete local times without accepting invalid browser-independent input', () => {
		expect( parseTime( '23:59' ) ).toBe( 1439 );
		expect( parseTime( '00:00' ) ).toBe( 0 );
		for ( const input of [ '', '24:00', '12:60', '2:30', 'not a time', '12:' ] ) {
			expect( parseTime( input ) ).toBeNull();
		}
	} );
	it( 'preserves an authoritative full-day endpoint while another field changes', () => {
		const draft = fromSchedule( { mode: ScheduleMode.CUSTOM, windows: [ {
			weekday: Weekday.MONDAY, startMinute: 0, endMinute: 1440,
		} ] } );
		const window = draft.windows[ 0 ];
		if ( ! window ) {
			throw new Error( 'Expected one persisted window' );
		}
		expect( endMinute( { ...window, weekday: Weekday.TUESDAY } ) ).toBe( 1440 );
		expect( endMinute( { ...window, fullDay: false } ) ).toBe( 0 );
	} );
} );
