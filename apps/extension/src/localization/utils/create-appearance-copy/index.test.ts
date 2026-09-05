import { describe, expect, it } from 'vitest';
import { createTestI18n } from '../../__fixtures__';
import { createAppearanceCopy } from './index';

describe( 'createAppearanceCopy', () => {
	it( 'creates appearance settings copy', () => {
		const copy = createAppearanceCopy( createTestI18n() );

		expect( copy.title ).toBe( 'Appearance' );
		expect( copy.paletteLabels.brown ).toBe( 'Brown' );
		expect( copy.themeOptions.system.label ).toBe( 'System' );
	} );
} );
