import { describe, expect, it } from 'vitest';
import { createLinguiRuntimeDependenciesPlugin } from './index.js';

describe( 'createLinguiRuntimeDependenciesPlugin', () => {
	it( 'serves the Lingui runtime through one browser-compatible ESM boundary', async () => {
		const plugin = createLinguiRuntimeDependenciesPlugin();

		await plugin.serverStart();

		expect( plugin.resolveImport( { source: '@lingui/core' } ) ).toBe( '/__lingui_core__.js' );
		expect( plugin.resolveImport( { source: '@messageformat/parser' } ) ).toBeUndefined();
		expect( plugin.serve( { path: '/unrelated.js' } ) ).toBeUndefined();
		expect( plugin.serve( { path: '/__lingui_core__.js' } )?.body ).toContain( 'setupI18n' );
		expect( plugin.serve( { path: '/__lingui_core__.js' } )?.body ).not.toContain(
			'process.env.NODE_ENV',
		);
	} );
} );
