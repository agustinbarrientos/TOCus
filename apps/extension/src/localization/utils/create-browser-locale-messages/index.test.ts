import { setupI18n } from '@lingui/core';
import { describe, expect, it } from 'vitest';
import { createBrowserLocaleMessages } from './index';

describe( 'createBrowserLocaleMessages', () => {
	it( 'projects extension metadata into WebExtension messages', () => {
		const i18n = setupI18n( { locale: 'en', messages: { en: {} } } );

		expect( createBrowserLocaleMessages( i18n ) ).toEqual( {
			extensionName: {
				message: 'TOCus - Pause before visiting addictive websites',
				description: 'Extension name.',
			},
			extensionDescription: {
				message: 'TOCus adds a short breathing pause before the websites you choose, so you can notice the impulse and decide what to do next.',
				description: 'Short extension description shown by the browser and extension store.',
			},
		} );
	} );
} );
