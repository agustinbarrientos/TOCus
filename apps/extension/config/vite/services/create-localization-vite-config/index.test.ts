import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createLocalizationViteConfig } from './index.ts';

/**
 * Runs source through the configured Babel member of the localization pipeline.
 * @param source JavaScript or TypeScript source to transform.
 * @param id Absolute module identifier supplied by Vite.
 * @return The Babel transform result, or undefined when the module is outside the pipeline boundary.
 */
async function transformLocalizationSource( source: string, id: string ): Promise< unknown > {
	const plugin = await createLocalizationViteConfig().plugins.at( -1 );

	if ( ! plugin || typeof plugin !== 'object' || ! ( 'outputOptions' in plugin ) ||
		typeof plugin.outputOptions !== 'function' || ! ( 'transform' in plugin ) ||
		typeof plugin.transform !== 'object' ||
		! ( 'handler' in plugin.transform ) || typeof plugin.transform.handler !== 'function' ) {
		throw new TypeError( 'The localization pipeline does not expose the expected Babel hooks.' );
	}

	const outputOptionsHook = plugin.outputOptions as unknown as ( outputOptions: unknown ) => unknown;
	const transformHook = plugin.transform.handler as unknown as (
		sourceCode: string,
		moduleId: string,
		options: { moduleType: string },
	) => Promise< unknown >;

	outputOptionsHook.call( { meta: {} }, {} );

	return transformHook.call( {
		/**
		 * Throws Babel diagnostics using the plugin context contract.
		 * @param error Babel diagnostic to propagate.
		 */
		error( error: unknown ): never {
			throw error;
		},
	}, source, id, { moduleType: 'tsx' } );
}

describe( 'createLocalizationViteConfig', () => {
	it( 'creates the complete Lingui plugin pipeline for every WXT build group', () => {
		const config = createLocalizationViteConfig();
		const pluginNames = config.plugins
			.flat()
			.map( ( plugin ) => plugin && 'name' in plugin ? plugin.name : undefined );

		expect( pluginNames ).toContain( 'tocus-localization-runtime-messages' );
		expect( pluginNames ).toContain( 'vite-plugin-lingui-get-config' );
		expect( pluginNames ).toContain( 'vite-plugin-lingui-load-catalog' );
		expect( config.plugins ).toHaveLength( 4 );
	} );

	it( 'transforms localization source files throughout the repository', async () => {
		const source = `
			import { msg } from '@lingui/core/macro';
			const logged = () => undefined;
			@logged
			class MessageView {}
			export const descriptor = msg\`Pause before visiting addictive websites\`;
		`;
		const sourceIds = [
			`${ fileURLToPath( new URL( '../../../../src/localization/example.tsx', import.meta.url ) ) }?direct`,
			fileURLToPath( new URL( '../../../../../../packages/ui/src/example.tsx', import.meta.url ) ),
		];

		for ( const sourceId of sourceIds ) {
			const result = await transformLocalizationSource( source, sourceId );

			if ( ! result || typeof result !== 'object' || ! ( 'code' in result ) || typeof result.code !== 'string' ) {
				throw new TypeError( `The localization pipeline did not transform ${ sourceId }.` );
			}

			expect( result.code ).toContain( 'export const descriptor' );
			expect( result.code ).toContain( 'Pause before visiting addictive websites' );
			expect( result.code ).not.toContain( '/macro' );
			expect( result.code ).not.toContain( '@logged' );
		}
	} );

	it( 'does not transform optimized dependencies in permanent or temporary caches', async () => {
		const dependencySource = 'export const dependencyValue = true;';
		const dependencyIds = [
			fileURLToPath( new URL( '../../../../../../node_modules/.vite/deps/react-dom_client.js', import.meta.url ) ),
			resolve( tmpdir(), 'tocus-ui-vite-cache/deps/@mantine_core.js' ),
			resolve( tmpdir(), 'tocus-ui-vite-cache/deps_temp_a1b2c3/zod.js' ),
		];

		for ( const dependencyId of dependencyIds ) {
			await expect( transformLocalizationSource( dependencySource, dependencyId ) ).resolves.toBeUndefined();
		}
	} );
} );
