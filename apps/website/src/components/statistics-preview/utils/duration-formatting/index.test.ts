import { describe, expect, it } from 'vitest';
import { formatSampleAxisDuration, formatSampleDuration } from './index';

describe( 'sample duration presentation', () => {
	it.each( [ [ 0, '0 minutes' ], [ 1_050_000, '18 minutes' ], [ 3_600_000, '1 hour' ],
		[ 7_020_000, '1 hour, 57 minutes' ] ] )( 'formats %d milliseconds as %s', ( milliseconds, expected ) => {
		expect( formatSampleDuration( milliseconds, 'en' ) ).toBe( expected );
	} );
	it.each( [ [ 0, '0s' ], [ 30_000, '30s' ], [ 90_000, '1.5m' ], [ 5_400_000, '1.5h' ] ] )(
		'labels arbitrary axis ticks with units: %d', ( milliseconds, expected ) => {
			expect( formatSampleAxisDuration( milliseconds, 'en' ) ).toBe( expected );
		},
	);
	it( 'localizes decimal axis labels', () => {
		expect( formatSampleAxisDuration( 90_000, 'es' ) ).toBe( '1,5min' );
	} );
} );
