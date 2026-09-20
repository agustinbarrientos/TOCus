import { setupI18n } from '@lingui/core';
import { describe, expect, it } from 'vitest';
import { Language } from '../../../domains/preferences/types';
import { createTestI18n } from '../../__fixtures__';
import { loadLocalizationMessages } from '../../services/load-localization-messages';
import { createLocalizationFormatters } from '../create-localization-formatters';
import { createProtectedSitesCopy } from './index';

describe( 'createProtectedSitesCopy', () => {
	it( 'creates protected-sites copy and dynamic announcements', () => {
		const copy = createProtectedSitesCopy( createTestI18n(), createLocalizationFormatters( 'en' ) );

		expect( copy.title ).toBe( 'Websites' );
		expect( copy.addSite ).toBe( 'Add site' );
		expect( copy.alreadyProtectedError ).toBe( 'This website is already on your list.' );
		expect( copy.formatAddedAnnouncement( 'Reddit' ) ).toBe( 'Reddit was added to your list.' );
		expect( copy.formatUpdatedAnnouncement( 'Reddit' ) ).toBe( 'Reddit was updated.' );
		expect( copy.formatRemovedAnnouncement( 'Reddit' ) ).toBe( 'Reddit was removed from your list.' );
		expect( copy.formatPermissionRetainedAnnouncement( 'Reddit' ) ).toContain( 'browser access' );
		expect( copy.formatAccessRestoredAnnouncement( 'Reddit' ) ).toBe( 'Reddit access was restored.' );
	} );

	it( 'formats singular and plural bulk-removal copy', () => {
		const copy = createProtectedSitesCopy( createTestI18n(), createLocalizationFormatters( 'en' ) );

		expect( copy.formatRemoveSelected( 1 ) ).toBe( 'Remove selected (1)' );
		expect( copy.formatRemoveSelected( 3 ) ).toBe( 'Remove selected (3)' );
		expect( copy.formatRemoveSelectedQuestion( 1 ) ).toBe( 'Remove 1 website?' );
		expect( copy.formatRemoveSelectedQuestion( 3 ) ).toBe( 'Remove 3 websites?' );
		expect( copy.removeSelectedDescription )
			.toBe( 'These websites will be removed when you save your changes.' );
		expect( copy.cancelRemoveSelected ).toBe( 'Cancel' );
		expect( copy.confirmRemoveSelected ).toBe( 'Remove' );
	} );

	it( 'uses the active locale plural forms for bulk removal', async () => {
		const messages = await loadLocalizationMessages( Language.GERMAN );
		const copy = createProtectedSitesCopy(
			setupI18n( { locale: Language.GERMAN, messages: { [ Language.GERMAN ]: messages } } ),
			createLocalizationFormatters( Language.GERMAN ),
		);

		expect( copy.formatRemoveSelectedQuestion( 1 ) ).toBe( '1 Website entfernen?' );
		expect( copy.formatRemoveSelectedQuestion( 3 ) ).toBe( '3 Websites entfernen?' );
	} );
} );
