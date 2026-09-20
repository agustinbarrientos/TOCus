import { describe, expect, it } from 'vitest';
import { createTestI18n } from '../../__fixtures__';
import { createProtectedSiteItemCopy } from './index';

describe( 'createProtectedSiteItemCopy', () => {
	it( 'creates concise editing copy and a contextual removal question', () => {
		const copy = createProtectedSiteItemCopy( createTestI18n() );

		expect( copy.edit ).toBe( 'Change when TOCus pauses this site, or rename it' );
		expect( copy.customScheduleLabel ).toBe( 'Use custom schedule' );
		expect( copy.formatSelectSite( 'Chess.com' ) ).toBe( 'Select Chess.com' );
		expect( copy.formatRemoveQuestion( 'Reddit' ) ).toBe( 'Remove Reddit?' );
	} );
} );
