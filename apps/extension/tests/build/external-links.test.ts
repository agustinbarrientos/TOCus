import { readFile, readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { IconName } from '@tocus/ui/types';

/**
 * Generated website pages checked for shared external-link artwork.
 * @since 1.0.0 Initial implementation.
 */
const websiteOutput = new URL( '../../../website/dist/', import.meta.url );

describe( 'external website links', () => {
	it( 'marks external and new-tab destinations without marking same-tab internal navigation', async () => {
		const externalArtwork = ( await readFile( new URL(
			`../../../../packages/theme/assets/icons/${ IconName.ARROW_UP_RIGHT_FROM_SQUARE }.svg`, import.meta.url,
		), 'utf8' ) ).trim();
		const paths = ( await readdir( websiteOutput, { recursive: true } ) ).filter( ( path ) => path.endsWith( '.html' ) );
		// Only the homepage, Privacy Policy and email support page belong in production.
		const locales = [ '', 'de/', 'es/', 'es-ar/', 'fr/', 'it/', 'ja/', 'pt-br/', 'pt-pt/', 'ru/' ];
		const expectedPages = locales.flatMap( ( locale ) => [
			`${ locale }index.html`, `${ locale }privacy/index.html`, `${ locale }support/index.html`,
		] );
		expect( paths.sort() ).toEqual( expectedPages.sort() );
		for ( const path of paths ) {
			const page = await readFile( new URL( path, websiteOutput ), 'utf8' );
			const links = Array.from( page.matchAll( /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gu ) );
			expect( links.length, path ).toBeGreaterThan( 0 );
			for ( const [ link, href, contents ] of links ) {
				if ( href?.startsWith( 'https://' ) || /^<a\b[^>]*\btarget="_blank"/u.test( link ) ) {
					expect( contents ).toContain( 'aria-hidden="true"' );
					expect( contents ).toContain( 'viewBox="0 0 640 640"' );
					expect( contents ).toContain( externalArtwork );
				} else {
					// Same-tab language and brand links can contain artwork, but not the new-tab glyph.
					expect( contents ).not.toContain( externalArtwork );
				}
			}
		}
	} );
} );
