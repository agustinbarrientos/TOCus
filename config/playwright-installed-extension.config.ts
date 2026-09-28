import { defineConfig } from '@playwright/test';

/**
 * Runs the same journeys against installed Chrome, Edge, and Firefox in disposable profiles.
 * @since 1.0.1
 */
export default defineConfig( {
	testDir: '../apps/extension/tests/build/packaged-native',
	testMatch: '**/*.test.mjs',
	workers: 1,
	fullyParallel: false,
	forbidOnly: true,
	retries: 0,
	maxFailures: 0,
	timeout: 60_000,
	expect: { timeout: 15_000 },
	outputDir: '../test-results/installed-extension',
	reporter: [
		[ 'list' ],
		[ './playwright-installed-extension-reporter.mjs' ],
		[ 'html', { outputFolder: '../playwright-report/installed-extension', open: 'never' } ],
	],
	projects: [
		{ name: 'chrome' },
		{ name: 'edge' },
		{ name: 'firefox' },
	],
} );
