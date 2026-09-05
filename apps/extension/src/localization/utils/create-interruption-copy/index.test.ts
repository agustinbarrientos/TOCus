import { describe, expect, it } from 'vitest';
import { createTestI18n } from '../../__fixtures__';
import { createInterruptionCopy } from './index';

describe( 'createInterruptionCopy', () => {
	it( 'creates interruption copy and countdown grammar', () => {
		const copy = createInterruptionCopy( createTestI18n() );

		expect( copy.takeAMoment ).toBe( 'Take a moment' );
		expect( copy.formatRemainingTime( 1 ) ).toBe( '1s remaining' );
		expect( copy.formatRemainingTime( 2 ) ).toBe( '2s remaining' );
	} );
} );
