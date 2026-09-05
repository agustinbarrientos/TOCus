import { describe, expect, it } from 'vitest';
import { createLinguiMacroTransformPlugin } from './index.js';

describe( 'createLinguiMacroTransformPlugin', () => {
	it( 'compiles Lingui macros after TypeScript transformation', async () => {
		const plugin = createLinguiMacroTransformPlugin( '/extension' );
		const result = await plugin.transform( {
			body: "import { msg } from '@lingui/core/macro';\nexport const translate = ( i18n ) => i18n._( msg`Take a moment` );",
			path: '/src/localization/browser-test-sample.ts',
		} );

		expect( result?.body ).not.toContain( '@lingui/core/macro' );
		expect( result?.body ).toContain( 'Take a moment' );
	} );

	it.each( [
		{ body: new Uint8Array(), path: '/src/sample.ts' },
		{ body: "import { msg } from '@lingui/core/macro';", path: '/src/sample.css' },
		{ body: 'export const value = true;', path: '/src/sample.ts' },
	] )( 'ignores a response that cannot contain a Lingui macro', async ( context ) => {
		const plugin = createLinguiMacroTransformPlugin( '/extension' );

		expect( await plugin.transform( context ) ).toBeUndefined();
	} );
} );
