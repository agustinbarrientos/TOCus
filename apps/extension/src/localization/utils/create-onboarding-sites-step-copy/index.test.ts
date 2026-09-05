import { describe, expect, it } from 'vitest';
import { createTestI18n } from '../../__fixtures__';
import { createOnboardingSitesStepCopy } from './index';

describe( 'createOnboardingSitesStepCopy', () => {
	it( 'creates onboarding site-selection copy and announcements', () => {
		const copy = createOnboardingSitesStepCopy( createTestI18n() );

		expect( copy.formatAddSuggestionLabel( 'Instagram' ) ).toBe( 'Add Instagram' );
		expect( copy.formatAddingSuggestionLabel( 'Instagram' ) ).toBe( 'Adding Instagram...' );
		expect( copy.formatAddedSuggestionLabel( 'Instagram' ) ).toBe( 'Instagram added' );
		expect( copy.title ).toBe( 'Choose websites' );
		expect( copy.addSiteLabel ).toBe( 'Add a pause here' );
		expect( copy.alreadyProtectedError ).toBe( 'That website is already on your list.' );
		expect( copy.formatAddedAnnouncement( 'Instagram' ) ).toBe( 'Instagram was added to your list.' );
	} );
} );
