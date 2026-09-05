import path from 'node:path';
import { transformAsync } from '@babel/core';
import linguiMacro from '@lingui/babel-plugin-lingui-macro';

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
 * Creates a browser-test plugin that compiles Lingui macros after TypeScript transformation.
 * @param {string} extensionRoot - Absolute browser extension workspace directory.
 * @return {import('@web/dev-server-core').Plugin} Browser-test development-server plugin.
 * @since 0.1.0 Initial implementation.
 */
export function createLinguiMacroTransformPlugin( extensionRoot ) {
	return {
		name: 'lingui-macro',
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
