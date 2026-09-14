import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { createLocalizationViteConfig } from '../../config/vite/services/create-localization-vite-config/index.ts';

/**
 * Compiles production UI fixtures once for every browser worker and suite.
 * @since 0.1.0 Initial implementation.
 */
export default defineConfig( {
	root: fileURLToPath( new URL( '../../../../', import.meta.url ) ),
	cacheDir: 'node_modules/.vite/ui-browser',
	plugins: createLocalizationViteConfig().plugins,
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
	logLevel: 'error',
} );
