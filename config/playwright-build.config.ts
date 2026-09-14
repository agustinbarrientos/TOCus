import { defineConfig } from '@playwright/test';

/**
 * Runs built browser journeys with isolated fixtures and retained failure evidence.
 * @since 0.1.0 Initial implementation.
 */
export default defineConfig( {
	testDir: '../apps',
	testMatch: [
		'website/tests/build/interaction-contrast.test.ts',
		'extension/tests/build/packaged-protection/index.test.ts',
	],
	// Native browsers share the runner's CPU and memory; never overlap these journeys in CI.
	workers: 1,
	fullyParallel: false,
	forbidOnly: Boolean( process.env.CI ),
	retries: 0,
	timeout: 30_000,
	expect: { timeout: 5_000 },
	outputDir: '../test-results/build-browser',
	reporter: [
		[ 'list' ],
		[ 'html', { outputFolder: 'playwright-report/build-browser', open: 'never' } ],
	],
	use: {
		launchOptions: { timeout: 10_000 },
		actionTimeout: 10_000,
		navigationTimeout: 10_000,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
	},
} );
