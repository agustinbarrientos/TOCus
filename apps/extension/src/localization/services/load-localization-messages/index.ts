import { type Messages } from '@lingui/core';
import { Language, type Language as LanguageValue } from '../../../domains/preferences/types';
import { messages as englishMessages } from '../../../../locales/en.po';

/**
 * Loads one compiled Lingui catalog from packaged extension resources.
 * @param language - Effective language whose messages are required.
 * @return Requested local messages without loading other language catalogs.
 * @since 0.1.0 Initial implementation.
 */
export async function loadLocalizationMessages( language: LanguageValue ): Promise<Messages> {
	switch ( language ) {
		case Language.ENGLISH:
			return englishMessages;
		case Language.SPANISH_TU:
			return ( await import( '../../../../locales/es.po' ) ).messages;
		case Language.SPANISH_VOS:
			return ( await import( '../../../../locales/es-AR.po' ) ).messages;
		case Language.PORTUGUESE_BRAZIL:
			return ( await import( '../../../../locales/pt-BR.po' ) ).messages;
		case Language.PORTUGUESE_PORTUGAL:
			return ( await import( '../../../../locales/pt-PT.po' ) ).messages;
		case Language.ITALIAN:
			return ( await import( '../../../../locales/it.po' ) ).messages;
		case Language.FRENCH:
			return ( await import( '../../../../locales/fr.po' ) ).messages;
		case Language.GERMAN:
			return ( await import( '../../../../locales/de.po' ) ).messages;
		case Language.JAPANESE:
			return ( await import( '../../../../locales/ja.po' ) ).messages;
		case Language.RUSSIAN:
			return ( await import( '../../../../locales/ru.po' ) ).messages;
	}
}
