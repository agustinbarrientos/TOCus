import { WebsiteBrowser, type StoreListing } from './types';

/**
 * The single place to replace all website download destinations.
 * Chrome points to its store listing; the other stores still use placeholders.
 * Replace each placeholder with the official listing URL before launch.
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
		href: 'https://microsoftedge.microsoft.com/addons/detail/tocus/placeholder-listing-id',
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
 * @since 1.0.0
 */
export function detectDownloadBrowser( userAgent = '' ): WebsiteBrowser {
	if ( /Firefox\/|FxiOS\//iu.test( userAgent ) ) {
		return WebsiteBrowser.FIREFOX;
	}
	if ( /Edg\//iu.test( userAgent ) ) {
		return WebsiteBrowser.EDGE;
	}
	if ( /Chrome\/|Chromium\/|CriOS\/|EdgA\/|EdgiOS\/|OPR\/|OPiOS\//iu.test( userAgent ) ) {
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
 * @since 1.0.0
 */
export function getDownloadStore( browser: WebsiteBrowser ): StoreListing {
	return DownloadStores[ browser ];
}

export { WebsiteBrowser } from './types';
