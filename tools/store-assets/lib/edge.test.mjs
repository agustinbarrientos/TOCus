import { test } from 'node:test';
import assert from 'node:assert/strict';
import { locales } from './catalog.mjs';
import { createEdgePromos, edgeListings } from './edge.mjs';

test( 'exports both Edge sizes for every selected language without filename collisions', () => {
	const assets = createEdgePromos( Object.keys( locales ) );
	assert.equal( assets.length, 20 );
	assert.equal( new Set( assets.map( ( asset ) => asset.file ) ).size, 20 );
	for ( const locale of Object.keys( locales ) ) {
		const localized = assets.filter( ( asset ) => asset.locale === locale );
		assert.deepEqual( localized.map( ( asset ) => [ asset.width, asset.height ] ), [
			[ 440, 280 ], [ 1400, 560 ],
		] );
		assert.ok( localized.every( ( asset ) => asset.file.startsWith( `${ locale }/` ) && asset.headline[ 0 ].trim() ) );
	}
	assert.deepEqual( createEdgePromos( [ 'fr' ] ).map( ( asset ) => asset.file ), [ 'fr/small-440x280.png', 'fr/large-1400x560.png' ] );
} );

test( 'localized search terms meet all three Edge submission limits', () => {
	assert.deepEqual( Object.keys( edgeListings ), Object.keys( locales ) );
	for ( const [ locale, { searchTerms } ] of Object.entries( edgeListings ) ) {
		assert.ok( searchTerms.length > 0 && searchTerms.length <= 7, locale );
		assert.equal( new Set( searchTerms ).size, searchTerms.length, locale );
		assert.ok( searchTerms.every( ( term ) => term.trim() === term && term.length > 0 && term.length <= 30 && ! term.includes( ',' ) ), locale );
		assert.ok( searchTerms.join( ' ' ).split( /\s+/ ).length <= 21, locale );
	}
} );
