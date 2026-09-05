import { describe, expect, it } from 'vitest';
import { createTestI18n } from '../../__fixtures__';
import { createLocalizationFormatters } from '../create-localization-formatters';
import { createProtectedSitesCopy } from './index';

describe( 'createProtectedSitesCopy', () => {
	it( 'creates protected-sites copy and dynamic announcements', () => {
		const copy = createProtectedSitesCopy( createTestI18n(), createLocalizationFormatters( 'en' ) );

		expect( copy.title ).toBe( 'Websites' );
		expect( copy.addSite ).toBe( 'Add a pause here' );
		expect( copy.sharedBehavior ).toBe( 'Shared timing' );
		expect( copy.independentBehavior ).toBe( 'Give this website its own timing' );
		expect( copy.alreadyProtectedError ).toBe( 'This website is already on your list.' );
		expect( copy.formatAddedAnnouncement( 'Reddit' ) ).toBe( 'Reddit was added to your list.' );
		expect( copy.formatUpdatedAnnouncement( 'Reddit' ) ).toBe( 'Reddit was updated.' );
		expect( copy.formatRemovedAnnouncement( 'Reddit' ) ).toBe( 'Reddit was removed from your list.' );
		expect( copy.formatPermissionRetainedAnnouncement( 'Reddit' ) ).toContain( 'browser access' );
		expect( copy.formatAccessRestoredAnnouncement( 'Reddit' ) ).toBe( 'Reddit access was restored.' );
	} );
} );
