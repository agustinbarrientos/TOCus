import { Language, type Language as LanguageValue } from '../../../domains/preferences/types';

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
