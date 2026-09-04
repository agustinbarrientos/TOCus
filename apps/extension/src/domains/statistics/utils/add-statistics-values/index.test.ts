import { describe, expect, it } from 'vitest';
import { addStatisticsValues } from './index';

describe( 'addStatisticsValues', () => {
	it( 'adds non-negative safe integer statistics values', () => {
		expect( addStatisticsValues( 10, 20 ) ).toBe( 30 );
		expect( addStatisticsValues( Number.MAX_SAFE_INTEGER, 0 ) ).toBe( Number.MAX_SAFE_INTEGER );
	} );

	it( 'rejects an unsafe sum', () => {
		expect( () => addStatisticsValues( Number.MAX_SAFE_INTEGER, 1 ) ).toThrow( RangeError );
	} );

	it( 'rejects a negative sum', () => {
		expect( () => addStatisticsValues( 0, -1 ) ).toThrow( RangeError );
	} );

	it( 'rejects invalid operands even when their sum would be valid', () => {
		expect( () => addStatisticsValues( -1, 2 ) ).toThrow( RangeError );
		expect( () => addStatisticsValues( Number.MAX_SAFE_INTEGER + 1, -1 ) ).toThrow( RangeError );
	} );
} );
