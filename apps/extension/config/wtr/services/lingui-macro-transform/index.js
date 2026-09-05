import path from 'node:path';
import { transformAsync } from '@babel/core';
import linguiMacro from '@lingui/babel-plugin-lingui-macro';
import {
	createCompilationErrorMessage,
	createCompiledCatalog,
	getCatalogForFile,
	getCatalogs,
} from '@lingui/cli/api';
import { getConfig } from '@lingui/conf';

/**
 * Script files that can contain Lingui macros after TypeScript transformation.
 * @since 0.1.0 Initial implementation.
 */
const scriptPathPattern = /\.[cm]?[jt]sx?$/u;

/**
 * Module identifier removed when Lingui macros are compiled.
 * @since 0.1.0 Initial implementation.
 */
const linguiMacroSource = '@lingui/core/macro';

/**
 * Creates a browser-test plugin that compiles production catalogs and Lingui macros.
 * @param {string} extensionRoot - Absolute browser extension workspace directory.
 * @return {import('@web/dev-server-core').Plugin} Browser-test development-server plugin.
 * @since 0.1.0 Initial implementation.
 */
export function createLinguiMacroTransformPlugin( extensionRoot ) {
	return {
		name: 'lingui-macro',
		/**
		 * Serves configured PO catalogs with the production compiler and locale fallbacks.
		 * @param {{ path: string }} context - Development-server request context.
		 * @return {Promise<{ body: string, headers: { 'cache-control': string }, type: string }|undefined>} Compiled catalog module when the request targets a PO file.
		 * @since 0.1.0 Initial implementation.
		 */
		async serve( context ) {
			if ( ! context.path.endsWith( '.po' ) ) {
				return undefined;
			}

			const config = getConfig( { configPath: path.resolve( extensionRoot, '../../lingui.config.ts' ) } );
			const filename = path.resolve( extensionRoot, `.${ context.path }` );
			const fileCatalog = getCatalogForFile(
				path.relative( config.rootDir, filename ),
				await getCatalogs( config ),
			);

			if ( fileCatalog === null ) {
				throw new Error( `${ context.path } is not a configured Lingui catalog.` );
			}

			const { catalog, locale } = fileCatalog;
			const { messages } = await catalog.getTranslations( locale, {
				fallbackLocales: config.fallbackLocales,
				sourceLocale: config.sourceLocale,
			} );
			const { source, errors } = createCompiledCatalog( locale, messages, { namespace: 'es' } );

			if ( errors.length > 0 ) {
				throw new Error( createCompilationErrorMessage( locale, errors ) );
			}

			return { body: source, headers: { 'cache-control': 'no-cache' }, type: 'js' };
		},
		/**
		 * Compiles Lingui macros in one browser-test module.
		 * @param {{ body: unknown, path: string }} context - Development-server response context.
		 * @return {Promise<{ body: string }|undefined>} Transformed JavaScript when the module uses Lingui macros.
		 * @since 0.1.0 Initial implementation.
		 */
		async transform( context ) {
			if (
				typeof context.body !== 'string'
				|| ! scriptPathPattern.test( context.path )
				|| ! context.body.includes( linguiMacroSource )
			) {
				return undefined;
			}

			const result = await transformAsync( context.body, {
				babelrc: false,
				configFile: false,
				filename: path.resolve( extensionRoot, `.${ context.path }` ),
				plugins: [ [ linguiMacro, { descriptorFields: 'all' } ] ],
				sourceMaps: 'inline',
			} );

			return result?.code === undefined || result.code === null
				? undefined
				: { body: result.code };
		},
	};
}
