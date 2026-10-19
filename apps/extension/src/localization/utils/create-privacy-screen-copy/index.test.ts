import { describe, expect, it } from 'vitest';
import { createTestI18n } from '../../__fixtures__';
import { createPrivacyScreenCopy } from './index';

describe( 'createPrivacyScreenCopy', () => {
	it( 'explains the separate scope of statistics and full resets', () => {
		const copy = createPrivacyScreenCopy( createTestI18n() );
		expect( copy.title ).toBe( 'Privacy' );
		expect( copy.statisticsPrivacy ).toContain( 'daily counts for each configured website' );
		expect( copy.statisticsPrivacy ).toContain( 'hourly counts of reconsidered visits' );
		expect( copy.statisticsPrivacy ).toContain( 'individual visit records' );
		expect( copy.offlinePrivacy ).toContain( 'not sent to the developer' );
		expect( copy.faviconPermission ).toBe( "Your browser tries to use website icons from its own cache whenever it can. Sometimes this doesn't work. I set it up this way to keep TOCus completely private and avoid connecting to any icon service." );
		expect( Object.isFrozen( copy ) ).toBe( true );
	} );
} );
