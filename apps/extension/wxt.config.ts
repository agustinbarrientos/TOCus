import { join } from 'node:path';
import { defineConfig } from 'wxt';
import { createTabFaviconAssets } from './config/icons/services/create-tab-favicon-assets/index.ts';
import { addBrowserLocaleAssets } from './config/localization/services/create-browser-locale-assets/index.ts';
import { createLocalizationViteConfig } from './config/vite/services/create-localization-vite-config/index.ts';

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
	/**
	 * Creates the extension build pipeline without duplicating large imported domain tables.
	 * @return Vite configuration shared by every entrypoint group.
	 * @since 0.1.0 Initial implementation.
	 */
	vite: () => ( {
		plugins: createLocalizationViteConfig().plugins,
		build: {
			// Chromium cannot reuse module preloads across extension resource worlds.
			modulePreload: false,
			rolldownOptions: {
				optimization: {
					// Inlining duplicates the public-suffix label table at each lookup site.
					inlineConst: false,
				},
			},
		},
	} ),
	imports: false,
	modules: [ '@wxt-dev/auto-icons', '@wxt-dev/module-react' ],
	autoIcons: {
		baseIconPath: '../../../packages/theme/assets/icon.svg',
		developmentIndicator: false,
		sizes: [ 16, 19, 24, 32, 38, 48, 64, 96, 128, 256, 512 ],
	},
	hooks: {
		/**
		 * Creates local assets shared by the extension documents.
		 * @param wxt - Active extension build context.
		 * @param files - Public assets copied into the extension package.
		 * @return Promise resolved after shared assets are generated.
		 * @since 0.1.0 Initial implementation.
		 */
		'build:publicAssets': async ( wxt, files ) => {
			await addBrowserLocaleAssets( wxt, files );
			files.push( ...await createTabFaviconAssets( join( wxt.config.wxtDir, 'tab-favicons' ) ) );
		},
	},
	/**
	 * Creates browser-specific extension metadata.
	 * @param context - WXT manifest context.
	 * @return Extension metadata for the target browser.
	 * @since 0.1.0 Initial implementation.
	 */
	manifest: ( context ) => ( {
		default_locale: 'en',
		name: '__MSG_extensionName__',
		description: '__MSG_extensionDescription__',
		...( context.browser === 'safari' ? {} : { incognito: 'not_allowed' as const } ),
		permissions: [
			'storage',
			'activeTab',
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
