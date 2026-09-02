import { defineConfig } from 'wxt';

/**
 * Configures extension metadata and browser build behavior.
 * @since 0.1.0 Initial implementation.
 */
export default defineConfig( {
	srcDir: 'src',
	imports: false,
	/**
	 * Creates browser-specific extension metadata.
	 * @param context - WXT manifest context.
	 * @return Extension metadata for the target browser.
	 * @since 0.1.0 Initial implementation.
	 */
	manifest: ( context ) => ( {
		name: 'TOCus',
		description: 'A gentle pause before distracting websites, designed to help you return to your intentions.',
		permissions: context.browser === 'chrome' ? [ 'storage', 'favicon' ] : [ 'storage' ],
		...( context.browser === 'chrome' ? { minimum_chrome_version: '104' } : {} ),
		...( context.browser === 'firefox'
			? {
				browser_specific_settings: {
					gecko: {
						id: 'tocus@agustinbarrientos.github.io',
						strict_min_version: '115.0',
						data_collection_permissions: { required: [ 'none' ] },
					},
				},
			}
			: {} ),
	} ),
} );
