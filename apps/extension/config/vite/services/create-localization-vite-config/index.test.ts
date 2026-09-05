import { describe, expect, it } from 'vitest';
import { createLocalizationViteConfig } from './index.ts';

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
} );
