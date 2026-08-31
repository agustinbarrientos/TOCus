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
const themeStyles = sass
	.compile( path.resolve( extensionRoot, '../../packages/theme/index.scss' ) )
	.css.replace( /@import '@fontsource-variable\/fredoka\/wght\.css';/gu, themeFontStyles );
const testThemes = readFileSync( path.join( extensionRoot, 'config/wtr/test-themes.css' ), 'utf8' );
const updateScreenshots = process.argv.includes( '--update-snapshots' );

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
	resolveImport( { source, context } ) {
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
	files: [ 'src/**/*.wtr.test.ts', '!src/**/visual.wtr.test.ts' ],
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
		`<!doctype html><html><head><style>${ themeStyles }${ testThemes }</style></head><body><script type="module" src="${ testFramework }"></script></body></html>`,
	testFramework: { config: { timeout: 10_000, ui: 'bdd' } },
	browserStartTimeout: 120_000,
	testsStartTimeout: 60_000,
	testsFinishTimeout: 120_000,
	concurrency: 1,
};
