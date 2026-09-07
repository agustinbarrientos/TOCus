/**
 * Browser stores supported by TOCus.
 * @since 0.1.0
 */
export const WebsiteBrowser = {
	CHROME: 'chrome',
	FIREFOX: 'firefox',
	SAFARI: 'safari',
} as const;

/**
 * Supported browser store identifier.
 * @since 0.1.0
 */
export type WebsiteBrowser = typeof WebsiteBrowser[ keyof typeof WebsiteBrowser ];

/**
 * Download destination and local badge for one browser store.
 * @since 0.1.0
 */
export interface StoreListing {
	browser: WebsiteBrowser;
	name: string;
	href: string;
}
