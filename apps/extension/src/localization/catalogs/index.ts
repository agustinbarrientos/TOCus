import { Language, type Language as LanguageValue } from '../../domains/preferences/types';
import englishCatalog from '../../../locales/en.json';
import { type LocalizationCatalog } from './types';

/**
 * Supported languages in stable preference-screen order.
 * @since 0.1.0 Initial implementation.
 */
export const SupportedLanguages: ReadonlyArray<LanguageValue> = Object.freeze( [
	Language.ENGLISH,
	Language.SPANISH_TU,
	Language.SPANISH_VOS,
	Language.PORTUGUESE_BRAZIL,
	Language.PORTUGUESE_PORTUGAL,
	Language.ITALIAN,
	Language.FRENCH,
	Language.GERMAN,
	Language.JAPANESE,
	Language.RUSSIAN,
] );

/**
 * Loads one translator-authored catalog from packaged extension resources.
 * @param language - Effective language whose catalog is required.
 * @return Requested local catalog without loading the other language catalogs.
 * @since 0.1.0 Initial implementation.
 */
export async function loadLocalizationCatalog( language: LanguageValue ): Promise<LocalizationCatalog> {
	switch ( language ) {
		case Language.ENGLISH:
			return englishCatalog;
		case Language.SPANISH_TU:
			return ( await import( '../../../locales/es-tu.json' ) ).default;
		case Language.SPANISH_VOS:
			return ( await import( '../../../locales/es-vos.json' ) ).default;
		case Language.PORTUGUESE_BRAZIL:
			return ( await import( '../../../locales/pt-BR.json' ) ).default;
		case Language.PORTUGUESE_PORTUGAL:
			return ( await import( '../../../locales/pt-PT.json' ) ).default;
		case Language.ITALIAN:
			return ( await import( '../../../locales/it.json' ) ).default;
		case Language.FRENCH:
			return ( await import( '../../../locales/fr.json' ) ).default;
		case Language.GERMAN:
			return ( await import( '../../../locales/de.json' ) ).default;
		case Language.JAPANESE:
			return ( await import( '../../../locales/ja.json' ) ).default;
		case Language.RUSSIAN:
			return ( await import( '../../../locales/ru.json' ) ).default;
	}
}

export { type LocalizationCatalog, type PluralMessageCatalog } from './types';
