import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esbuildPlugin } from '@web/dev-server-esbuild';
import { emulateMediaPlugin } from '@web/test-runner-commands/plugins';
import { playwrightLauncher } from '@web/test-runner-playwright';
import { visualRegressionPlugin } from '@web/test-runner-visual-regression/plugin';

const extensionRoot = fileURLToPath( new URL( '../..', import.meta.url ) );
const themeTokensPath = path.resolve( extensionRoot, '../../packages/theme/tokens.css' );
const themeTokens = readFileSync( themeTokensPath, 'utf8' );
const testThemes = readFileSync( path.join( extensionRoot, 'config/wtr/test-themes.css' ), 'utf8' );
const updateScreenshots = process.argv.includes( '--update-snapshots' );

/**
 * Resolves a deterministic visual-regression artifact path beside its test file.
 * @param {string} testFile - Absolute path of the visual test file.
 * @param {string} browser - Browser display name.
 * @param {string} directory - Artifact subdirectory, or an empty string for the snapshot root.
 * @param {string} name - Snapshot name.
 * @return {string} Absolute artifact path.
 */
function snapshotPath( testFile, browser, directory, name ) {
	const browserDirectory = browser.toLowerCase().replaceAll( /[^a-z0-9]+/g, '-' );
	return path.join( path.dirname( testFile ), '__snapshots__', browserDirectory, directory, `${ name }.png` );
}

/** @type {import('@web/test-runner').TestRunnerConfig} */
export default {
	rootDir: extensionRoot,
	files: 'src/**/*.wtr.test.ts',
	coverage: true,
	coverageConfig: {
		exclude: [ 'src/**/*.wtr.test.ts' ],
		include: [ 'src/**/*.ts' ],
		threshold: {
			branches: 100,
			functions: 100,
			lines: 100,
			statements: 100,
		},
	},
	nodeResolve: { exportConditions: [ 'browser', 'module', 'import', 'default' ] },
	browsers: [
		playwrightLauncher( {
			product: 'chromium',
			createBrowserContext: async ( { browser } ) =>
				browser.newContext( {
					deviceScaleFactor: 1,
					viewport: { height: 600, width: 800 },
				} ),
		} ),
	],
	plugins: [
		esbuildPlugin( {
			loaders: { '.css': 'text' },
			target: 'es2022',
			ts: true,
			tsconfig: path.join( extensionRoot, 'tsconfig.json' ),
		} ),
		emulateMediaPlugin(),
		visualRegressionPlugin( {
			update: updateScreenshots,
			diffOptions: { includeAA: false, threshold: 0.1 },
			failureThreshold: 0,
			failureThresholdType: 'pixel',
			getBaselineName: ( { browser, name, testFile } ) => snapshotPath( testFile, browser, '', name ),
			getDiffName: ( { browser, name, testFile } ) => snapshotPath( testFile, browser, '__diff__', name ),
			getFailedName: ( { browser, name, testFile } ) => snapshotPath( testFile, browser, '__failed__', name ),
		} ),
	],
	testRunnerHtml: ( testFramework ) =>
		`<!doctype html><html><head><style>${ themeTokens }${ testThemes }</style></head><body><script type="module" src="${ testFramework }"></script></body></html>`,
	testFramework: { config: { timeout: 10_000, ui: 'bdd' } },
	browserStartTimeout: 120_000,
	testsStartTimeout: 60_000,
	testsFinishTimeout: 120_000,
	concurrency: 1,
};
