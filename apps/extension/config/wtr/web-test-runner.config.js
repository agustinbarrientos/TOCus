import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esbuildPlugin } from '@web/dev-server-esbuild';
import {
	emulateMediaPlugin,
	sendKeysPlugin,
	setViewportPlugin,
} from '@web/test-runner-commands/plugins';
import { playwrightLauncher } from '@web/test-runner-playwright';
import { visualRegressionPlugin } from '@web/test-runner-visual-regression/plugin';
import * as sass from 'sass';

const extensionRoot = fileURLToPath( new URL( '../..', import.meta.url ) );
const scssInlinePrefix = '/__scss_inline__';
const themeIconModulePath = '/__theme_icon__.js';
const themeIconSource = '@tocus/theme/icon.svg?raw';
const themeIconMarkup = readFileSync(
	path.resolve( extensionRoot, '../../packages/theme/assets/icon.svg' ),
	'utf8',
);
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
const themeStyles = sass
	.compile( path.resolve( extensionRoot, '../../packages/theme/index.scss' ) )
	.css.replace( /@import '@fontsource-variable\/fredoka\/wght\.css';/gu, themeFontStyles );
const testThemes = readFileSync( path.join( extensionRoot, 'config/wtr/test-themes.css' ), 'utf8' );
const updateScreenshots = process.argv.includes( '--update-snapshots' );
const visualTestsRequested = process.argv.some( ( argument ) => argument.includes( 'visual.wtr.test.ts' ) );

/**
 * Resolves a root-relative SCSS request without allowing it to leave the extension.
 * @param {string} requestPath - Root-relative request path.
 * @return {string|undefined} The absolute SCSS path when it is safe to serve.
 */
function resolveScssPath( requestPath ) {
	if ( ! requestPath.startsWith( '/' ) ) {
		return undefined;
	}

	const absolutePath = path.resolve( extensionRoot, `.${ requestPath }` );
	const relativePath = path.relative( extensionRoot, absolutePath );
	if (
		path.extname( absolutePath ) !== '.scss' ||
		relativePath === '..' ||
		relativePath.startsWith( `..${ path.sep }` ) ||
		path.isAbsolute( relativePath )
	) {
		return undefined;
	}

	return absolutePath;
}

const scssPlugin = {
	name: 'scss-inline',
	/**
	 * Resolves an inline SCSS import to the local virtual-module namespace.
	 * @param {{ source: string, context: { path: string } }} request - Import resolution request.
	 * @return {string|undefined} Virtual module identifier when the request is safe and supported.
	 */
	resolveImport( request ) {
		const { source, context } = request;

		if ( ! source.startsWith( './' ) && ! source.startsWith( '../' ) ) {
			return undefined;
		}

		if ( ! source.endsWith( '.scss?inline' ) || ! context.path.startsWith( '/' ) ) {
			return undefined;
		}

		const sourcePath = source.slice( 0, -'?inline'.length );
		const resolvedPath = path.posix.resolve( path.posix.dirname( context.path ), sourcePath );
		const absolutePath = resolveScssPath( resolvedPath );
		if ( absolutePath === undefined ) {
			return undefined;
		}

		return `${ scssInlinePrefix }/${ path.relative( extensionRoot, absolutePath ).split( path.sep ).join( '/' ) }`;
	},
	/**
	 * Compiles one resolved virtual SCSS module for the browser test server.
	 * @param {{ path: string }} context - Development-server request context.
	 * @return {{ body: string, headers: { 'cache-control': string }, type: string }|undefined} JavaScript module response when the path is valid.
	 */
	serve( context ) {
		if ( ! context.path.startsWith( scssInlinePrefix ) ) {
			return undefined;
		}

		const relativePath = context.path.slice( scssInlinePrefix.length );
		const absolutePath = resolveScssPath( relativePath );
		if ( absolutePath === undefined ) {
			return undefined;
		}

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

const themeIconPlugin = {
	name: 'theme-icon',
	/**
	 * Resolves the one shared raw theme-icon import used by component tests.
	 * @param {{ source: string }} request - Import resolution request.
	 * @return {string|undefined} Virtual module identifier for the shared icon.
	 */
	resolveImport( request ) {
		return request.source === themeIconSource ? themeIconModulePath : undefined;
	},
	/**
	 * Serves the shared icon as a JavaScript string module.
	 * @param {{ path: string }} context - Development-server request context.
	 * @return {{ body: string, headers: { 'cache-control': string }, type: string }|undefined} Raw icon module response.
	 */
	serve( context ) {
		if ( context.path !== themeIconModulePath ) {
			return undefined;
		}

		return {
			body: `export default ${ JSON.stringify( themeIconMarkup ) };`,
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

/**
 * Configures deterministic local browser tests and the opt-in visual-regression suite.
 * @type {import('@web/test-runner').TestRunnerConfig}
 * @since 0.1.0 Initial implementation.
 */
export default {
	rootDir: extensionRoot,
	files: [ 'src/**/*.wtr.test.ts', '!src/**/visual.wtr.test.ts' ],
	coverage: ! visualTestsRequested,
	coverageConfig: {
		exclude: [
			'src/**/*.wtr.test.ts',
			'src/domains/protection/services/protection-configuration-editor/**/*.ts',
			'src/domains/protection/types/**/*.ts',
			'src/domains/protection/utils/**/*.ts',
			'src/features/protected-sites/services/protected-site-enrollment/**/*.ts',
			'src/features/protected-sites/services/site-permission-manager/**/*.ts',
			'src/features/protected-sites/utils/**/*.ts',
			'src/features/interruption/services/focused-progress-clock/**/*.ts',
			'src/features/interruption/utils/breathing-motion/**/*.ts',
			'src/features/interruption/utils/breathing-sphere-geometry/**/*.ts',
		],
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
			/**
			 * Creates the deterministic Chromium context used by component tests.
			 * @param {{ browser: import('playwright-core').Browser }} launchContext - Playwright launch context.
			 * @return {Promise<import('playwright-core').BrowserContext>} Configured browser context.
			 */
			createBrowserContext: async ( launchContext ) =>
				launchContext.browser.newContext( {
					deviceScaleFactor: 1,
					viewport: { height: 600, width: 800 },
				} ),
		} ),
	],
	plugins: [
		scssPlugin,
		themeIconPlugin,
		esbuildPlugin( {
			loaders: { json: 'json' },
			target: 'es2022',
			ts: true,
			tsconfig: path.join( extensionRoot, 'tsconfig.json' ),
		} ),
		emulateMediaPlugin(),
		sendKeysPlugin(),
		setViewportPlugin(),
		visualRegressionPlugin( {
			update: updateScreenshots,
			diffOptions: { includeAA: false, threshold: 0.1 },
			failureThreshold: 0,
			failureThresholdType: 'pixel',
			/**
			 * Resolves the approved snapshot path for one visual assertion.
			 * @param {{ browser: string, name: string, testFile: string }} artifact - Visual artifact identity.
			 * @return {string} Absolute approved snapshot path.
			 */
			getBaselineName: ( artifact ) => snapshotPath( artifact.testFile, artifact.browser, '', artifact.name ),
			/**
			 * Resolves the diff artifact path for one failed visual assertion.
			 * @param {{ browser: string, name: string, testFile: string }} artifact - Visual artifact identity.
			 * @return {string} Absolute diff artifact path.
			 */
			getDiffName: ( artifact ) => snapshotPath( artifact.testFile, artifact.browser, '__diff__', artifact.name ),
			/**
			 * Resolves the received-image path for one failed visual assertion.
			 * @param {{ browser: string, name: string, testFile: string }} artifact - Visual artifact identity.
			 * @return {string} Absolute received-image path.
			 */
			getFailedName: ( artifact ) => snapshotPath( artifact.testFile, artifact.browser, '__failed__', artifact.name ),
		} ),
	],
	/**
	 * Creates the browser test document with the compiled theme styles.
	 * @param {string} testFramework - Browser test framework module URL.
	 * @return {string} Complete test-runner HTML document.
	 */
	testRunnerHtml: ( testFramework ) =>
		`<!doctype html><html><head><style>${ themeStyles }${ testThemes }</style></head><body><script type="module" src="${ testFramework }"></script></body></html>`,
	testFramework: { config: { timeout: 10_000, ui: 'bdd' } },
	browserStartTimeout: 120_000,
	testsStartTimeout: 60_000,
	testsFinishTimeout: 120_000,
	concurrency: 1,
};
