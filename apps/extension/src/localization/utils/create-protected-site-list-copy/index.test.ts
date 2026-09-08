import { describe, expect, it } from 'vitest';
import { createTestI18n } from '../../__fixtures__';
import { createLocalizationFormatters } from '../create-localization-formatters';
import { createProtectedSiteListCopy } from './index';

describe( 'createProtectedSiteListCopy', () => {
	it( 'creates protected-site list copy with locale collation', () => {
		const copy = createProtectedSiteListCopy( createTestI18n(), createLocalizationFormatters( 'en' ) );

		expect( copy.emptyTitle ).toBe( 'No websites yet' );
		expect( copy.sharedGroupTitle ).toBe( 'One timer for these websites' );
		expect( copy.sharedGroupDescription ).toBe( 'These websites use the same timer.' );
		expect( copy.independentGroupDescription ).toBe( 'Each website has its own timer.' );
		expect( copy.compareNames( 'a', 'b' ) ).toBeLessThan( 0 );
	} );
} );
