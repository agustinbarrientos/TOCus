import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { locales } from './catalog.mjs';
import { createOgAssets, syncOgImages } from './og.mjs';

test( 'OG exports preserve all localized headlines and the website metadata filenames', () => {
	const assets = createOgAssets( Object.keys( locales ) );
	assert.equal( assets.length, 10 );
	assert.equal( new Set( assets.map( ( asset ) => asset.file ) ).size, 10 );
	for ( const asset of assets ) {
		assert.equal( asset.file, `${ asset.locale.toLowerCase() }.png` );
		assert.deepEqual( [ asset.width, asset.height ], [ 1200, 628 ] );
		assert.equal( asset.headline.join( asset.locale === 'ja' ? '' : ' ' ), locales[ asset.locale ].captions[ 0 ] );
	}
	assert.equal( assets.find( ( asset ) => asset.locale === 'ja' ).font, 'Chiron GoRound TC' );
	assert.equal( assets.find( ( asset ) => asset.locale === 'ru' ).font, 'Nunito' );
	assert.throws( () => createOgAssets( [ '../outside' ] ), /Unknown OG locale/ );
} );

test( 'website sync copies only selected finished PNGs, never the preview or private masters', async () => {
	const root = await mkdtemp( join( tmpdir(), 'tocus-og-sync-' ) );
	try {
		const output = join( root, 'output' );
		const destination = join( root, 'apps/website/public/images/og' );
		await mkdir( output );
		await mkdir( destination, { recursive: true } );
		await writeFile( join( destination, 'fr.png' ), 'existing French image' );
		await writeFile( join( output, 'en.png' ), 'rendered English image' );
		await writeFile( join( output, 'index.html' ), 'private preview' );
		await writeFile( join( output, 'master.png' ), 'private master' );
		await syncOgImages( root, output, [ 'en' ] );
		assert.deepEqual( ( await readdir( destination ) ).sort(), [ 'en.png', 'fr.png' ] );
		assert.equal( await readFile( join( destination, 'en.png' ), 'utf8' ), 'rendered English image' );
		assert.equal( await readFile( join( destination, 'fr.png' ), 'utf8' ), 'existing French image' );
		await assert.rejects( syncOgImages( root, output, [ '../../private' ] ), /Unknown OG locale/ );
	} finally {
		await rm( root, { recursive: true, force: true } );
	}
} );
