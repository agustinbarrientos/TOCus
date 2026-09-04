import {
	type BrowserLocaleMessages,
	type ExtensionMessageCatalog,
} from './types';

/**
 * Projects canonical extension metadata into the browser localization format.
 * @param catalog - Translator-authored extension metadata for one locale.
 * @return Browser-managed extension messages for the locale.
 * @since 0.1.0 Initial implementation.
 */
export function createBrowserLocaleMessages(
	catalog: ExtensionMessageCatalog,
): BrowserLocaleMessages {
	return {
		extensionName: {
			message: catalog.name,
			description: catalog.nameDescription,
		},
		extensionDescription: {
			message: catalog.description,
			description: catalog.descriptionDescription,
		},
	};
}
