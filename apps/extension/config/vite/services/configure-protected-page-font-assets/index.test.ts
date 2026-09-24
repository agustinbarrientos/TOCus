import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vite';
import { describe, expect, it } from 'vitest';
import type { Entrypoint, WxtViteConfig } from 'wxt';
import { ExtensionBuildBrowser } from '../../../../src/shared/utils/build-browser/types';
import { configureProtectedPageFontAssets, resolveProtectedPageFontUrl } from './index.ts';

const fontEntrypoint: Entrypoint = {
	name: 'protected-page-font',
	type: 'unlisted-style',
	inputPath: fileURLToPath( new URL( '../../../../src/entrypoints/protected-page-font.scss', import.meta.url ) ),
	outputDir: fileURLToPath( new URL( '../../../../.output/chrome-mv3/', import.meta.url ) ),
	options: {},
};
const fontCases = [
	[ 'fredoka-hebrew-wght-normal.woff2', 'assets/protected-page-font.woff2' ],
	[ 'fredoka-latin-ext-wght-normal.woff2', 'assets/protected-page-font2.woff2' ],
	[ 'fredoka-latin-wght-normal.woff2', 'assets/protected-page-font3.woff2' ],
] as const;
const [ hebrewFont, latinExtendedFont, latinFont ] = fontCases;

/**
 * Recreates WXT's CSS group merge with the existing colliding asset-name policy.
 * @return The Vite configuration passed to the WXT extension hook.
 */
function createFontConfig(): WxtViteConfig {
	return mergeConfig( {
		build: { modulePreload: false, rolldownOptions: { optimization: { inlineConst: false } } },
	}, {
		build: {
			rollupOptions: {
				input: { 'protected-page-font': fontEntrypoint.inputPath },
				output: {
					chunkFileNames: 'chunks/[name].js',
					/**
					 * Supplies WXT's original CSS entrypoint asset-name pattern.
					 * @return The filename template shared by every emitted asset.
					 */
					assetFileNames: () => 'assets/protected-page-font.[ext]',
				},
			},
		},
	} );
}

/**
 * Asks the configured asset emitter for one source file's destination.
 * @param config - Vite configuration after the hook runs.
 * @param names - Original filenames supplied by Vite for an emitted asset.
 * @return The destination filename or template.
 */
function getAssetFilename( config: WxtViteConfig, names: string[] ): string {
	const output = config.build?.rolldownOptions?.output;

	if ( output === undefined || Array.isArray( output ) || typeof output.assetFileNames !== 'function' ) {
		throw new Error( 'Expected a single output with a filename callback.' );
	}

	return output.assetFileNames( { type: 'asset', names, originalFileNames: [], source: new Uint8Array() } );
}

describe( 'configureProtectedPageFontAssets', () => {
	it.each( [ ExtensionBuildBrowser.CHROME, ExtensionBuildBrowser.EDGE ] )(
		'resolves %s font URLs from the installed extension rather than the website', ( browser ) => {
			const config = createFontConfig();
			configureProtectedPageFontAssets( [ fontEntrypoint ], config, browser );
			for ( const [ , filename ] of fontCases ) {
				expect( config.experimental?.renderBuiltUrl?.( filename, {
					hostId: 'assets/protected-page-font.css', hostType: 'css', type: 'asset', ssr: false,
				} ) )
					.toBe( `chrome-extension://__MSG_@@extension_id__/${ filename }` );
			}
			expect( resolveProtectedPageFontUrl( 'assets/unrelated.svg', browser ) ).toBeUndefined();
		},
	);

	it.each( [ ExtensionBuildBrowser.FIREFOX, ExtensionBuildBrowser.SAFARI ] )(
		'preserves native injected-stylesheet URL resolution in %s', ( browser ) => {
			const config = createFontConfig();
			configureProtectedPageFontAssets( [ fontEntrypoint ], config, browser );
			expect( config.experimental?.renderBuiltUrl ).toBeUndefined();
			expect( resolveProtectedPageFontUrl( latinFont[ 1 ], browser ) ).toBeUndefined();
		},
	);

	it.each( [
		{ order: [ hebrewFont, latinExtendedFont, latinFont ] },
		{ order: [ hebrewFont, latinFont, latinExtendedFont ] },
		{ order: [ latinExtendedFont, hebrewFont, latinFont ] },
		{ order: [ latinExtendedFont, latinFont, hebrewFont ] },
		{ order: [ latinFont, hebrewFont, latinExtendedFont ] },
		{ order: [ latinFont, latinExtendedFont, hebrewFont ] },
	] )( 'keeps font identity stable for emission order %#', ( { order } ) => {
		const config = createFontConfig();
		configureProtectedPageFontAssets( [ fontEntrypoint ], config, ExtensionBuildBrowser.CHROME );

		for ( const [ source, destination ] of order ) {
			expect( getAssetFilename( config, [ source ] ) ).toBe( destination );
		}
	} );

	it( 'preserves CSS naming and the remaining build configuration', () => {
		const config = createFontConfig();
		configureProtectedPageFontAssets( [ fontEntrypoint ], config, ExtensionBuildBrowser.CHROME );

		expect( getAssetFilename( config, [ 'protected-page-font.css' ] ) ).toBe( 'assets/protected-page-font.[ext]' );
		expect( config.build?.modulePreload ).toBe( false );
		expect( config.build?.rolldownOptions?.input ).toEqual( { 'protected-page-font': fontEntrypoint.inputPath } );
		expect( config.build?.rolldownOptions?.optimization ).toEqual( { inlineConst: false } );
		expect( config.build?.rolldownOptions?.output ).toMatchObject( { chunkFileNames: 'chunks/[name].js' } );
	} );

	it.each( [
		[],
		[ fontEntrypoint, fontEntrypoint ],
		[ { ...fontEntrypoint, name: 'other-style' } ],
		[ { ...fontEntrypoint, type: 'content-script-style' as const } ],
	] )( 'leaves unrelated entrypoint groups unchanged: %j', ( ...entrypoints ) => {
		const config = createFontConfig();
		const originalOutput = config.build?.rolldownOptions?.output;
		configureProtectedPageFontAssets( entrypoints, config, ExtensionBuildBrowser.CHROME );

		expect( config.build?.rolldownOptions?.output ).toBe( originalOutput );
		expect( config.experimental?.renderBuiltUrl ).toBeUndefined();
		expect( getAssetFilename( config, [ 'fredoka-latin-wght-normal.woff2' ] ) )
			.toBe( 'assets/protected-page-font.[ext]' );
	} );

	it.each( [
		{},
		{ build: {} },
		{ build: { rolldownOptions: {} } },
		{ build: { rolldownOptions: { output: [] } } },
		{ build: { rolldownOptions: { output: {} } } },
	] )( 'rejects a changed WXT output contract: %j', ( config ) => {
		expect( () => {
			configureProtectedPageFontAssets( [ fontEntrypoint ], config, ExtensionBuildBrowser.CHROME );
		} )
			.toThrow( 'Expected WXT to configure one protected-page font output with asset filenames.' );
	} );

	it( 'preserves a string asset template for non-font assets', () => {
		const config: WxtViteConfig = {
			build: { rolldownOptions: { output: { assetFileNames: 'assets/[name].[ext]' } } },
		};
		configureProtectedPageFontAssets( [ fontEntrypoint ], config, ExtensionBuildBrowser.CHROME );

		expect( getAssetFilename( config, [ 'protected-page-font.css' ] ) ).toBe( 'assets/[name].[ext]' );
		expect( getAssetFilename( config, [ 'fredoka-latin-wght-normal.woff2' ] ) )
			.toBe( 'assets/protected-page-font3.woff2' );
	} );

	it.each( [
		[ 'fredoka-new-subset-wght-normal.woff2' ],
		[ 'fredoka-hebrew-wght-normal.woff2', 'fredoka-latin-wght-normal.woff2' ],
	] )( 'rejects unrecognized or ambiguous font identities: %j', ( ...names ) => {
		const config = createFontConfig();
		configureProtectedPageFontAssets( [ fontEntrypoint ], config, ExtensionBuildBrowser.CHROME );

		expect( () => getAssetFilename( config, names ) ).toThrow( 'Unexpected protected-page font asset:' );
	} );
} );
