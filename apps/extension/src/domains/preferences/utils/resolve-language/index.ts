import { Language } from '../../types';

/**
 * Valid BCP-47 metadata tags indexed by supported TOCus language.
 * @since 0.1.0 Initial implementation.
 */
const LanguageTags: Readonly<Record<Language, string>> = Object.freeze( {
	[ Language.ENGLISH ]: 'en',
	[ Language.SPANISH_TU ]: 'es',
	[ Language.SPANISH_VOS ]: 'es-AR',
	[ Language.PORTUGUESE_BRAZIL ]: 'pt-BR',
	[ Language.PORTUGUESE_PORTUGAL ]: 'pt-PT',
	[ Language.ITALIAN ]: 'it',
	[ Language.FRENCH ]: 'fr',
	[ Language.GERMAN ]: 'de',
	[ Language.JAPANESE ]: 'ja',
	[ Language.RUSSIAN ]: 'ru',
} );

/**
 * Resolves one browser locale tag to a supported TOCus language.
 * @param localeTag - Unknown browser locale tag.
 * @return Exact regional match, supported base language, or English.
 * @since 0.1.0 Initial implementation.
 */
export function resolveLanguage( localeTag: unknown ): Language {
	if ( typeof localeTag !== 'string' || localeTag.length === 0 ) {
		return Language.ENGLISH;
	}

	let locale: Intl.Locale;

	try {
		locale = new Intl.Locale( localeTag );
	} catch {
		return Language.ENGLISH;
	}

	switch ( locale.language ) {
		case 'es':
			return locale.region === 'AR' || locale.region === 'UY'
				? Language.SPANISH_VOS
				: Language.SPANISH_TU;
		case 'pt':
			return locale.region === 'PT'
				? Language.PORTUGUESE_PORTUGAL
				: Language.PORTUGUESE_BRAZIL;
		case 'it':
			return Language.ITALIAN;
		case 'fr':
			return Language.FRENCH;
		case 'de':
			return Language.GERMAN;
		case 'ja':
			return Language.JAPANESE;
		case 'ru':
			return Language.RUSSIAN;
		case 'en':
		default:
			return Language.ENGLISH;
	}
}

/**
 * Projects one supported TOCus language to valid BCP-47 metadata.
 * @param language - Supported TOCus language.
 * @return Valid language metadata tag.
 * @since 0.1.0 Initial implementation.
 */
export function getLanguageTag( language: Language ): string {
	return LanguageTags[ language ];
}
