import { describe, expect, it } from 'vitest';
import { FocusLinkSchema } from './focus-link';

describe( 'quick link web addresses', () => {
	it.each( [
		[ 'example.com', 'https://example.com/' ],
		[ 'www.example.com', 'https://www.example.com/' ],
		[ '  EXAMPLE.COM/docs?lang=en#start  ', 'https://example.com/docs?lang=en#start' ],
		[ 'example.com:8443/docs?lang=en#start', 'https://example.com:8443/docs?lang=en#start' ],
		[ 'localhost:8443/docs', 'https://localhost:8443/docs' ],
		[ '127.0.0.1:8443/docs', 'https://127.0.0.1:8443/docs' ],
		[ '[::1]:8443/docs', 'https://[::1]:8443/docs' ],
		[ 'b\u00fccher.de/lesen?q=b%20c#eins', 'https://xn--bcher-kva.de/lesen?q=b%20c#eins' ],
		[ 'example.com/docs?next=http://example.org/#start', 'https://example.com/docs?next=http://example.org/#start' ],
		[ 'example.com/a b?query=one%20two#today', 'https://example.com/a%20b?query=one%20two#today' ],
		[ '  HTTP://EXAMPLE.COM:80/docs?lang=en#start  ', 'http://example.com/docs?lang=en#start' ],
		[ 'HTTPS://EXAMPLE.COM:443/docs?lang=en#start', 'https://example.com/docs?lang=en#start' ],
	] )( 'saves %s as %s', ( input, expected ) => {
		expect( FocusLinkSchema.shape.url.parse( input ) ).toBe( expected );
	} );

	it.each( [
		'', ' ', 'not a website', '/relative', '//example.com', '?query=example.com', '#example.com',
		'.', '..', './docs', '../docs', '.\\docs', '..\\docs',
		'https://not a website', 'not%20a%20website', 'https://not%20a%20website',
		'\\example.com', 'example.com:99999', 'example.com:abc',
		'https:example.com', 'https:/example.com', 'https://',
		'javascript:alert(1)', 'javascript:123', 'data:text/html,hello', 'mailto:user@example.com',
		'ftp://example.com', 'ftp:21', 'file:///tmp/file', 'chrome://settings',
		'user@example.com', 'user:password@example.com', 'https://user:password@example.com',
		'example.com/\npath', '\texample.com', 'example.com/\u007f',
		`example.com/${ 'a'.repeat( 2036 ) }`,
	] )( 'rejects unsafe or malformed input %j', ( input ) => {
		expect( FocusLinkSchema.shape.url.safeParse( input ).success ).toBe( false );
	} );

	it( 'enforces the saved URL limit after adding HTTPS and encoding the path', () => {
		expect( FocusLinkSchema.shape.url.parse( `example.com/${ 'a'.repeat( 2028 ) }` ) )
			.toBe( `https://example.com/${ 'a'.repeat( 2028 ) }` );
		expect( FocusLinkSchema.shape.url.safeParse( `example.com/${ 'a'.repeat( 2029 ) }` ).success ).toBe( false );
		expect( FocusLinkSchema.shape.url.safeParse( `example.com/${ '\u00e9'.repeat( 1000 ) }` ).success ).toBe( false );
	} );
} );
