/**
 * Browser stores supported by TOCus.
 * @since 0.1.0
 */
export const WebsiteBrowser = {
	CHROME: 'chrome',
	EDGE: 'edge',
	FIREFOX: 'firefox',
	SAFARI: 'safari',
} as const;

/**
 * Supported browser store identifier.
 * @since 0.1.0
 */
export type WebsiteBrowser = typeof WebsiteBrowser[ keyof typeof WebsiteBrowser ];

/**
 * Download availability and destination for one browser store.
 * @since 0.1.0
 */
export interface StoreListing {
	browser: WebsiteBrowser;
	name: string;
	/** Official store destination, or null while the listing is unavailable. */
	href: string | null;
}
