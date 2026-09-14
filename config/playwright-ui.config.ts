import { defineConfig } from '@playwright/test';

/**
 * Shares fixture compilation and worker browsers across production UI regressions.
 * @since 0.1.0 Initial implementation.
 */
export default defineConfig( {
	testDir: '..',
	testMatch: [
		'apps/extension/tests/ui/**/*.test.ts',
		'apps/extension/src/**/*.browser.test.{ts,tsx}',
		'apps/extension/src/**/browser.test.{ts,tsx}',
		'packages/ui/tests/**/*.test.ts',
		'tests/visual/**/*.browser.test.ts',
	],
	workers: 2,
	fullyParallel: false,
	forbidOnly: Boolean( process.env.CI ),
	retries: 0,
	timeout: 30_000,
	expect: { timeout: 5_000 },
	outputDir: '../test-results/ui',
	reporter: [
		[ 'list' ],
		[ 'html', { outputFolder: '../playwright-report/ui', open: 'never' } ],
	],
	use: {
		baseURL: 'http://127.0.0.1:4175',
		launchOptions: { timeout: 10_000 },
		actionTimeout: 6_000,
		navigationTimeout: 20_000,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
	},
	projects: [
		{ name: 'chromium', use: { browserName: 'chromium' } },
		{ name: 'firefox', use: { browserName: 'firefox' } },
		{ name: 'webkit', use: { browserName: 'webkit' } },
	],
	webServer: {
		command: 'pnpm --filter @tocus/extension exec vite --config tests/ui-server/vite.config.ts',
		url: 'http://127.0.0.1:4175/apps/extension/tests/ui/index.html',
		cwd: '..',
		timeout: 60_000,
		reuseExistingServer: false,
	},
} );
