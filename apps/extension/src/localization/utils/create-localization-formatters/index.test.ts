import { describe, expect, it } from 'vitest';
import { createLocalizationFormatters } from './index';

describe( 'createLocalizationFormatters', () => {
	it( 'creates locale-sensitive number, list, and collation formatters', () => {
		const formatters = createLocalizationFormatters( 'de' );

		expect( formatters.number.format( 1_234 ) ).toBe( '1.234' );
		expect( formatters.list.format( [ '1 Stunde', '5 Minuten' ] ) ).toBe( '1 Stunde, 5 Minuten' );
		expect( formatters.collator.compare( 'a', 'b' ) ).toBeLessThan( 0 );
	} );
} );
