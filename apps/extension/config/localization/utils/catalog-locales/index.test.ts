import { describe, expect, it } from 'vitest';
import { Language } from '../../../../src/domains/preferences/types.ts';
import { ExtensionCatalogs } from './index.ts';

describe( 'ExtensionCatalogs', () => {
	it( 'maps every preference language and browser locale to one canonical PO file', () => {
		expect( ExtensionCatalogs ).toEqual( [
			{ language: Language.ENGLISH, locale: 'en', browserLocales: [ 'en' ] },
			{ language: Language.SPANISH_TU, locale: 'es', browserLocales: [ 'es', 'es_419' ] },
			{ language: Language.SPANISH_VOS, locale: 'es-AR', browserLocales: [] },
			{ language: Language.PORTUGUESE_BRAZIL, locale: 'pt-BR', browserLocales: [ 'pt_BR' ] },
			{ language: Language.PORTUGUESE_PORTUGAL, locale: 'pt-PT', browserLocales: [ 'pt_PT' ] },
			{ language: Language.ITALIAN, locale: 'it', browserLocales: [ 'it' ] },
			{ language: Language.FRENCH, locale: 'fr', browserLocales: [ 'fr' ] },
			{ language: Language.GERMAN, locale: 'de', browserLocales: [ 'de' ] },
			{ language: Language.JAPANESE, locale: 'ja', browserLocales: [ 'ja' ] },
			{ language: Language.RUSSIAN, locale: 'ru', browserLocales: [ 'ru' ] },
		] );
	} );
} );
