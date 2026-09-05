import { describe, expect, it } from 'vitest';
import { isLocalizationReady } from './index';

describe( 'isLocalizationReady', () => {
	it( 'accepts complete localized values', () => {
		expect( isLocalizationReady( { title: 'TOCus' }, 'Ready' ) ).toBe( true );
	} );

	it.each( [ undefined, null ] )( 'rejects the missing localized value %s', ( missingValue ) => {
		expect( isLocalizationReady( { title: 'TOCus' }, missingValue ) ).toBe( false );
	} );
} );
