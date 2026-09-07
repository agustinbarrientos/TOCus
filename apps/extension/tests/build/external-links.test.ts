import { readFile, readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

/**
 * Generated website pages checked for shared external-link artwork.
 * @since 0.1.0 Initial implementation.
 */
const websiteOutput = new URL( '../../../website/dist/', import.meta.url );

describe( 'external website links', () => {
	it( 'marks external destinations with the shared icon in every language without marking internal navigation', async () => {
		const paths = ( await readdir( websiteOutput, { recursive: true } ) ).filter( ( path ) => path.endsWith( 'index.html' ) );
		// Public routes must exist, while additional pages (such as the local mascot lab)
		// are also inspected without assuming that every page has outbound navigation.
		expect( paths ).toEqual( expect.arrayContaining( [
			'index.html', 'de/index.html', 'es/index.html', 'es-ar/index.html',
			'fr/index.html', 'it/index.html', 'ja/index.html', 'pt-br/index.html',
			'pt-pt/index.html', 'ru/index.html', 'privacy/index.html', 'support/index.html',
		] ) );
		for ( const path of paths ) {
			const page = await readFile( new URL( path, websiteOutput ), 'utf8' );
			const links = Array.from( page.matchAll( /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gu ) );
			expect( links.length, path ).toBeGreaterThan( 0 );
			for ( const [ , href, contents ] of links ) {
				if ( href?.startsWith( 'https://' ) ) {
					expect( contents ).toContain( 'aria-hidden="true"' );
					expect( contents ).toContain( 'viewBox="0 0 640 640"' );
					expect( contents ).toContain( 'M354.4 83.8' );
				} else {
					// Internal language and brand links can contain artwork, but not the outbound glyph.
					expect( contents ).not.toContain( 'M354.4 83.8' );
				}
			}
		}
	} );
} );
