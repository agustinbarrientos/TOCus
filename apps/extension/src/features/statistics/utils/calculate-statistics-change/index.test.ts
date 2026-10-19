import { describe, expect, it } from 'vitest';
import { calculateStatisticsChange } from './index';

describe( 'calculateStatisticsChange', () => {
	it.each( [
		[ 15, 10, { direction: 'up', difference: 5, percentage: 50 } ],
		[ 5, 10, { direction: 'down', difference: 5, percentage: 50 } ],
		[ 10, 10, { direction: 'same', difference: 0, percentage: 0 } ],
		[ 1, 3, { direction: 'down', difference: 2, percentage: 67 } ],
		[ 4, 3, { direction: 'up', difference: 1, percentage: 33 } ],
		[ 5, 0, { direction: 'up', difference: 5, percentage: null } ],
		[ 0, 5, { direction: 'down', difference: 5, percentage: 100 } ],
		[ 1_001, 1_000, { direction: 'up', difference: 1, percentage: null } ],
		[ 999, 1_000, { direction: 'down', difference: 1, percentage: null } ],
		[ Number.MAX_SAFE_INTEGER, 1, { direction: 'up', difference: Number.MAX_SAFE_INTEGER - 1,
			percentage: ( Number.MAX_SAFE_INTEGER - 1 ) * 100 } ],
		[ Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 1,
			{ direction: 'up', difference: 1, percentage: null } ],
	] )( 'describes the change from %s compared with %s', ( current, previous, expected ) => {
		expect( calculateStatisticsChange( current, previous ) ).toEqual( expected );
	} );
	it( 'omits a change when both known periods have zero activity', () => {
		expect( calculateStatisticsChange( 0, 0 ) ).toBeNull();
	} );
} );
