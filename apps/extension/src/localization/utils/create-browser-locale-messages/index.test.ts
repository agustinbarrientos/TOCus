import { setupI18n } from '@lingui/core';
import { describe, expect, it } from 'vitest';
import { createBrowserLocaleMessages } from './index';

describe( 'createBrowserLocaleMessages', () => {
	it( 'projects extension metadata into WebExtension messages', () => {
		const i18n = setupI18n( { locale: 'en', messages: { en: {} } } );

		expect( createBrowserLocaleMessages( i18n ) ).toEqual( {
			extensionName: {
				message: 'TOCus',
				description: 'Extension name.',
			},
			extensionDescription: {
				message: 'A gentle pause before distracting websites, designed to help you return to your intentions.',
				description: 'Short extension description shown by the browser and extension store.',
			},
		} );
	} );
} );
