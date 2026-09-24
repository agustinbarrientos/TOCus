import { WebsiteLanguage } from '../../localization/types';
import { WebsiteBrowser, type StoreListing } from './types';

/**
 * Chrome store language tags corresponding to TOCus preferences.
 */
const ChromeStoreLanguages: Readonly<Record<WebsiteLanguage, string>> = {
	[ WebsiteLanguage.ENGLISH ]: 'en',
	[ WebsiteLanguage.SPANISH_TU ]: 'es',
	[ WebsiteLanguage.SPANISH_VOS ]: 'es-419',
	[ WebsiteLanguage.PORTUGUESE_BRAZIL ]: 'pt-BR',
	[ WebsiteLanguage.PORTUGUESE_PORTUGAL ]: 'pt-PT',
	[ WebsiteLanguage.ITALIAN ]: 'it',
	[ WebsiteLanguage.FRENCH ]: 'fr',
	[ WebsiteLanguage.GERMAN ]: 'de',
	[ WebsiteLanguage.JAPANESE ]: 'ja',
	[ WebsiteLanguage.RUSSIAN ]: 'ru',
};

/**
 * Edge store language tags corresponding to TOCus preferences.
 */
const EdgeStoreLanguages: Readonly<Record<WebsiteLanguage, string>> = {
	[ WebsiteLanguage.ENGLISH ]: 'en-US',
	[ WebsiteLanguage.SPANISH_TU ]: 'es-ES',
	[ WebsiteLanguage.SPANISH_VOS ]: 'es-MX',
	[ WebsiteLanguage.PORTUGUESE_BRAZIL ]: 'pt-BR',
	[ WebsiteLanguage.PORTUGUESE_PORTUGAL ]: 'pt-PT',
	[ WebsiteLanguage.ITALIAN ]: 'it-IT',
	[ WebsiteLanguage.FRENCH ]: 'fr-FR',
	[ WebsiteLanguage.GERMAN ]: 'de-DE',
	[ WebsiteLanguage.JAPANESE ]: 'ja-JP',
	[ WebsiteLanguage.RUSSIAN ]: 'ru-RU',
};

/**
 * Firefox Add-ons locale paths corresponding to TOCus preferences.
 */
const FirefoxStoreLanguages: Readonly<Record<WebsiteLanguage, string>> = {
	[ WebsiteLanguage.ENGLISH ]: 'en-US',
	[ WebsiteLanguage.SPANISH_TU ]: 'es-ES',
	[ WebsiteLanguage.SPANISH_VOS ]: 'es-AR',
	[ WebsiteLanguage.PORTUGUESE_BRAZIL ]: 'pt-BR',
	[ WebsiteLanguage.PORTUGUESE_PORTUGAL ]: 'pt-PT',
	[ WebsiteLanguage.ITALIAN ]: 'it',
	[ WebsiteLanguage.FRENCH ]: 'fr',
	[ WebsiteLanguage.GERMAN ]: 'de',
	[ WebsiteLanguage.JAPANESE ]: 'ja',
	[ WebsiteLanguage.RUSSIAN ]: 'ru',
};

/**
 * The single place to replace all website download destinations.
 * Only browsers with a public release are offered as download options.
 * @since 1.0.0
 */
export const DownloadStores: Readonly<Record<WebsiteBrowser, StoreListing>> = {
	[ WebsiteBrowser.CHROME ]: {
		browser: WebsiteBrowser.CHROME,
		name: 'Chrome',
		href: 'https://chromewebstore.google.com/detail/tocus/gagjpniodbnbjdggjlkliabjffcnnfmh',
	},
	[ WebsiteBrowser.EDGE ]: {
		browser: WebsiteBrowser.EDGE,
		name: 'Edge',
		href: 'https://microsoftedge.microsoft.com/addons/detail/ifpmfcopmabjjgggeefgoejnlbjpaehh',
	},
	[ WebsiteBrowser.FIREFOX ]: {
		browser: WebsiteBrowser.FIREFOX,
		name: 'Firefox',
		href: 'https://addons.mozilla.org/firefox/addon/tocus/',
	},
};

/**
 * Selects a store locally, including browsers sharing Chromium's extension format.
 * @param userAgent - Browser identity; absent during server rendering.
 * @return Browser store, with Chrome as the fallback for unknown browsers.
 * @since 1.0.0
 */
export function detectDownloadBrowser( userAgent = '' ): WebsiteBrowser {
	if ( /Firefox\/|FxiOS\//iu.test( userAgent ) ) {
		return WebsiteBrowser.FIREFOX;
	}
	if ( /Edg\//iu.test( userAgent ) ) {
		return WebsiteBrowser.EDGE;
	}
	return WebsiteBrowser.CHROME;
}

/**
 * Resolves both full and compact download actions from the shared configuration.
 * @param browser - Preferred store.
 * @param language - Current website language.
 * @return Configured destination localized for that browser store.
 * @since 1.0.0
 */
export function getDownloadStore(
	browser: WebsiteBrowser, language: WebsiteLanguage = WebsiteLanguage.ENGLISH,
): StoreListing {
	const store = DownloadStores[ browser ];
	if ( store.href === null ) {
		return store;
	}
	const url = new URL( store.href );
	if ( browser === WebsiteBrowser.FIREFOX ) {
		url.pathname = url.pathname.replace( /^\/(?:[^/]+\/)?firefox\//u,
			`/${ FirefoxStoreLanguages[ language ] }/firefox/` );
		return { ...store, href: url.href };
	}
	url.searchParams.set( 'hl', browser === WebsiteBrowser.CHROME
		? ChromeStoreLanguages[ language ] : EdgeStoreLanguages[ language ] );
	return { ...store, href: url.href };
}

export { WebsiteBrowser } from './types';
