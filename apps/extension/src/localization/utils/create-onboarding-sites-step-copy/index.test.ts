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
		expect( copy.addSitesLabel ).toBe( 'Add sites' );
		expect( copy.addressPlaceholder ).toBe( 'example.com, sub.example.com, example.com/path' );
		expect( copy.addressHelp ).toBe( 'Separate websites with commas. Include a path to pause only that section.' );
		expect( copy.formatInvalidAddresses( [ 'not a site', 'https://' ] ) ).toBe( 'Check these addresses: not a site, https://' );
		expect( copy.formatAddedSitesAnnouncement( 1 ) ).toBe( '1 website was added to your list.' );
		expect( copy.formatAddedSitesAnnouncement( 3 ) ).toBe( '3 websites were added to your list.' );
		expect( copy.alreadyProtectedError ).toBe( 'That website is already on your list.' );
		expect( copy.formatAddedAnnouncement( 'Instagram' ) ).toBe( 'Instagram was added to your list.' );
		expect( copy.formatRemovedAnnouncement( 'Instagram' ) ).toBe( 'Instagram was removed from your list.' );
		expect( copy.formatPermissionRetainedAnnouncement( 'Instagram' ) ).toBe( "Instagram was removed, but its browser access couldn't be removed automatically." );
	} );

	it.each( [ Language.SPANISH_TU, Language.SPANISH_VOS ] )( 'uses the requested add-site label in %s', async ( language ) => {
		const bundle = await loadLocalizationBundle( language );
		expect( bundle.onboarding.sites.addSiteLabel ).toBe( 'Agregar sitio' );
	} );

	it.each( Object.values( Language ) )( 'localizes batch entry consistently with Settings in %s', async ( language ) => {
		const bundle = await loadLocalizationBundle( language );
		const copy = bundle.onboarding.sites;
		expect( copy.addSitesLabel ).toBe( bundle.protectedSites.addSites );
		expect( copy.addressPlaceholder ).toBe( bundle.protectedSites.addressPlaceholder );
		expect( copy.formatInvalidAddresses( [ 'not a site' ] ) )
			.toBe( bundle.protectedSites.formatInvalidAddresses( [ 'not a site' ] ) );
		expect( copy.addressHelp ).not.toBe( '' );
		expect( copy.formatAddedSitesAnnouncement( 2 ) ).toContain( '2' );
		expect( copy.formatAddedSitesAnnouncement( 1 ) ).not.toBe( copy.formatAddedSitesAnnouncement( 2 ) );
		if ( language !== Language.ENGLISH ) {
			expect( copy.addressHelp ).not.toBe( 'Separate websites with commas. Include a path to pause only that section.' );
			expect( copy.formatAddedSitesAnnouncement( 2 ) ).not.toBe( '2 websites were added to your list.' );
		}
	} );
} );
