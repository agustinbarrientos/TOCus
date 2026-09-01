import { describe, expect, it } from 'vitest';
import { CanonicalHostSchema } from '../../types/protected-site-rule';
import { normalizeProtectableUrl } from './index';

describe( 'CanonicalHostSchema custom canonical-form rule', () => {
	it.each( [
		'EXAMPLE.COM',
		'example.com.',
		'[',
		'[fe80::1%eth0]',
		'-example.com',
	] )( 'rejects the noncanonical host %s', ( host ) => {
		expect( CanonicalHostSchema.safeParse( host ).success ).toBe( false );
	} );
} );

describe( 'normalizeProtectableUrl', () => {
	describe( 'normalized URLs', () => {
		it.each( [
			{ input: 'HTTPS://user:secret@WWW.Example.COM.:8443/path?query=1#fragment', host: 'www.example.com' },
			{ input: 'www.example.com:8443/path', host: 'www.example.com' },
			{ input: '//www.example.com/path', host: 'www.example.com' },
			{ input: 'https:b\u00fccher.de', host: 'xn--bcher-kva.de' },
			{ input: 'http://0x7f000001', host: '127.0.0.1' },
			{ input: 'http://[0:0:0:0:0:0:0:1]', host: '[::1]' },
		] )( 'normalizes $input to $host', ( { input, host } ) => {
			const result = normalizeProtectableUrl( input );

			expect( result.status ).toBe( 'normalized' );

			if ( result.status === 'normalized' ) {
				expect( result.host ).toBe( host );
				expect( result.url.hostname ).toBe( host );
			}
		} );
	} );

	describe( 'rejected URLs', () => {
		it.each( [
			'about:blank',
			'chrome://settings',
			'chrome-extension://extension-id/page.html',
			'chrome-untrusted://new-tab-page',
			'devtools://devtools/bundled/inspector.html',
			'edge://settings',
			'moz-extension://extension-id/page.html',
			'resource://gre/modules/AppConstants.sys.mjs',
			'safari-extension://extension-id/page.html',
			'safari-web-extension://extension-id/page.html',
			'view-source:https://example.com',
		] )( 'classifies the browser-controlled scheme in %s', ( input ) => {
			expect( normalizeProtectableUrl( input ) ).toEqual( {
				status: 'rejected',
				reason: 'browser-controlled-scheme',
			} );
		} );

		it.each( [
			'data:text/plain,hello',
			'file:///tmp/file.txt',
			'ftp://example.com',
			'mailto:user@example.com',
			'custom:resource',
		] )( 'classifies the unsupported scheme in %s', ( input ) => {
			expect( normalizeProtectableUrl( input ) ).toEqual( {
				status: 'rejected',
				reason: 'unsupported-scheme',
			} );
		} );

		it.each( [
			null,
			undefined,
			42,
			{},
			[],
			'',
			'https://',
			'http://[::1',
			'https://999.1.1.1',
			'https://[fe80::1%25eth0]',
			'https://example..com',
			'https://example.com..',
			'https://exa_mple.com',
			'https://\uD800.com',
		] )( 'classifies the malformed URL %j', ( input ) => {
			expect( normalizeProtectableUrl( input ) ).toEqual( {
				status: 'rejected',
				reason: 'malformed-input',
			} );
		} );
	} );
} );
