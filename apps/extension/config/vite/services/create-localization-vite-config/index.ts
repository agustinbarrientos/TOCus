import { fileURLToPath } from 'node:url';
import babel from '@rolldown/plugin-babel';
import { lingui, linguiTransformerBabelPreset } from '@lingui/vite-plugin';
import { createLocalizationRuntimeMessagesPlugin } from '../localization-runtime-messages/index.ts';
import { type LocalizationViteConfig } from './types.ts';

/**
 * Absolute path to the repository shared Lingui configuration.
 * @since 0.1.0 Initial implementation.
 */
const LinguiConfigPath = fileURLToPath( new URL( '../../../../../../lingui.config.ts', import.meta.url ) );

/**
 * Creates the localization Vite pipeline for every WXT build group.
 * @return Vite configuration containing runtime projections and Lingui compilation.
 * @since 0.1.0 Initial implementation.
 */
export function createLocalizationViteConfig(): LocalizationViteConfig {
	return {
		plugins: [
			createLocalizationRuntimeMessagesPlugin(),
			...lingui( { configPath: LinguiConfigPath } ),
			babel( {
				plugins: [ [ '@babel/plugin-proposal-decorators', { version: '2023-11' } ] ],
				presets: [ linguiTransformerBabelPreset( {}, { configPath: LinguiConfigPath } ) ],
			} ),
		],
	};
}

export { type LocalizationViteConfig } from './types.ts';
