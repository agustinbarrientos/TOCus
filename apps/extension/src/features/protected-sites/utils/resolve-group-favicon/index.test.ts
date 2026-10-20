import { describe, expect, it } from 'vitest';
import { getGroupFaviconHosts, resolveGroupFavicon } from './index';

describe( 'grouped cached favicon fallback', () => {
	it( 'tries the group first and sorts deduplicated configured identities independently of storage order', () => {
		expect( getGroupFaviconHosts( 'youtube.com', [ 'studio.youtube.com', 'youtube.com', 'music.youtube.com',
			'studio.youtube.com' ] ) ).toEqual( [ 'youtube.com', 'studio.youtube.com' ] );
	} );

	it.each( [
		{ group: 'mail.google.com', members: [ 'google.com', 'drive.google.com', 'mail.google.com' ],
			expected: [ 'mail.google.com' ] },
		{ group: 'drive.google.com', members: [ 'mail.google.com', 'google.com', 'drive.google.com' ],
			expected: [ 'drive.google.com' ] },
		{ group: 'google.com', members: [ 'www.google.com', 'mail.google.com', 'drive.google.com' ],
			expected: [ 'google.com', 'www.google.com' ] },
		{ group: 'music.youtube.com', members: [ 'youtube.com', 'studio.youtube.com', 'music.youtube.com' ],
			expected: [ 'music.youtube.com' ] },
		{ group: 'example.com', members: [ 'www.example.com', 'news.example.com', 'www.example.com' ],
			expected: [ 'example.com', 'news.example.com', 'www.example.com' ] },
	] )( 'keeps $group cached candidates within the same website presentation', ( { group, members, expected } ) => {
		expect( getGroupFaviconHosts( group, members ) ).toEqual( expected );
	} );

	it( 'keeps a product monogram when only parent or sibling product icons are cached', async () => {
		const source = await resolveGroupFavicon( {
			/**
			 * Exposes cached parent and sibling icons while the requested product has no icon.
			 * @param host - Requested canonical cache identity.
			 * @return Existing foreign icon, or the requested product cache miss.
			 */
			getSource: ( host ) => host === 'mail.google.com' ? null : `chrome-extension://fixture/${ String( host ) }`,
		}, getGroupFaviconHosts( 'mail.google.com', [ 'google.com', 'drive.google.com' ] ) );
		expect( source ).toBeNull();
	} );

	it( 'prefers an available root icon over member icons', async () => {
		const source = await resolveGroupFavicon( {
			/**
			 * Returns a distinct cache source for every requested host.
			 * @param host - Requested canonical host.
			 * @return Host-specific local source.
			 */
			getSource: ( host ) => `chrome-extension://fixture/${ String( host ) }`,
		}, [ 'youtube.com', 'studio.youtube.com' ] );
		expect( source ).toBe( 'chrome-extension://fixture/youtube.com' );
	} );

	it( 'continues after unavailable or rejected local cache reads', async () => {
		const source = await resolveGroupFavicon( {
			/**
			 * Keeps unresolved placeholders out of the available icon set.
			 * @return No direct source.
			 */
			getSource: () => null,
			/**
			 * Reproduces a root read failure and one member cache miss before an available member.
			 * @param host - Requested canonical host.
			 * @return First available local member icon.
			 */
			resolveSource: ( host ) => host === 'youtube.com' ? Promise.reject( new Error( 'Cache read failed.' ) )
				: Promise.resolve( host === 'studio.youtube.com' ? 'chrome-extension://fixture/studio' : null ),
		}, [ 'youtube.com', 'music.youtube.com', 'studio.youtube.com' ] );
		expect( source ).toBe( 'chrome-extension://fixture/studio' );
	} );

	it( 'keeps the monogram when the provider or every cached identity is unavailable', async () => {
		expect( await resolveGroupFavicon( null, [ 'youtube.com' ] ) ).toBeNull();
		expect( await resolveGroupFavicon( {
			/**
			 * Reports a local cache miss without visiting the website.
			 * @return No icon.
			 */
			getSource: () => null,
		}, [ 'youtube.com', 'studio.youtube.com' ] ) ).toBeNull();
	} );
} );
