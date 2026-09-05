import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, test } from 'vitest';
import { createTabFaviconAssets } from './index.ts';

describe( 'createTabFaviconAssets', () => {
	test( 'generates contrasting PNGs with the canonical icon silhouette', async () => {
		const directory = await mkdtemp( join( tmpdir(), 'tocus-tab-favicons-' ) );
		const source = await readFile( new URL( '../../../../../../packages/theme/assets/icon.svg', import.meta.url ) );
		const referenceAlpha = await sharp( source ).resize( 32 ).extractChannel( 'alpha' ).raw().toBuffer();

		try {
			const assets = await createTabFaviconAssets( directory );

			expect( assets.map( ( asset ) => asset.relativeDest ) ).toEqual( [
				'icons/tab-dark.png',
				'icons/tab-light.png',
			] );

			for ( const [ index, asset ] of assets.entries() ) {
				const image = await sharp( asset.absoluteSrc )
					.ensureAlpha().raw().toBuffer( { resolveWithObject: true } );
				const alpha = await sharp( asset.absoluteSrc ).extractChannel( 'alpha' ).raw().toBuffer();
				const expectedColor = index === 0 ? [ 116, 67, 49 ] : [ 255, 248, 240 ];
				const opaqueColors = new Set<string>();

				expect( image.info.width ).toBe( 32 );
				expect( image.info.height ).toBe( 32 );
				expect( alpha ).toEqual( referenceAlpha );

				for ( let offset = 0; offset < image.data.length; offset += 4 ) {
					if ( image.data[ offset + 3 ] === 255 ) {
						opaqueColors.add( image.data.subarray( offset, offset + 3 ).join( ',' ) );
					}
				}

				expect( [ ...opaqueColors ] ).toEqual( [ expectedColor.join( ',' ) ] );
			}
		} finally {
			await rm( directory, { recursive: true, force: true } );
		}
	} );
} );
