import germanCatalog from '../../locales/de.json';
import englishCatalog from '../../locales/en.json';
import spanishTuCatalog from '../../locales/es-tu.json';
import spanishVosCatalog from '../../locales/es-vos.json';
import frenchCatalog from '../../locales/fr.json';
import italianCatalog from '../../locales/it.json';
import japaneseCatalog from '../../locales/ja.json';
import portugueseBrazilCatalog from '../../locales/pt-BR.json';
import portuguesePortugalCatalog from '../../locales/pt-PT.json';
import russianCatalog from '../../locales/ru.json';
import {
	WebsiteLanguage,
	type WebsiteCatalog,
	type WebsiteLanguage as WebsiteLanguageValue,
	type WebsiteLanguageMetadata,
	type WebsiteLocalization,
} from './types';

/**
 * Website languages in stable language-menu order.
 * @since 0.1.0 Initial implementation.
 */
export const WebsiteLanguages: ReadonlyArray<WebsiteLanguageValue> = Object.freeze( [
	WebsiteLanguage.ENGLISH,
	WebsiteLanguage.SPANISH_TU,
	WebsiteLanguage.SPANISH_VOS,
	WebsiteLanguage.PORTUGUESE_BRAZIL,
	WebsiteLanguage.PORTUGUESE_PORTUGAL,
	WebsiteLanguage.ITALIAN,
	WebsiteLanguage.FRENCH,
	WebsiteLanguage.GERMAN,
	WebsiteLanguage.JAPANESE,
	WebsiteLanguage.RUSSIAN,
] );

/**
 * Translator-authored website catalogs indexed by stable language value.
 * @since 0.1.0 Initial implementation.
 */
const WebsiteCatalogs: Readonly<Record<WebsiteLanguageValue, WebsiteCatalog>> = Object.freeze( {
	[ WebsiteLanguage.ENGLISH ]: englishCatalog,
	[ WebsiteLanguage.SPANISH_TU ]: spanishTuCatalog,
	[ WebsiteLanguage.SPANISH_VOS ]: spanishVosCatalog,
	[ WebsiteLanguage.PORTUGUESE_BRAZIL ]: portugueseBrazilCatalog,
	[ WebsiteLanguage.PORTUGUESE_PORTUGAL ]: portuguesePortugalCatalog,
	[ WebsiteLanguage.ITALIAN ]: italianCatalog,
	[ WebsiteLanguage.FRENCH ]: frenchCatalog,
	[ WebsiteLanguage.GERMAN ]: germanCatalog,
	[ WebsiteLanguage.JAPANESE ]: japaneseCatalog,
	[ WebsiteLanguage.RUSSIAN ]: russianCatalog,
} );

/**
 * Non-translatable route and language-name metadata indexed by language.
 * @since 0.1.0 Initial implementation.
 */
const WebsiteLanguageMetadataByLanguage: Readonly<Record<WebsiteLanguageValue, WebsiteLanguageMetadata>> =
	Object.freeze( {
		[ WebsiteLanguage.ENGLISH ]: { languageTag: 'en', path: '/', autonym: 'English' },
		[ WebsiteLanguage.SPANISH_TU ]: { languageTag: 'es', path: '/es/', autonym: 'Español (tú)' },
		[ WebsiteLanguage.SPANISH_VOS ]: { languageTag: 'es-AR', path: '/es-ar/', autonym: 'Español (vos)' },
		[ WebsiteLanguage.PORTUGUESE_BRAZIL ]: {
			languageTag: 'pt-BR',
			path: '/pt-br/',
			autonym: 'Português (Brasil)',
		},
		[ WebsiteLanguage.PORTUGUESE_PORTUGAL ]: {
			languageTag: 'pt-PT',
			path: '/pt-pt/',
			autonym: 'Português (Portugal)',
		},
		[ WebsiteLanguage.ITALIAN ]: { languageTag: 'it', path: '/it/', autonym: 'Italiano' },
		[ WebsiteLanguage.FRENCH ]: { languageTag: 'fr', path: '/fr/', autonym: 'Français' },
		[ WebsiteLanguage.GERMAN ]: { languageTag: 'de', path: '/de/', autonym: 'Deutsch' },
		[ WebsiteLanguage.JAPANESE ]: { languageTag: 'ja', path: '/ja/', autonym: '日本語' },
		[ WebsiteLanguage.RUSSIAN ]: { languageTag: 'ru', path: '/ru/', autonym: 'Русский' },
	} );

/**
 * Returns one complete localized website projection.
 * @param language - Stable website language.
 * @return Catalog, route, document language, and autonym for the selected language.
 * @since 0.1.0 Initial implementation.
 */
export function getWebsiteLocalization( language: WebsiteLanguageValue ): Readonly<WebsiteLocalization> {
	return Object.freeze( {
		language,
		catalog: WebsiteCatalogs[ language ],
		...WebsiteLanguageMetadataByLanguage[ language ],
	} );
}

/**
 * Returns every localized website projection in stable language-menu order.
 * @return Complete supported website localizations.
 * @since 0.1.0 Initial implementation.
 */
export function getWebsiteLocalizations(): ReadonlyArray<Readonly<WebsiteLocalization>> {
	return WebsiteLanguages.map( getWebsiteLocalization );
}

export {
	WebsiteLanguage,
	type LocalizedHomePageProperties,
	type LocalizedWebsitePageProperties,
	type WebsiteCatalog,
	type WebsiteLocalization,
} from './types';
