import { defineConfig } from 'wxt';
import germanCatalog from './locales/de.json';
import englishCatalog from './locales/en.json';
import spanishTuCatalog from './locales/es-tu.json';
import spanishVosCatalog from './locales/es-vos.json';
import frenchCatalog from './locales/fr.json';
import italianCatalog from './locales/it.json';
import japaneseCatalog from './locales/ja.json';
import portugueseBrazilCatalog from './locales/pt-BR.json';
import portuguesePortugalCatalog from './locales/pt-PT.json';
import russianCatalog from './locales/ru.json';
import { createBrowserLocaleMessages } from './src/localization/catalogs/create-browser-locale-messages';
import { type LocalizationCatalog } from './src/localization/catalogs/types';

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
const browserLocaleCatalogs: ReadonlyArray<readonly [ string, LocalizationCatalog ]> = [
	[ 'de', germanCatalog ],
	[ 'en', englishCatalog ],
	[ 'es', spanishTuCatalog ],
	[ 'es_419', spanishVosCatalog ],
	[ 'fr', frenchCatalog ],
	[ 'it', italianCatalog ],
	[ 'ja', japaneseCatalog ],
	[ 'pt_BR', portugueseBrazilCatalog ],
	[ 'pt_PT', portuguesePortugalCatalog ],
	[ 'ru', russianCatalog ],
];

/**
 * Serializes one canonical browser-message projection for WXT public assets.
 * @param catalog - Complete translator-authored catalog for one locale.
 * @return Pretty-printed browser localization file contents.
 * @since 0.1.0 Initial implementation.
 */
function createBrowserLocaleFile( catalog: LocalizationCatalog ): string {
	return `${ JSON.stringify( createBrowserLocaleMessages( catalog.extension ), null, '\t' ) }\n`;
}

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
	hooks: {
		/**
		 * Adds browser-managed metadata generated from the canonical locale catalogs.
		 * @param _wxt - Active WXT build context.
		 * @param files - Public assets collected for the current browser build.
		 * @since 0.1.0 Initial implementation.
		 */
		'build:publicAssets': ( _wxt, files ) => {
			for ( const [ locale, catalog ] of browserLocaleCatalogs ) {
				files.push( {
					relativeDest: `_locales/${ locale }/messages.json`,
					contents: createBrowserLocaleFile( catalog ),
				} );
			}
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
