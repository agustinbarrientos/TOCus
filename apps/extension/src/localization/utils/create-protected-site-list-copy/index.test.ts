import { describe, expect, it } from 'vitest';
import { createTestI18n } from '../../__fixtures__';
import { createLocalizationFormatters } from '../create-localization-formatters';
import { createProtectedSiteListCopy } from './index';

describe( 'createProtectedSiteListCopy', () => {
	it( 'creates protected-site list copy with locale collation', () => {
		const copy = createProtectedSiteListCopy( createTestI18n(), createLocalizationFormatters( 'en' ) );

		expect( copy.emptyTitle ).toBe( 'No websites yet' );
		expect( copy.sharedGroupTitle ).toBe( 'Shared timing' );
		expect( copy.compareNames( 'a', 'b' ) ).toBeLessThan( 0 );
	} );
} );
