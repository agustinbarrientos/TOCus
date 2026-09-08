import { describe, expect, test } from 'vitest';
import { detectDownloadBrowser, getDownloadStore, WebsiteBrowser } from './index';

describe( 'download store selection', () => {
	test.each( [
		[ '', 'chrome', 'chromewebstore.google.com' ],
		[ 'unrecognized browser', 'chrome', 'chromewebstore.google.com' ],
		[ 'Mozilla/5.0 Chrome/130.0 Safari/537.36', 'chrome', 'chromewebstore.google.com' ],
		[ 'Mozilla/5.0 Chrome/130.0 Safari/537.36 Edg/130.0', 'chrome', 'chromewebstore.google.com' ],
		[ 'Mozilla/5.0 Chrome/130.0 Safari/537.36 OPR/114.0', 'chrome', 'chromewebstore.google.com' ],
		[ 'Mozilla/5.0 CriOS/130.0 Mobile/15E148 Safari/604.1', 'chrome', 'chromewebstore.google.com' ],
		[ 'Mozilla/5.0 EdgiOS/130.0 Mobile/15E148 Safari/605.1', 'chrome', 'chromewebstore.google.com' ],
		[ 'Mozilla/5.0 Firefox/130.0', 'firefox', 'addons.mozilla.org' ],
		[ 'Mozilla/5.0 FxiOS/130.0 Mobile/15E148 Safari/605.1', 'firefox', 'addons.mozilla.org' ],
		[ 'Mozilla/5.0 Version/18.0 Safari/605.1.15', 'safari', 'apps.apple.com' ],
		[ 'Mozilla/5.0 Version/18.0 Mobile/15E148 Safari/604.1', 'safari', 'apps.apple.com' ],
	] )( 'selects the appropriate destination for %s', ( userAgent, browser, hostname ) => {
		const store = getDownloadStore( detectDownloadBrowser( userAgent ) );
		expect( store.browser ).toBe( browser );
		const destination = new URL( store.href );
		expect( destination.protocol ).toBe( 'https:' );
		expect( destination.hostname ).toBe( hostname );
		expect( destination.hash ).toBe( '' );
	} );

	test( 'resolves a usable static-render destination without browser globals', () => {
		expect( getDownloadStore( detectDownloadBrowser() ).browser ).toBe( WebsiteBrowser.CHROME );
	} );
} );
