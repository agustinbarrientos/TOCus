import { WebsiteLanguage } from '../../localization/types';
import { describe, expect, test } from 'vitest';
import { DownloadStores, detectDownloadBrowser, getDownloadStore, WebsiteBrowser } from './index';

describe( 'download store selection', () => {
	test.each( [
		[ '', WebsiteBrowser.CHROME, 'chromewebstore.google.com' ],
		[ 'unrecognized browser', WebsiteBrowser.CHROME, 'chromewebstore.google.com' ],
		[ 'Mozilla/5.0 Chrome/130.0 Safari/537.36', WebsiteBrowser.CHROME, 'chromewebstore.google.com' ],
		[ 'Mozilla/5.0 Chrome/130.0 Safari/537.36 OPR/114.0', WebsiteBrowser.CHROME, 'chromewebstore.google.com' ],
		[ 'Mozilla/5.0 CriOS/130.0 Mobile/15E148 Safari/604.1', WebsiteBrowser.CHROME, 'chromewebstore.google.com' ],
		[ 'Mozilla/5.0 EdgiOS/130.0 Mobile/15E148 Safari/605.1', WebsiteBrowser.CHROME, 'chromewebstore.google.com' ],
		[ 'Mozilla/5.0 EdgA/130.0 Mobile Safari/537.36', WebsiteBrowser.CHROME, 'chromewebstore.google.com' ],
		[ 'Mozilla/5.0 Firefox/130.0', WebsiteBrowser.FIREFOX, 'addons.mozilla.org' ],
		[ 'Mozilla/5.0 FxiOS/130.0 Mobile/15E148 Safari/605.1', WebsiteBrowser.FIREFOX, 'addons.mozilla.org' ],
		[ 'Mozilla/5.0 Version/18.0 Safari/605.1.15', WebsiteBrowser.SAFARI, 'apps.apple.com' ],
		[ 'Mozilla/5.0 Version/18.0 Mobile/15E148 Safari/604.1', WebsiteBrowser.SAFARI, 'apps.apple.com' ],
	] )( 'selects the appropriate destination for %s', ( userAgent, browser, hostname ) => {
		const store = getDownloadStore( detectDownloadBrowser( userAgent ) );
		expect( store.browser ).toBe( browser );
		if ( store.href === null ) {
			throw new Error( `Expected an available ${ browser } store` );
		}
		const destination = new URL( store.href );
		expect( destination.protocol ).toBe( 'https:' );
		expect( destination.hostname ).toBe( hostname );
		expect( destination.hash ).toBe( '' );
	} );

	test( 'resolves a usable static-render destination without browser globals', () => {
		expect( getDownloadStore( detectDownloadBrowser() ).browser ).toBe( WebsiteBrowser.CHROME );
	} );

	test( 'selects the official listing for desktop Edge', () => {
		const browser = detectDownloadBrowser(
			'Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
		);

		expect( browser ).toBe( WebsiteBrowser.EDGE );
		expect( getDownloadStore( browser ) ).toEqual( {
			browser: WebsiteBrowser.EDGE,
			name: 'Edge',
			href: 'https://microsoftedge.microsoft.com/addons/detail/ifpmfcopmabjjgggeefgoejnlbjpaehh?hl=en-US',
		} );
	} );

	test.each( [
		'Mozilla/5.0 EdgiOS/140.0 Mobile Safari/605.1',
		'Mozilla/5.0 EdgA/140.0 Mobile Safari/537.36',
	] )( 'keeps mobile Edge on the existing Chrome fallback for %s', ( userAgent ) => {
		expect( detectDownloadBrowser( userAgent ) ).toBe( WebsiteBrowser.CHROME );
	} );
} );

describe( 'localized download destinations', () => {
	test.each( [
		[ WebsiteLanguage.ENGLISH, 'en', 'en-US', 'en-US' ],
		[ WebsiteLanguage.SPANISH_TU, 'es', 'es-ES', 'es-ES' ],
		[ WebsiteLanguage.SPANISH_VOS, 'es-419', 'es-MX', 'es-AR' ],
		[ WebsiteLanguage.PORTUGUESE_BRAZIL, 'pt-BR', 'pt-BR', 'pt-BR' ],
		[ WebsiteLanguage.PORTUGUESE_PORTUGAL, 'pt-PT', 'pt-PT', 'pt-PT' ],
		[ WebsiteLanguage.ITALIAN, 'it', 'it-IT', 'it' ],
		[ WebsiteLanguage.FRENCH, 'fr', 'fr-FR', 'fr' ],
		[ WebsiteLanguage.GERMAN, 'de', 'de-DE', 'de' ],
		[ WebsiteLanguage.JAPANESE, 'ja', 'ja-JP', 'ja' ],
		[ WebsiteLanguage.RUSSIAN, 'ru', 'ru-RU', 'ru' ],
	] )( 'uses the selected %s language for Chrome, Edge and Firefox', ( language, chromeLocale, edgeLocale, firefoxLocale ) => {
		expect( getDownloadStore( WebsiteBrowser.CHROME, language ).href ).toBe(
			`https://chromewebstore.google.com/detail/tocus/gagjpniodbnbjdggjlkliabjffcnnfmh?hl=${ chromeLocale }`,
		);
		expect( getDownloadStore( WebsiteBrowser.EDGE, language ).href ).toBe(
			`https://microsoftedge.microsoft.com/addons/detail/ifpmfcopmabjjgggeefgoejnlbjpaehh?hl=${ edgeLocale }`,
		);
		expect( getDownloadStore( WebsiteBrowser.FIREFOX, language ).href ).toBe(
			`https://addons.mozilla.org/${ firefoxLocale }/firefox/addon/tocus/`,
		);
		expect( DownloadStores[ WebsiteBrowser.CHROME ].href ).not.toContain( '?' );
		expect( DownloadStores[ WebsiteBrowser.EDGE ].href ).not.toContain( '?' );
	} );
} );
