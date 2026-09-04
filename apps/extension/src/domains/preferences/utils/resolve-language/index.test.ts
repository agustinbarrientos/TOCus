import { describe, expect, it } from 'vitest';
import { Language } from '../../types';
import { getLanguageTag, resolveLanguage } from './index';

describe( 'resolveLanguage', () => {
	it.each( [
		{ localeTag: 'es-AR', language: Language.SPANISH_VOS },
		{ localeTag: 'es-ar', language: Language.SPANISH_VOS },
		{ localeTag: 'es-Latn-UY-u-hc-h23', language: Language.SPANISH_VOS },
		{ localeTag: 'es-UY', language: Language.SPANISH_VOS },
		{ localeTag: 'es', language: Language.SPANISH_TU },
		{ localeTag: 'es-MX', language: Language.SPANISH_TU },
		{ localeTag: 'pt-BR', language: Language.PORTUGUESE_BRAZIL },
		{ localeTag: 'pt-PT', language: Language.PORTUGUESE_PORTUGAL },
		{ localeTag: 'pt', language: Language.PORTUGUESE_BRAZIL },
		{ localeTag: 'pt-AO', language: Language.PORTUGUESE_BRAZIL },
		{ localeTag: 'en-GB', language: Language.ENGLISH },
		{ localeTag: 'it-IT', language: Language.ITALIAN },
		{ localeTag: 'fr-CA', language: Language.FRENCH },
		{ localeTag: 'de-AT', language: Language.GERMAN },
		{ localeTag: 'ja-JP', language: Language.JAPANESE },
		{ localeTag: 'ru-RU', language: Language.RUSSIAN },
	] )( 'resolves $localeTag to $language', ( { localeTag, language } ) => {
		expect( resolveLanguage( localeTag ) ).toBe( language );
	} );

	it.each( [ null, undefined, '', 'not_a_locale', 'zh-Hant' ] )(
		'falls back to English for the unsupported locale input %s',
		( localeTag ) => {
			expect( resolveLanguage( localeTag ) ).toBe( Language.ENGLISH );
		},
	);
} );

describe( 'getLanguageTag', () => {
	it.each( [
		{ language: Language.ENGLISH, languageTag: 'en' },
		{ language: Language.SPANISH_TU, languageTag: 'es' },
		{ language: Language.SPANISH_VOS, languageTag: 'es-AR' },
		{ language: Language.PORTUGUESE_BRAZIL, languageTag: 'pt-BR' },
		{ language: Language.PORTUGUESE_PORTUGAL, languageTag: 'pt-PT' },
		{ language: Language.ITALIAN, languageTag: 'it' },
		{ language: Language.FRENCH, languageTag: 'fr' },
		{ language: Language.GERMAN, languageTag: 'de' },
		{ language: Language.JAPANESE, languageTag: 'ja' },
		{ language: Language.RUSSIAN, languageTag: 'ru' },
	] )( 'projects $language as the valid BCP-47 tag $languageTag', ( { language, languageTag } ) => {
		const projectedTag = getLanguageTag( language );

		expect( projectedTag ).toBe( languageTag );
		expect( Intl.getCanonicalLocales( projectedTag ) ).toEqual( [ languageTag ] );
	} );
} );
