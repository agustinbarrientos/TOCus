import { Language } from '../../../../src/domains/preferences/types.ts';
import { type ExtensionCatalog } from './types.ts';

/**
 * Canonical extension PO catalogs and their runtime locale mappings.
 * @since 0.1.0 Initial implementation.
 */
export const ExtensionCatalogs = Object.freeze( [
	{ language: Language.ENGLISH, locale: 'en', browserLocales: Object.freeze( [ 'en' ] ) },
	{ language: Language.SPANISH_TU, locale: 'es', browserLocales: Object.freeze( [ 'es', 'es_419' ] ) },
	{ language: Language.SPANISH_VOS, locale: 'es-AR', browserLocales: Object.freeze( [] ) },
	{ language: Language.PORTUGUESE_BRAZIL, locale: 'pt-BR', browserLocales: Object.freeze( [ 'pt_BR' ] ) },
	{ language: Language.PORTUGUESE_PORTUGAL, locale: 'pt-PT', browserLocales: Object.freeze( [ 'pt_PT' ] ) },
	{ language: Language.ITALIAN, locale: 'it', browserLocales: Object.freeze( [ 'it' ] ) },
	{ language: Language.FRENCH, locale: 'fr', browserLocales: Object.freeze( [ 'fr' ] ) },
	{ language: Language.GERMAN, locale: 'de', browserLocales: Object.freeze( [ 'de' ] ) },
	{ language: Language.JAPANESE, locale: 'ja', browserLocales: Object.freeze( [ 'ja' ] ) },
	{ language: Language.RUSSIAN, locale: 'ru', browserLocales: Object.freeze( [ 'ru' ] ) },
] as const satisfies ReadonlyArray<Readonly<ExtensionCatalog>> );

export { type ExtensionCatalog } from './types.ts';
