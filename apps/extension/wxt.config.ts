import { defineConfig } from 'wxt';

/**
 * Configures extension metadata and browser build behavior.
 * @since <version> Initial implementation.
 */
export default defineConfig( {
	alias: {
		'@tocus/extension': 'src',
	},
	srcDir: 'src',
	imports: false,
	manifest: ( { browser } ) => ( {
		name: 'TOCus',
		description: 'A gentle pause before distracting websites, designed to help you return to your intentions.',
		...( browser === 'firefox'
			? {
				browser_specific_settings: {
					gecko: {
						id: 'tocus@agustinbarrientos.github.io',
						data_collection_permissions: { required: [ 'none' ] },
					},
				},
			}
			: {} ),
	} ),
} );
