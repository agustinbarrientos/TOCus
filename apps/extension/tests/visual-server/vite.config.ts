import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { createLocalizationViteConfig } from '../../config/vite/services/create-localization-vite-config/index.ts';

/**
 * Serves existing production-mount fixtures without a duplicate visual-only application.
 * @since 0.1.0
 */
export default defineConfig( {
	root: fileURLToPath( new URL( '../../../../', import.meta.url ) ),
	plugins: createLocalizationViteConfig().plugins,
	server: { host: '127.0.0.1', port: 4177, strictPort: true, hmr: false },
	optimizeDeps: {
		entries: [
			'apps/extension/tests/ui/index.html',
			'apps/extension/src/features/settings/components/shell/__fixtures__/index.html',
			'apps/extension/src/features/interruption/components/screen/__fixtures__/browser.html',
		],
		exclude: [ '@lingui/core/macro' ],
	},
} );
