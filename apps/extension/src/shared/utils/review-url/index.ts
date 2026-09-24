import { Language } from '../../../domains/preferences/types';
import { ExtensionBuildBrowser } from '../build-browser/types';
import type { ExtensionReviewLinks } from './types';

/**
 * Chrome store language tags corresponding to TOCus preferences.
 */
const ChromeStoreLanguages: Readonly<Record<Language, string>> = {
	[ Language.ENGLISH ]: 'en',
	[ Language.SPANISH_TU ]: 'es',
	[ Language.SPANISH_VOS ]: 'es-419',
	[ Language.PORTUGUESE_BRAZIL ]: 'pt-BR',
	[ Language.PORTUGUESE_PORTUGAL ]: 'pt-PT',
	[ Language.ITALIAN ]: 'it',
	[ Language.FRENCH ]: 'fr',
	[ Language.GERMAN ]: 'de',
	[ Language.JAPANESE ]: 'ja',
	[ Language.RUSSIAN ]: 'ru',
};

/**
 * Edge store language tags corresponding to TOCus preferences.
 */
const EdgeStoreLanguages: Readonly<Record<Language, string>> = {
	[ Language.ENGLISH ]: 'en-US',
	[ Language.SPANISH_TU ]: 'es-ES',
	[ Language.SPANISH_VOS ]: 'es-MX',
	[ Language.PORTUGUESE_BRAZIL ]: 'pt-BR',
	[ Language.PORTUGUESE_PORTUGAL ]: 'pt-PT',
	[ Language.ITALIAN ]: 'it-IT',
	[ Language.FRENCH ]: 'fr-FR',
	[ Language.GERMAN ]: 'de-DE',
	[ Language.JAPANESE ]: 'ja-JP',
	[ Language.RUSSIAN ]: 'ru-RU',
};

/**
 * Firefox Add-ons locale paths corresponding to TOCus preferences.
 */
const FirefoxStoreLanguages: Readonly<Record<Language, string>> = {
	[ Language.ENGLISH ]: 'en-US',
	[ Language.SPANISH_TU ]: 'es-ES',
	[ Language.SPANISH_VOS ]: 'es-AR',
	[ Language.PORTUGUESE_BRAZIL ]: 'pt-BR',
	[ Language.PORTUGUESE_PORTUGAL ]: 'pt-PT',
	[ Language.ITALIAN ]: 'it',
	[ Language.FRENCH ]: 'fr',
	[ Language.GERMAN ]: 'de',
	[ Language.JAPANESE ]: 'ja',
	[ Language.RUSSIAN ]: 'ru',
};

/**
 * Selects the review destination for the extension's actual distribution target.
 * @param browser - Browser target supplied by the extension build.
 * @param links - Published listings for each browser.
 * @param language - Effective TOCus language, independent of the browser language.
 * @return Matching review URL, or null for an unavailable store.
 * @since 1.0.0
 */
export function getExtensionReviewUrl(
	browser: string, links: ExtensionReviewLinks, language: Language = Language.ENGLISH,
): string | null {
	const matchingLink = Object.entries( links ).find( ( [ target ] ) => target === browser );
	const href = matchingLink?.[ 1 ] ?? null;
	if ( href === null || ( browser !== ExtensionBuildBrowser.CHROME && browser !== ExtensionBuildBrowser.EDGE &&
			browser !== ExtensionBuildBrowser.FIREFOX ) ) {
		return href;
	}
	const url = new URL( href );
	if ( browser === ExtensionBuildBrowser.FIREFOX ) {
		url.pathname = url.pathname.replace( /^\/(?:[^/]+\/)?firefox\//u,
			`/${ FirefoxStoreLanguages[ language ] }/firefox/` );
		return url.href;
	}
	url.searchParams.set( 'hl', browser === ExtensionBuildBrowser.CHROME
		? ChromeStoreLanguages[ language ] : EdgeStoreLanguages[ language ] );
	return url.href;
}
