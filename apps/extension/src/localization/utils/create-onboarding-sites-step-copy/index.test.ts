import { describe, expect, it } from 'vitest';
import { createTestI18n } from '../../__fixtures__';
import { createOnboardingSitesStepCopy } from './index';
import { loadLocalizationBundle } from '../../services/load-localization-bundle';
import { Language } from '../../../domains/preferences/types';

describe( 'createOnboardingSitesStepCopy', () => {
	it( 'creates onboarding site-selection copy and announcements', () => {
		const copy = createOnboardingSitesStepCopy( createTestI18n() );

		expect( copy.formatAddSuggestionLabel( 'Instagram' ) ).toBe( 'Add Instagram' );
		expect( copy.formatAddingSuggestionLabel( 'Instagram' ) ).toBe( 'Adding Instagram...' );
		expect( copy.formatAddedSuggestionLabel( 'Instagram' ) ).toBe( 'Instagram added' );
		expect( copy.title ).toBe( 'Choose websites' );
		expect( copy.addSiteLabel ).toBe( 'Add site' );
		expect( copy.alreadyProtectedError ).toBe( 'That website is already on your list.' );
		expect( copy.formatAddedAnnouncement( 'Instagram' ) ).toBe( 'Instagram was added to your list.' );
		expect( copy.formatRemovedAnnouncement( 'Instagram' ) ).toBe( 'Instagram was removed from your list.' );
		expect( copy.formatPermissionRetainedAnnouncement( 'Instagram' ) ).toBe( 'Instagram was removed, but its browser access could not be removed automatically.' );
	} );

	it.each( [ Language.SPANISH_TU, Language.SPANISH_VOS ] )( 'uses the requested add-site label in %s', async ( language ) => {
		const bundle = await loadLocalizationBundle( language );
		expect( bundle.onboarding.sites.addSiteLabel ).toBe( 'Agregar sitio' );
	} );
} );
