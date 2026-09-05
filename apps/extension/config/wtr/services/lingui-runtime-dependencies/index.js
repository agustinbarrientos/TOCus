import { createRequire } from 'node:module';
import { build } from 'esbuild';

/**
 * Virtual module used to expose Lingui's runtime to the browser test runner.
 * @since 0.1.0 Initial implementation.
 */
const linguiCoreModulePath = '/__lingui_core__.js';

/**
 * Package resolver rooted at the browser extension workspace.
 * @since 0.1.0 Initial implementation.
 */
const extensionRequire = createRequire( new URL( '../../../../package.json', import.meta.url ) );

/**
 * Absolute Lingui runtime entry bundled for browser tests.
 * @since 0.1.0 Initial implementation.
 */
const linguiCoreEntry = extensionRequire.resolve( '@lingui/core' );

/**
 * Builds the browser-compatible ESM boundary for Lingui and its CommonJS dependencies.
 * @return {Promise<string>} Bundled ESM source that exposes Lingui's public runtime API.
 * @since 0.1.0 Initial implementation.
 */
async function buildLinguiCoreModule() {
	const result = await build( {
		bundle: true,
		define: { 'process.env.NODE_ENV': JSON.stringify( 'test' ) },
		entryPoints: [ linguiCoreEntry ],
		format: 'esm',
		platform: 'browser',
		target: 'es2022',
		write: false,
	} );
	const output = result.outputFiles[ 0 ];

	if ( output === undefined ) {
		throw new Error( 'Unable to prepare the Lingui runtime for browser tests.' );
	}

	return output.text;
}

/**
 * Creates a browser-test plugin that exposes Lingui and its dependencies as browser-compatible ESM.
 * @return {import('@web/dev-server-core').Plugin} Browser-test development-server plugin.
 * @since 0.1.0 Initial implementation.
 */
export function createLinguiRuntimeDependenciesPlugin() {
	let linguiCoreModule;

	return {
		name: 'lingui-runtime-dependencies',
		/**
		 * Builds the virtual Lingui module before the browser-test server accepts requests.
		 * @return {Promise<void>} Promise resolved when the Lingui module is ready.
		 * @since 0.1.0 Initial implementation.
		 */
		async serverStart() {
			linguiCoreModule = await buildLinguiCoreModule();
		},
		/**
		 * Redirects the Lingui runtime import to the browser-compatible virtual module.
		 * @param {{ source: string }} request - Import resolution request.
		 * @return {string|undefined} Virtual module identifier for the Lingui runtime.
		 * @since 0.1.0 Initial implementation.
		 */
		resolveImport( request ) {
			return request.source === '@lingui/core' ? linguiCoreModulePath : undefined;
		},
		/**
		 * Serves the prepared Lingui runtime module to browser tests.
		 * @param {{ path: string }} context - Development-server request context.
		 * @return {{ body: string, headers: { 'cache-control': string }, type: string }|undefined} Lingui module response for its virtual path.
		 * @since 0.1.0 Initial implementation.
		 */
		serve( context ) {
			if ( context.path !== linguiCoreModulePath || linguiCoreModule === undefined ) {
				return undefined;
			}

			return {
				body: linguiCoreModule,
				headers: { 'cache-control': 'no-cache' },
				type: 'js',
			};
		},
	};
}
