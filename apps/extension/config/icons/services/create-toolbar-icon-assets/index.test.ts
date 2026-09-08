import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { expect, test } from 'vitest';
import { createToolbarIconAssets } from './index.ts';

test( 'generates separate two-tone toolbar assets without changing the canonical brand icon', async () => {
	const directory = await mkdtemp( join( tmpdir(), 'tocus-toolbar-icons-' ) );
	const sourceUrl = new URL( '../../../../../../packages/theme/assets/icon.svg', import.meta.url );
	const original = await readFile( sourceUrl );
	try {
		const assets = await createToolbarIconAssets( directory );
		expect( assets.map( ( asset ) => asset.relativeDest ) ).toEqual( [
			'icons/toolbar-16.png', 'icons/toolbar-19.png', 'icons/toolbar-24.png',
			'icons/toolbar-32.png', 'icons/toolbar-38.png', 'icons/toolbar-64.png',
		] );
		for ( const asset of assets ) {
			const { data, info } = await sharp( asset.absoluteSrc )
				.ensureAlpha().raw().toBuffer( { resolveWithObject: true } );
			expect( info.width ).toBe( info.height );
			expect( data[ 3 ] ).toBe( 0 );
		}
		// A larger sample retains solid face and keyline pixels without small-icon antialias blending.
		const image = await sharp( join( directory, 'icons/toolbar-64.png' ) ).ensureAlpha().raw().toBuffer();
		const colors = new Set<string>();
		for ( let offset = 0; offset < image.length; offset += 4 ) {
			if ( image[ offset + 3 ] === 255 ) {
				colors.add( image.subarray( offset, offset + 3 ).join( ',' ) );
			}
		}
		expect( colors.has( '255,248,240' ) ).toBe( true );
		expect( colors.has( '116,67,49' ) ).toBe( true );
		expect( await readFile( sourceUrl ) ).toEqual( original );
	} finally {
		await rm( directory, { recursive: true, force: true } );
	}
} );
