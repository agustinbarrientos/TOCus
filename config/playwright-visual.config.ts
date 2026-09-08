import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath( new URL( '../', import.meta.url ) );
const runId = `run-${ String( Date.now() ) }-${ String( process.pid ) }`;
const extensionOnly = process.argv.some( ( argument ) =>
	[ 'chromium-originals', '--project=chromium-originals',
		'chromium-onboarding', '--project=chromium-onboarding' ].includes( argument ) );

/**
 * Compares reviewed React pixels on the pinned macOS ARM Chromium capture platform.
 * @since 0.1.0
 */
export default defineConfig( {
	testDir: '../tests/visual',
	testMatch: '**/*.spec.ts',
	fullyParallel: false,
	workers: 1,
	retries: 0,
	timeout: 45000,
	updateSnapshots: 'none',
	snapshotPathTemplate: '{testDir}/../../{arg}{ext}',
	outputDir: `../test-results/visual/${ runId }`,
	reporter: [
		[ 'list' ],
		[ '../tests/visual/originals/audit/index.ts' ],
		[ 'html', { outputFolder: `playwright-report/visual/${ runId }`, open: 'never' } ],
	],
	expect: { toHaveScreenshot: {
		animations: 'disabled', caret: 'hide', maxDiffPixels: 0, threshold: 0,
		// Full-page capture/comparison takes about two seconds on CI; allow the built-in stable-image check to finish.
		timeout: 15000,
	} },
	use: {
		browserName: 'chromium',
		viewport: { width: 1440, height: 1000 },
		deviceScaleFactor: 1,
		locale: 'en-US',
		timezoneId: 'UTC',
		colorScheme: 'light',
		contextOptions: { reducedMotion: 'reduce' },
		// DOM snapshot inspection can perturb Chromium's edge rasterization. Keep event and screenshot diagnostics without changing the pixels under test.
		trace: { mode: 'retain-on-failure', snapshots: false, screenshots: true, sources: true },
	},
	projects: [
		{
			name: 'chromium-originals', testMatch: '**/originals/**/*.spec.ts',
		},
		{
			name: 'chromium-onboarding', testMatch: '**/onboarding.spec.ts',
			snapshotPathTemplate: '{testDir}/__snapshots__/chromium-macos26-arm64/{arg}{ext}',
		},
		{
			name: 'chromium-website', testMatch: '**/website.spec.ts',
			snapshotPathTemplate: '{testDir}/../../apps/website/src/components/home-page/__snapshots__/chromium/{arg}{ext}',
		},
	],
	webServer: [
		{
			cwd: repositoryRoot,
			command: 'pnpm --filter @tocus/extension exec vite --config tests/visual-server/vite.config.ts',
			url: 'http://127.0.0.1:4177/apps/extension/tests/ui/index.html',
			timeout: 120000,
			reuseExistingServer: ! process.env.CI,
		},
		...( extensionOnly ? [] : [ {
			cwd: repositoryRoot,
			command: 'pnpm --filter @tocus/website build && exec node apps/extension/node_modules/vite/bin/vite.js preview --config apps/extension/tests/visual-server/website.config.ts',
			url: 'http://127.0.0.1:4178',
			timeout: 120000,
			reuseExistingServer: ! process.env.CI,
		} ] ),
	],
} );
