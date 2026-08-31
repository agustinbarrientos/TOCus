import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esbuildPlugin } from '@web/dev-server-esbuild';
import { emulateMediaPlugin } from '@web/test-runner-commands/plugins';
import { playwrightLauncher } from '@web/test-runner-playwright';
import { visualRegressionPlugin } from '@web/test-runner-visual-regression/plugin';
import * as sass from 'sass';

const extensionRoot = fileURLToPath( new URL( '../..', import.meta.url ) );
const scssInlinePrefix = '/__scss_inline__';
const themeFontRoot = path.resolve(
	extensionRoot,
	'../../packages/theme/node_modules/@fontsource-variable/fredoka',
);
const themeFontStyles = readFileSync( path.join( themeFontRoot, 'wght.css' ), 'utf8' ).replaceAll(
	/url\(\.\/files\/([^)]+)\)/gu,
	( _match, fileName ) => {
		const font = readFileSync( path.join( themeFontRoot, 'files', fileName ) ).toString( 'base64' );

		return `url(data:font/woff2;base64,${ font })`;
	},
);
const themeTokensPath = path.resolve( extensionRoot, '../../packages/theme/tokens.scss' );
const themeTokens = sass.compile( themeTokensPath ).css;
const testThemes = readFileSync( path.join( extensionRoot, 'config/wtr/test-themes.css' ), 'utf8' );
const updateScreenshots = process.argv.includes( '--update-snapshots' );
const scssPlugin = {
	name: 'scss-inline',
	resolveImport( { source, context } ) {
		if ( ! source.endsWith( '.scss?inline' ) ) {
			return undefined;
		}

		const sourcePath = source.slice( 0, -'?inline'.length );
		const resolvedPath = path.posix.join( path.posix.dirname( context.path ), sourcePath );

		return `${ scssInlinePrefix }${ resolvedPath }`;
	},
	serve( context ) {
		if ( ! context.path.startsWith( scssInlinePrefix ) ) {
			return undefined;
		}

		const relativePath = context.path.slice( scssInlinePrefix.length );
		const absolutePath = path.join( extensionRoot, relativePath );
		const result = sass.compile( absolutePath, {
			loadPaths: [ path.join( extensionRoot, 'node_modules' ) ],
			style: 'expanded',
		} );

		return {
			body: `export default ${ JSON.stringify( result.css ) };`,
			headers: { 'cache-control': 'no-cache' },
			type: 'js',
		};
	},
};

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
		scssPlugin,
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
		`<!doctype html><html><head><style>${ themeFontStyles }${ themeTokens }${ testThemes }</style></head><body><script type="module" src="${ testFramework }"></script></body></html>`,
	testFramework: { config: { timeout: 10_000, ui: 'bdd' } },
	browserStartTimeout: 120_000,
	testsStartTimeout: 60_000,
	testsFinishTimeout: 120_000,
	concurrency: 1,
};
