import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { createLocalizationViteConfig } from '../../config/vite/services/create-localization-vite-config/index.ts';

/**
 * Bundles the existing UI fixtures once and serves their original routes to every browser worker.
 * @since 1.0.0 Initial implementation.
 */
export default defineConfig( {
	root: fileURLToPath( new URL( '../../../../', import.meta.url ) ),
	cacheDir: 'node_modules/.vite/ui-browser',
	plugins: createLocalizationViteConfig().plugins,
	resolve: {
		// Repository-root visual fixtures share the extension's existing React installation.
		alias: {
			react: fileURLToPath( new URL( '../../node_modules/react', import.meta.url ) ),
			'react-dom': fileURLToPath( new URL( '../../node_modules/react-dom', import.meta.url ) ),
		},
	},
	build: {
		outDir: fileURLToPath( new URL( '../../../../test-results/ui-fixtures', import.meta.url ) ),
		sourcemap: true,
		rolldownOptions: {
			input: [
				'apps/extension/tests/ui/index.html',
				'apps/extension/src/features/settings/components/shell/__fixtures__/index.html',
				'apps/extension/src/features/popup/components/shell/__fixtures__/index.html',
				'apps/extension/src/features/interruption/components/screen/__fixtures__/browser.html',
				'packages/ui/tests/fixture/index.html',
				'packages/ui/tests/fixture/shadow.html',
				'packages/ui/tests/fixture/snackbar.html',
				'packages/ui/tests/fixture/snackbar-shadow.html',
				'tests/visual/originals/presentation/index.html',
			].map( ( entry ) => fileURLToPath( new URL( `../../../../${ entry }`, import.meta.url ) ) ),
			output: {
				// Load shared control styles before the feature overrides, matching source fixture order.
				codeSplitting: { groups: [ { name: 'shared-ui', test: /\/packages\/ui\/src\//u } ] },
			},
		},
	},
	optimizeDeps: {
		entries: [
			'apps/extension/tests/ui/main.tsx',
			'apps/extension/src/features/settings/components/shell/__fixtures__/main.tsx',
			'apps/extension/src/features/popup/components/shell/__fixtures__/main.tsx',
			'apps/extension/src/features/interruption/components/screen/__fixtures__/browser.ts',
			'packages/ui/tests/fixture/main.tsx',
		],
		exclude: [ '@lingui/core/macro' ],
	},
	server: { host: '127.0.0.1', port: 4175, strictPort: true, watch: null, hmr: false },
	preview: { host: '127.0.0.1', port: 4175, strictPort: true },
	logLevel: 'error',
} );
