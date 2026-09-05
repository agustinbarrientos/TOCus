import { fileURLToPath } from 'node:url';
import * as linguiCompiler from '@lingui/cli/api';
import { setupI18n } from '@lingui/core';
import { generateMessageId } from '@lingui/message-utils/generateMessageId';
import { describe, expect, it, vi } from 'vitest';
import { createLinguiMacroTransformPlugin } from './index.js';

vi.mock( '@lingui/cli/api', { spy: true } );

/**
 * Extension workspace containing the production translation catalogs.
 * @since 0.1.0 Initial implementation.
 */
const extensionRoot = fileURLToPath( new URL( '../../../../', import.meta.url ) );

describe( 'createLinguiMacroTransformPlugin', () => {
	it.each( [
		[ 'es', 'Elige sitios web' ],
		[ 'es-AR', 'Eleg\u00ed sitios' ],
	] )( 'serves the production %s PO catalog as executable JavaScript', async ( locale, title ) => {
		const plugin = createLinguiMacroTransformPlugin( extensionRoot );
		const result = await plugin.serve( { path: `/locales/${ locale }.po` } );

		expect( result?.type ).toBe( 'js' );
		const { messages } = await import( `data:text/javascript;base64,${ Buffer.from( result.body ).toString( 'base64' ) }` );
		const i18n = setupI18n( { locale, messages: { [ locale ]: messages } } );
		const durationId = generateMessageId( '{count, plural, one {# hour} other {# hours}}' );

		expect( i18n._( generateMessageId( 'Choose websites' ) ) ).toBe( title );
		expect( i18n._( durationId, { count: 1 } ) ).toBe( '1 hora' );
		expect( i18n._( durationId, { count: 2 } ) ).toBe( '2 horas' );
	} );

	it( 'leaves non-PO requests to the existing browser-test pipeline', async () => {
		const plugin = createLinguiMacroTransformPlugin( '/extension' );

		expect( await plugin.serve( { path: '/src/sample.ts' } ) ).toBeUndefined();
	} );

	it( 'rejects PO requests outside the configured translation catalogs', async () => {
		const plugin = createLinguiMacroTransformPlugin( extensionRoot );

		await expect( plugin.serve( { path: '/src/unconfigured.po' } ) ).rejects.toThrow( 'not a configured Lingui catalog' );
	} );

	it( 'reports catalog compilation errors instead of serving incomplete translations', async () => {
		const plugin = createLinguiMacroTransformPlugin( extensionRoot );
		const invalidCatalog = linguiCompiler.createCompiledCatalog(
			'es',
			{ invalid: '{count, plural, nonsense {test} other {test}}' },
			{ namespace: 'es' },
		);
		const compiler = vi.spyOn( linguiCompiler, 'createCompiledCatalog' ).mockReturnValueOnce( invalidCatalog );

		try {
			await expect( plugin.serve( { path: '/locales/es.po' } ) ).rejects.toThrow( 'invalid' );
		} finally {
			compiler.mockRestore();
		}
	} );

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
