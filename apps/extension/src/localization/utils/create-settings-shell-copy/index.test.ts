import { setupI18n } from '@lingui/core';
import { describe, expect, it } from 'vitest';
import { Language } from '../../../domains/preferences/types';
import { createTestI18n } from '../../__fixtures__';
import { loadLocalizationMessages } from '../../services/load-localization-messages';
import { createSettingsShellCopy } from './index';

describe( 'createSettingsShellCopy', () => {
	it( 'creates settings navigation copy', () => {
		const copy = createSettingsShellCopy( createTestI18n() );

		expect( copy.navigationLabel ).toBe( 'Settings' );
		expect( copy.protectedSites ).toBe( 'Websites' );
		expect( copy.timing ).toBe( 'Pause timing' );
		expect( copy.privacy ).toBe( 'Privacy and local data' );
		expect( copy.about ).toBe( 'About' );
		expect( copy.unsavedChangesTitle ).toBe( 'Save your changes?' );
		expect( copy.stay ).toBe( 'Stay' );
		expect( copy.discard ).toBe( 'Discard' );
	} );

	it.each( Object.values( Language ) )( 'loads notification feedback from the %s catalog', async ( language ) => {
		const messages = await loadLocalizationMessages( language );
		const copy = createSettingsShellCopy( setupI18n( { locale: language, messages: { [ language ]: messages } } ) );
		const sourceMessages = {
			dismissNotification: 'Dismiss notification',
			changesSaved: 'Changes saved.',
			changesDiscarded: 'Changes discarded.',
			siteAddedToDraft: 'Site added. Save to apply your changes.',
			siteUpdatedInDraft: 'Site updated. Save to apply your changes.',
			siteRemovedFromDraft: 'Site removed. Save to apply your changes.',
			siteAlreadyExists: 'This site is already in your list.',
		};

		for ( const [ key, sourceMessage ] of Object.entries( sourceMessages ) ) {
			const translatedMessage = copy[ key as keyof typeof sourceMessages ];

			expect( translatedMessage, `${ language }: ${ key }` ).toBeTruthy();
			if ( language === Language.ENGLISH ) {
				expect( translatedMessage ).toBe( sourceMessage );
			} else {
				expect( translatedMessage ).not.toBe( sourceMessage );
			}
		}
	} );
} );
