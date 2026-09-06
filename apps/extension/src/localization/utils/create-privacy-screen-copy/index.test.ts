import { describe, expect, it } from 'vitest';
import { createTestI18n } from '../../__fixtures__';
import { createPrivacyScreenCopy } from './index';

describe( 'createPrivacyScreenCopy', () => {
	it( 'explains the separate scope of statistics and full resets', () => {
		const copy = createPrivacyScreenCopy( createTestI18n() );
		expect( copy.title ).toBe( 'Privacy and local data' );
		expect( copy.statisticsDescription ).toContain( 'Your websites and settings stay the same' );
		expect( copy.allConfirmation ).toContain( 'Website access will be removed' );
		expect( copy.allConfirmation ).toContain( 'cannot be undone' );
		expect( Object.isFrozen( copy ) ).toBe( true );
	} );
} );
