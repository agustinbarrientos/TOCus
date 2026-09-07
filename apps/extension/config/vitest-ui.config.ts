import { defineConfig } from 'vitest/config';
import { createLocalizationViteConfig } from './vite/services/create-localization-vite-config/index.ts';

/**
 * Runs real-browser presentation regressions separately from domain unit tests.
 * @since 0.1.0
 */
export default defineConfig( {
	plugins: createLocalizationViteConfig().plugins,
	test: {
		// Each file launches real browser processes; bound concurrency for local and CI hosts.
		maxWorkers: 2,
		include: [
			'apps/extension/tests/ui/**/*.test.ts',
			'apps/extension/src/**/*.browser.test.{ts,tsx}',
			'apps/extension/src/**/browser.test.{ts,tsx}',
			'tests/visual/**/*.browser.test.ts',
		],
		testTimeout: 30_000,
		hookTimeout: 60_000,
	},
} );
