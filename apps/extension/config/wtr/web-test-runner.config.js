import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esbuildPlugin } from '@web/dev-server-esbuild';
import { emulateMediaPlugin } from '@web/test-runner-commands/plugins';
import { playwrightLauncher } from '@web/test-runner-playwright';
import * as sass from 'sass';

/** Absolute workspace root for the two retained native-browser service suites. */
const extensionRoot = fileURLToPath( new URL( '../..', import.meta.url ) );
/** Brand tokens used by the unchanged Canvas renderer, without any control renderer. */
const themeStyles = sass.compile( path.resolve( extensionRoot, '../../packages/theme/tokens.scss' ) ).css;
/** Deterministic device theme for native service tests. */
const testThemes = readFileSync( path.join( extensionRoot, 'config/wtr/test-themes.css' ), 'utf8' );

/**
 * Keeps native video and Canvas assertions independent from React presentation tests.
 * @remarks Real React controls and injected boundaries run through the Vitest/Playwright presentation suite instead.
 * @type {import('@web/test-runner').TestRunnerConfig}
 * @since 0.1.0
 */
export default {
	rootDir: extensionRoot,
	files: [
		'src/features/interruption/services/media-playback-controller/index.wtr.test.ts',
		'src/features/interruption/utils/breathing-sphere-renderer/index.wtr.test.ts',
	],
	coverage: true,
	coverageConfig: {
		include: [
			'src/features/interruption/services/media-playback-controller/index.ts',
			'src/features/interruption/utils/breathing-sphere-renderer/index.ts',
		],
		threshold: { branches: 100, functions: 100, lines: 100, statements: 100 },
	},
	nodeResolve: { exportConditions: [ 'browser', 'module', 'import', 'default' ] },
	browsers: [ playwrightLauncher( { product: 'chromium' } ) ],
	plugins: [
		esbuildPlugin( { target: 'es2022', ts: true, tsconfig: path.join( extensionRoot, 'tsconfig.json' ) } ),
		emulateMediaPlugin(),
	],
	/**
	 * Adds only brand tokens to the native browser test document.
	 * @param {string} framework - Test framework module served by the runner.
	 * @return {string} Complete native service test document.
	 */
	testRunnerHtml: ( framework ) =>
		`<!doctype html><html><head><style>${ themeStyles }${ testThemes }</style></head><body><script type="module" src="${ framework }"></script></body></html>`,
	testFramework: { config: { timeout: 10000, ui: 'bdd' } },
	browserStartTimeout: 60000,
	testsStartTimeout: 60000,
	testsFinishTimeout: 60000,
	concurrency: 1,
};
