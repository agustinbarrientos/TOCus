import { describe, expect, it } from 'vitest';
import { calculateAllowanceWarningInterval } from './index';

const EXPIRY_EPOCH_MILLISECONDS = 305_000;
const WARNING_START_EPOCH_MILLISECONDS = 295_000;

describe( 'calculateAllowanceWarningInterval', () => {
	it( 'returns the complete warning window for an Always schedule', () => {
		expect( calculateAllowanceWarningInterval(
			{ mode: 'always' },
			EXPIRY_EPOCH_MILLISECONDS,
			'UTC',
		) ).toEqual( {
			startsAtEpochMilliseconds: WARNING_START_EPOCH_MILLISECONDS,
			endsAtEpochMilliseconds: EXPIRY_EPOCH_MILLISECONDS,
		} );
	} );

	it( 'bounds an active warning by the custom schedule end', () => {
		expect( calculateAllowanceWarningInterval( {
			mode: 'custom',
			windows: [ { weekday: 'Thursday', startMinute: 0, endMinute: 5 } ],
		}, EXPIRY_EPOCH_MILLISECONDS, 'UTC' ) ).toEqual( {
			startsAtEpochMilliseconds: WARNING_START_EPOCH_MILLISECONDS,
			endsAtEpochMilliseconds: 300_000,
		} );
	} );

	it( 'starts an inactive warning at the custom schedule start', () => {
		expect( calculateAllowanceWarningInterval( {
			mode: 'custom',
			windows: [ { weekday: 'Thursday', startMinute: 5, endMinute: 6 } ],
		}, EXPIRY_EPOCH_MILLISECONDS, 'UTC' ) ).toEqual( {
			startsAtEpochMilliseconds: 300_000,
			endsAtEpochMilliseconds: EXPIRY_EPOCH_MILLISECONDS,
		} );
	} );

	it( 'returns the complete window when an active custom schedule transitions after expiry', () => {
		expect( calculateAllowanceWarningInterval( {
			mode: 'custom',
			windows: [ { weekday: 'Thursday', startMinute: 0, endMinute: 6 } ],
		}, EXPIRY_EPOCH_MILLISECONDS, 'UTC' ) ).toEqual( {
			startsAtEpochMilliseconds: WARNING_START_EPOCH_MILLISECONDS,
			endsAtEpochMilliseconds: EXPIRY_EPOCH_MILLISECONDS,
		} );
	} );

	it( 'returns null when the schedule stays inactive through expiry', () => {
		expect( calculateAllowanceWarningInterval( {
			mode: 'custom',
			windows: [ { weekday: 'Friday', startMinute: 0, endMinute: 60 } ],
		}, EXPIRY_EPOCH_MILLISECONDS, 'UTC' ) ).toBeNull();
	} );

	it( 'returns null when the time zone cannot be evaluated safely', () => {
		expect( calculateAllowanceWarningInterval(
			{ mode: 'always' },
			EXPIRY_EPOCH_MILLISECONDS,
			'Not/A_Zone',
		) ).toBeNull();
	} );

	it( 'clamps the warning start at the epoch boundary', () => {
		expect( calculateAllowanceWarningInterval( { mode: 'always' }, 5_000, 'UTC' ) ).toEqual( {
			startsAtEpochMilliseconds: 0,
			endsAtEpochMilliseconds: 5_000,
		} );
	} );

	it.each( [ null, undefined, {}, { mode: 'custom', windows: [] } ] )(
		'rejects malformed schedule input %#',
		( schedule ) => {
			expect( () => calculateAllowanceWarningInterval(
				schedule,
				EXPIRY_EPOCH_MILLISECONDS,
				'UTC',
			) ).toThrow();
		},
	);

	it.each( [ null, undefined, -1, 1.5, Number.NaN ] )(
		'rejects malformed expiry input %#',
		( expiry ) => {
			expect( () => calculateAllowanceWarningInterval(
				{ mode: 'always' },
				expiry,
				'UTC',
			) ).toThrow();
		},
	);
} );
