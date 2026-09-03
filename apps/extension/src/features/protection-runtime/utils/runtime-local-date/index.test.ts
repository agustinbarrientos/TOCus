import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRuntimeLocalDate } from './index';

describe( 'createRuntimeLocalDate', () => {
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
