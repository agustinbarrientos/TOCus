import { fileURLToPath } from 'node:url';
import babel from '@rolldown/plugin-babel';
import { lingui, linguiTransformerBabelPreset } from '@lingui/vite-plugin';
import { createLocalizationRuntimeMessagesPlugin } from '../localization-runtime-messages/index.ts';
import type { LocalizationViteConfig } from './types.ts';

/**
 * Absolute path to the repository shared Lingui configuration.
 * @since 1.0.0 Initial implementation.
 */
const LinguiConfigPath = fileURLToPath( new URL( '../../../../../../lingui.config.ts', import.meta.url ) );

/**
 * Babel-compatible matcher for JavaScript and TypeScript source inside this repository.
 * @since 1.0.0 Initial implementation.
 */
const RepositorySourcePattern = new RegExp( `^${ fileURLToPath( new URL( '../../../../../../', import.meta.url ) )
	.split( /[\\/]/u )
	.map( ( segment ) => segment.replace( /[.*+?^${}()|[\]\\]/gu, '\\$&' ) )
	.join( String.raw`[\\/]` ) }.*\\.(?:[jt]sx?|[cm][jt]s)(?:$|\\?)`, 'u' );

/**
 * Creates the localization Vite pipeline for every WXT build group.
 * @return Vite configuration containing runtime projections and Lingui compilation.
 * @since 1.0.0 Initial implementation.
 */
export function createLocalizationViteConfig(): LocalizationViteConfig {
	return {
		plugins: [
			createLocalizationRuntimeMessagesPlugin(),
			...lingui( { configPath: LinguiConfigPath } ),
			babel( {
				include: RepositorySourcePattern,
				plugins: [ [ '@babel/plugin-proposal-decorators', { version: '2023-11' } ] ],
				presets: [ linguiTransformerBabelPreset( {}, { configPath: LinguiConfigPath } ) ],
			} ),
		],
	};
}

export { type LocalizationViteConfig } from './types.ts';
