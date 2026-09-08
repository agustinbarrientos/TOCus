import { WebsiteBrowser, type StoreListing } from './types';

/**
 * The single place to replace all website download destinations.
 * These are deliberate placeholder store URLs, not verified live listings.
 * Replace each placeholder with the official listing URL before launch.
 * @since 0.1.0
 */
export const DownloadStores: Readonly<Record<WebsiteBrowser, StoreListing>> = {
	[ WebsiteBrowser.CHROME ]: {
		browser: WebsiteBrowser.CHROME,
		name: 'Chrome',
		href: 'https://chromewebstore.google.com/detail/tocus/placeholder-listing-id',
	},
	[ WebsiteBrowser.FIREFOX ]: {
		browser: WebsiteBrowser.FIREFOX,
		name: 'Firefox',
		href: 'https://addons.mozilla.org/firefox/addon/tocus-placeholder/',
	},
	[ WebsiteBrowser.SAFARI ]: {
		browser: WebsiteBrowser.SAFARI,
		name: 'Safari',
		href: 'https://apps.apple.com/app/tocus/id0000000000',
	},
};

/**
 * Selects a store locally, including browsers sharing Chromium's extension format.
 * @param userAgent - Browser identity; absent during server rendering.
 * @return Browser store, with Chrome as the fallback for unknown browsers.
 * @since 0.1.0
 */
export function detectDownloadBrowser( userAgent = '' ): WebsiteBrowser {
	if ( /Firefox\/|FxiOS\//iu.test( userAgent ) ) {
		return WebsiteBrowser.FIREFOX;
	}
	if ( /Chrome\/|Chromium\/|CriOS\/|Edg(?:e|A|iOS)?\/|OPR\/|OPiOS\//iu.test( userAgent ) ) {
		return WebsiteBrowser.CHROME;
	}
	if ( /Safari\//iu.test( userAgent ) ) {
		return WebsiteBrowser.SAFARI;
	}
	return WebsiteBrowser.CHROME;
}

/**
 * Resolves both full and compact download actions from the shared configuration.
 * @param browser - Preferred store.
 * @return Configured destination for that browser.
 * @since 0.1.0
 */
export function getDownloadStore( browser: WebsiteBrowser ): StoreListing {
	return DownloadStores[ browser ];
}

export { WebsiteBrowser } from './types';
