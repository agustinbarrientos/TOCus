import { type I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { type BrowserLocaleMessages } from './types';

/**
 * Projects canonical extension metadata into the browser localization format.
 * @param i18n - Locale-specific Lingui instance.
 * @return Browser-managed extension messages for the locale.
 * @since 0.1.0 Initial implementation.
 */
export function createBrowserLocaleMessages( i18n: I18n ): BrowserLocaleMessages {
	return {
		extensionName: {
			message: i18n._( msg( {
				comment: 'Extension name.',
				message: 'TOCus',
				context: 'Extension name',
			} ) ),
			description: 'Extension name.',
		},
		extensionDescription: {
			message: i18n._( msg( {
				comment: 'Short extension description shown by the browser and extension store.',
				message: 'A gentle pause before distracting websites, designed to help you return to your intentions.',
				context: 'Extension description',
			} ) ),
			description: 'Short extension description shown by the browser and extension store.',
		},
	};
}

export {
	type BrowserLocaleMessage,
	type BrowserLocaleMessages,
} from './types';
