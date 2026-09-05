import { Language, type Language as LanguageValue } from '../../../domains/preferences/types';
import { messages as englishMessages } from '../../../../locales/en.po';
import { createLocalizationBundle, type LocalizationBundle } from '../../utils/create-localization-bundle';
import { loadLocalizationMessages } from '../load-localization-messages';
import { type LocalizationMessagesLoader } from './types';

/**
 * Creates a complete English bundle from the statically packaged source catalog.
 * @return Complete English copy without an asynchronous catalog request.
 * @since 0.1.0 Initial implementation.
 */
export function createEnglishLocalizationBundle(): Readonly<LocalizationBundle> {
	return createLocalizationBundle( Language.ENGLISH, englishMessages );
}

/**
 * Loads one packaged catalog and builds its complete typed copy bundle.
 * @param language - Authoritative effective language selected by preferences.
 * @param messagesLoader - Packaged message boundary used for the requested language.
 * @return Complete local copy bundle for only the requested language.
 * @since 0.1.0 Initial implementation.
 */
export async function loadLocalizationBundle(
	language: LanguageValue,
	messagesLoader: LocalizationMessagesLoader = loadLocalizationMessages,
): Promise<Readonly<LocalizationBundle>> {
	try {
		return createLocalizationBundle( language, await messagesLoader( language ) );
	} catch {
		return createEnglishLocalizationBundle();
	}
}

export { type LocalizationMessagesLoader } from './types';
