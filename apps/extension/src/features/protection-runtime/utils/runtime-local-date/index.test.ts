import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRuntimeLocalDate } from './index';
import * as calendar from './index';

describe( 'createRuntimeLocalDate', () => {
	it.each( [
		[ '2026-01-01T00:00:00Z', 'UTC', 0 ],
		[ '2026-01-01T04:00:00Z', 'America/New_York', 23 ],
		[ '2026-03-08T07:30:00Z', 'America/New_York', 3 ],
		[ '2026-11-01T05:30:00Z', 'America/New_York', 1 ],
		[ '2026-11-01T06:30:00Z', 'America/New_York', 1 ],
	] )( 'captures local hour for %s in %s without reinterpreting a DST bucket', ( instant, zone, hour ) => {
		expect( calendar.createRuntimeLocalHour ).toBeTypeOf( 'function' );
		expect( calendar.createRuntimeLocalHour( Date.parse( instant ), zone ) ).toBe( hour );
	} );
	it.each( [ { parts: [] }, { parts: [ { type: 'hour', value: '24' } ] }, { parts: [ { type: 'hour', value: '-1' } ] },
		{ parts: [ { type: 'hour', value: '1.5' } ] } ] )( 'rejects invalid local hour formatter output %#', ( { parts } ) => {
		vi.spyOn( Intl.DateTimeFormat.prototype, 'formatToParts' ).mockReturnValue( parts as Intl.DateTimeFormatPart[] );
		expect( () => calendar.createRuntimeLocalHour( 0, 'UTC' ) ).toThrow( 'The local calendar hour could not be formatted.' );
	} );
	afterEach( () => {
		vi.restoreAllMocks();
	} );

	it( 'formats an instant in the supplied local time zone', () => {
		const instant = Date.parse( '2026-01-01T02:00:00.000Z' );

		expect( createRuntimeLocalDate( instant, 'UTC' ) ).toBe( '2026-01-01' );
		expect( createRuntimeLocalDate( instant, 'America/New_York' ) ).toBe( '2025-12-31' );
	} );

	it( 'rejects an invalid time zone', () => {
		expect( () => createRuntimeLocalDate( 0, 'Not/AZone' ) ).toThrow( RangeError );
	} );

	it( 'rejects an incomplete calendar-date representation', () => {
		vi.spyOn( Intl.DateTimeFormat.prototype, 'formatToParts' ).mockReturnValue( [] );

		expect( () => createRuntimeLocalDate( 0, 'UTC' ) ).toThrow(
			'The local calendar date could not be formatted.',
		);
	} );
} );
