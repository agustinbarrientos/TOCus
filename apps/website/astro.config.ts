import { fileURLToPath } from 'node:url';
import babel from '@rolldown/plugin-babel';
import { lingui, linguiTransformerBabelPreset } from '@lingui/vite-plugin';
import { defineConfig } from 'astro/config';

/**
 * Absolute path to the repository's shared Lingui configuration.
 * @since 0.1.0 Initial implementation.
 */
const linguiConfigPath = fileURLToPath( new URL( '../../lingui.config.ts', import.meta.url ) );

/**
 * Configures the static website build.
 * @since 0.1.0 Initial implementation.
 */
export default defineConfig( {
	output: 'static',
	vite: {
		plugins: [
			...lingui( { configPath: linguiConfigPath } ),
			babel( {
				presets: [ linguiTransformerBabelPreset( {}, { configPath: linguiConfigPath } ) ],
			} ),
		],
	},
} );
