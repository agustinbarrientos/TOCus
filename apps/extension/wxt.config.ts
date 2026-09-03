import { defineConfig } from 'wxt';

const PROTECTED_PAGE_MATCHES = [
	'http://*/*',
	'https://*/*',
];
const PROTECTED_PAGE_RESOURCES = [
	'assets/protected-page-font.woff2',
	'assets/protected-page-font2.woff2',
	'assets/protected-page-font3.woff2',
	'interruption.html',
];

/**
 * Configures extension metadata and browser build behavior.
 * @since 0.1.0 Initial implementation.
 */
export default defineConfig( {
	srcDir: 'src',
	imports: false,
	modules: [ '@wxt-dev/auto-icons' ],
	autoIcons: {
		baseIconPath: '../../../packages/theme/assets/icon.svg',
		developmentIndicator: false,
		sizes: [ 16, 19, 24, 32, 38, 48, 64, 96, 128, 256, 512 ],
	},
	/**
	 * Creates browser-specific extension metadata.
	 * @param context - WXT manifest context.
	 * @return Extension metadata for the target browser.
	 * @since 0.1.0 Initial implementation.
	 */
	manifest: ( context ) => ( {
		name: 'TOCus',
		description: 'A gentle pause before distracting websites, designed to help you return to your intentions.',
		...( context.browser === 'safari' ? {} : { incognito: 'not_allowed' as const } ),
		permissions: [
			'storage',
			...( context.browser === 'chrome' ? [ 'favicon' as const ] : [] ),
			'alarms',
			'declarativeNetRequestWithHostAccess',
			'scripting',
		],
		optional_permissions: [
			'webNavigation',
			...( context.manifestVersion === 2 ? [ '*://*/*' ] : [] ),
		],
		...( context.manifestVersion === 3
			? { optional_host_permissions: [ '*://*/*' ] }
			: {} ),
		web_accessible_resources: [ {
			matches: PROTECTED_PAGE_MATCHES,
			resources: PROTECTED_PAGE_RESOURCES,
			use_dynamic_url: false,
		} ],
		...( context.browser === 'chrome' ? { minimum_chrome_version: '120' } : {} ),
		...( context.browser === 'firefox'
			? {
				browser_specific_settings: {
					gecko: {
						id: 'tocus@agustinbarrientos.github.io',
						strict_min_version: '140.0',
						data_collection_permissions: { required: [ 'none' ] },
					},
				},
			}
			: {} ),
		...( context.browser === 'safari'
			? {
				browser_specific_settings: {
					safari: { strict_min_version: '16.4' },
				},
			}
			: {} ),
	} ),
} );
