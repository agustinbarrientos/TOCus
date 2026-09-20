import { describe, expect, it } from 'vitest';
import { ScheduleMode, Weekday } from '../../../../domains/protection/types/protection-schedule';
import { ScheduleEvaluationStatus } from '../../../../domains/protection/types/schedule-evaluation';
import { evaluateSchedule } from '../../../../domains/protection/utils/schedule-evaluator';
import { toSchedule } from '../schedule-draft';
import { createSchedulePresetWindows } from './index';
import { SchedulePreset } from './types';

describe( 'Schedule presets', () => {
	it.each( [
		{
			preset: SchedulePreset.WEEKDAYS_WORKING_HOURS,
			windows: [
				{ id: 0, weekday: Weekday.MONDAY, start: '09:00', end: '17:00', fullDay: false },
				{ id: 1, weekday: Weekday.TUESDAY, start: '09:00', end: '17:00', fullDay: false },
				{ id: 2, weekday: Weekday.WEDNESDAY, start: '09:00', end: '17:00', fullDay: false },
				{ id: 3, weekday: Weekday.THURSDAY, start: '09:00', end: '17:00', fullDay: false },
				{ id: 4, weekday: Weekday.FRIDAY, start: '09:00', end: '17:00', fullDay: false },
			],
		},
		{
			preset: SchedulePreset.WEEKDAYS_ALL_DAY,
			windows: [
				{ id: 0, weekday: Weekday.MONDAY, start: '00:00', end: '00:00', fullDay: true },
				{ id: 1, weekday: Weekday.TUESDAY, start: '00:00', end: '00:00', fullDay: true },
				{ id: 2, weekday: Weekday.WEDNESDAY, start: '00:00', end: '00:00', fullDay: true },
				{ id: 3, weekday: Weekday.THURSDAY, start: '00:00', end: '00:00', fullDay: true },
				{ id: 4, weekday: Weekday.FRIDAY, start: '00:00', end: '00:00', fullDay: true },
			],
		},
		{
			preset: SchedulePreset.WEEKENDS_ALL_DAY,
			windows: [
				{ id: 0, weekday: Weekday.SATURDAY, start: '00:00', end: '00:00', fullDay: true },
				{ id: 1, weekday: Weekday.SUNDAY, start: '00:00', end: '00:00', fullDay: true },
			],
		},
	] )( 'creates editable replacement windows for $preset', ( { preset, windows } ) => {
		expect( createSchedulePresetWindows( preset ) ).toEqual( windows );
	} );

	it( 'keeps editing one preset application from changing another application', () => {
		const first = createSchedulePresetWindows( SchedulePreset.WEEKDAYS_WORKING_HOURS );
		const second = createSchedulePresetWindows( SchedulePreset.WEEKDAYS_WORKING_HOURS );
		const firstWindow = first[ 0 ];
		if ( ! firstWindow ) {
			throw new Error( 'Expected a Monday working-hours window' );
		}

		firstWindow.start = '10:00';
		first.splice( 1 );

		expect( second ).toHaveLength( 5 );
		expect( second[ 0 ] ).toEqual( {
			id: 0, weekday: Weekday.MONDAY, start: '09:00', end: '17:00', fullDay: false,
		} );
	} );

	it.each( [
		{
			preset: SchedulePreset.WEEKDAYS_WORKING_HOURS,
			instant: '2024-01-01T08:59:59.999Z', status: ScheduleEvaluationStatus.INACTIVE,
		},
		{
			preset: SchedulePreset.WEEKDAYS_WORKING_HOURS,
			instant: '2024-01-01T09:00:00.000Z', status: ScheduleEvaluationStatus.ACTIVE,
		},
		{
			preset: SchedulePreset.WEEKDAYS_WORKING_HOURS,
			instant: '2024-01-05T16:59:59.999Z', status: ScheduleEvaluationStatus.ACTIVE,
		},
		{
			preset: SchedulePreset.WEEKDAYS_WORKING_HOURS,
			instant: '2024-01-05T17:00:00.000Z', status: ScheduleEvaluationStatus.INACTIVE,
		},
		{
			preset: SchedulePreset.WEEKDAYS_ALL_DAY,
			instant: '2024-01-01T00:00:00.000Z', status: ScheduleEvaluationStatus.ACTIVE,
		},
		{
			preset: SchedulePreset.WEEKDAYS_ALL_DAY,
			instant: '2024-01-05T23:59:59.999Z', status: ScheduleEvaluationStatus.ACTIVE,
		},
		{
			preset: SchedulePreset.WEEKDAYS_ALL_DAY,
			instant: '2024-01-06T00:00:00.000Z', status: ScheduleEvaluationStatus.INACTIVE,
		},
		{
			preset: SchedulePreset.WEEKENDS_ALL_DAY,
			instant: '2024-01-05T23:59:59.999Z', status: ScheduleEvaluationStatus.INACTIVE,
		},
		{
			preset: SchedulePreset.WEEKENDS_ALL_DAY,
			instant: '2024-01-06T00:00:00.000Z', status: ScheduleEvaluationStatus.ACTIVE,
		},
		{
			preset: SchedulePreset.WEEKENDS_ALL_DAY,
			instant: '2024-01-07T23:59:59.999Z', status: ScheduleEvaluationStatus.ACTIVE,
		},
		{
			preset: SchedulePreset.WEEKENDS_ALL_DAY,
			instant: '2024-01-08T00:00:00.000Z', status: ScheduleEvaluationStatus.INACTIVE,
		},
	] )( 'persists $preset as $status at $instant', ( { preset, instant, status } ) => {
		const schedule = toSchedule( {
			mode: ScheduleMode.CUSTOM,
			windows: createSchedulePresetWindows( preset ),
		} );

		expect( evaluateSchedule( schedule, Date.parse( instant ), 'UTC' ) ).toEqual( { status } );
	} );
} );
