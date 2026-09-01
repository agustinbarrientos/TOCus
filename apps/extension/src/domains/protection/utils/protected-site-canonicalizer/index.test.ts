import { describe, expect, it } from 'vitest';
import {
	ProtectedSiteCanonicalizationResultSchema,
	canonicalizeProtectedSite,
	canonicalizeProtectedSiteRules,
} from './index';

const DEFAULT_SCOPE_ID = 'scope_default';
const INDEPENDENT_SCOPE_ID = 'scope_independent';

describe( 'canonicalizeProtectedSite', () => {
	describe( 'accepted protected sites', () => {
		it.each( [
			{
				input: 'HTTPS://user:secret@WWW.Example.COM.:8443/path/to/page?query=1#fragment',
				host: 'example.com',
				identityHost: 'www.example.com',
				includeSubdomains: true,
			},
			{
				input: 'www.example.com:8443/path?query=1#fragment',
				host: 'example.com',
				identityHost: 'www.example.com',
				includeSubdomains: true,
			},
			{
				input: '//www.example.com/path',
				host: 'example.com',
				identityHost: 'www.example.com',
				includeSubdomains: true,
			},
			{
				input: 'https:example.com',
				host: 'example.com',
				identityHost: 'example.com',
				includeSubdomains: true,
			},
			{
				input: 'www.example.co.uk',
				host: 'example.co.uk',
				identityHost: 'www.example.co.uk',
				includeSubdomains: true,
			},
			{
				input: 'https://b\u00fccher.de',
				host: 'xn--bcher-kva.de',
				identityHost: 'xn--bcher-kva.de',
				includeSubdomains: true,
			},
			{
				input: 'https://xn--bcher-kva.de',
				host: 'xn--bcher-kva.de',
				identityHost: 'xn--bcher-kva.de',
				includeSubdomains: true,
			},
			{
				input: 'https://www.alice.github.io',
				host: 'alice.github.io',
				identityHost: 'www.alice.github.io',
				includeSubdomains: true,
			},
			{
				input: 'https://www.bob.github.io',
				host: 'bob.github.io',
				identityHost: 'www.bob.github.io',
				includeSubdomains: true,
			},
			{
				input: 'http://0x7f000001',
				host: '127.0.0.1',
				identityHost: '127.0.0.1',
				includeSubdomains: false,
			},
			{
				input: 'http://[0:0:0:0:0:0:0:1]',
				host: '[::1]',
				identityHost: '[::1]',
				includeSubdomains: false,
			},
			{
				input: 'localhost:3000/path',
				host: 'localhost',
				identityHost: 'localhost',
				includeSubdomains: false,
			},
			{
				input: 'foo.localhost',
				host: 'foo.localhost',
				identityHost: 'foo.localhost',
				includeSubdomains: false,
			},
			{
				input: 'devbox',
				host: 'devbox',
				identityHost: 'devbox',
				includeSubdomains: false,
			},
			{
				input: 'a.dev.internal',
				host: 'a.dev.internal',
				identityHost: 'a.dev.internal',
				includeSubdomains: false,
			},
			{
				input: 'https://example.com\\@evil.com',
				host: 'example.com',
				identityHost: 'example.com',
				includeSubdomains: true,
			},
			{
				input: 'https://user@@www.example.com',
				host: 'example.com',
				identityHost: 'www.example.com',
				includeSubdomains: true,
			},
			{
				input: 'https://www%2eexample%2ecom',
				host: 'example.com',
				identityHost: 'www.example.com',
				includeSubdomains: true,
			},
			{
				input: 'https://example.com%2eevil.com',
				host: 'evil.com',
				identityHost: 'example.com.evil.com',
				includeSubdomains: true,
			},
		] )( 'canonicalizes $input into identity $identityHost and protection host $host', ( {
			input,
			host,
			identityHost,
			includeSubdomains,
		} ) => {
			expect( canonicalizeProtectedSite( input, DEFAULT_SCOPE_ID ) ).toEqual( {
				status: 'accepted',
				identityHost,
				rule: {
					host,
					includeSubdomains,
					scopeId: DEFAULT_SCOPE_ID,
				},
			} );
		} );

		it( 'keeps the supplied scope identifier authoritative', () => {
			expect( canonicalizeProtectedSite( 'www.example.com', INDEPENDENT_SCOPE_ID ) ).toEqual( {
				status: 'accepted',
				identityHost: 'www.example.com',
				rule: {
					host: 'example.com',
					includeSubdomains: true,
					scopeId: INDEPENDENT_SCOPE_ID,
				},
			} );
		} );
	} );

	describe( 'rejected protected sites', () => {
		it.each( [ 'com', 'co.uk', 'github.io' ] )( 'rejects the bare public or private suffix %s', ( input ) => {
			expect( canonicalizeProtectedSite( input, DEFAULT_SCOPE_ID ) ).toEqual( {
				status: 'rejected',
				reason: 'public-suffix',
			} );
		} );

		it.each( [
			null,
			undefined,
			42,
			{},
			[],
			'',
			'   ',
		] )( 'rejects the non-site input %j', ( input ) => {
			expect( canonicalizeProtectedSite( input, DEFAULT_SCOPE_ID ) ).toEqual( {
				status: 'rejected',
				reason: 'invalid-input',
			} );
		} );

		it.each( [
			'https://',
			'ftp://',
			'http://[::1',
			'https://999.1.1.1',
			'https://[fe80::1%25eth0]',
			'https://example..com',
			'https://example.com..',
			'https://-example.com',
			'https://example-.com',
			'https://exa_mple.com',
			'https://xn--.com',
			`https://${ 'a'.repeat( 64 ) }.com`,
			'https://\uD800.com',
		] )( 'rejects the malformed site %s without treating it as a hostname', ( input ) => {
			expect( canonicalizeProtectedSite( input, DEFAULT_SCOPE_ID ) ).toEqual( {
				status: 'rejected',
				reason: 'malformed-input',
			} );
		} );

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
		] )( 'distinguishes the browser-controlled scheme in %s', ( input ) => {
			expect( canonicalizeProtectedSite( input, DEFAULT_SCOPE_ID ) ).toEqual( {
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
		] )( 'distinguishes the unsupported scheme in %s', ( input ) => {
			expect( canonicalizeProtectedSite( input, DEFAULT_SCOPE_ID ) ).toEqual( {
				status: 'rejected',
				reason: 'unsupported-scheme',
			} );
		} );

		it.each( [ '', 'scope with spaces', 'scope/child', null, {}, [] ] )(
			'rejects the invalid scope identifier %j',
			( scopeId ) => {
				expect( canonicalizeProtectedSite( 'example.com', scopeId ) ).toEqual( {
					status: 'rejected',
					reason: 'invalid-scope-id',
				} );
			},
		);
	} );
} );

describe( 'canonicalizeProtectedSiteRules', () => {
	it.each( [
		{ host: 'com', includeSubdomains: false },
		{ host: 'co.uk', includeSubdomains: true },
		{ host: 'github.io', includeSubdomains: true },
	] )( 'preserves the captured matching behavior for the stored host $host', ( rule ) => {
		expect( canonicalizeProtectedSiteRules( [ {
			...rule,
			scopeId: DEFAULT_SCOPE_ID,
		} ] ) ).toEqual( [ {
			...rule,
			scopeId: DEFAULT_SCOPE_ID,
		} ] );
	} );

	it.each( [
		{ host: 'example.co.uk', includeSubdomains: true },
		{ host: 'alice.github.io', includeSubdomains: true },
	] )( 'preserves the valid stored host $host without public-suffix reduction', ( rule ) => {
		expect( canonicalizeProtectedSiteRules( [ {
			...rule,
			scopeId: DEFAULT_SCOPE_ID,
		} ] ) ).toEqual( [ {
			...rule,
			scopeId: DEFAULT_SCOPE_ID,
		} ] );
	} );

	it( 'canonicalizes stored host spelling without applying public-suffix reduction', () => {
		expect(
			canonicalizeProtectedSiteRules( [
				{
					host: 'WWW.Example.COM.',
					includeSubdomains: true,
					scopeId: INDEPENDENT_SCOPE_ID,
				},
			] ),
		).toEqual( [
			{
				host: 'www.example.com',
				includeSubdomains: true,
				scopeId: INDEPENDENT_SCOPE_ID,
			},
		] );
	} );

	it.each( [
		'example.com\\attacker.test',
		' example.com',
		'example.com ',
		'exam\tple.com',
		'exam\nple.com',
		'exam\rple.com',
		'exam ple.com',
		'exam\u0000ple.com',
		'exam\u001fple.com',
		'exam\u007fple.com',
	] )( 'rejects the stored host containing a navigation separator or disallowed ASCII character %j', ( host ) => {
		expect(
			canonicalizeProtectedSiteRules( [
				{
					host,
					includeSubdomains: true,
					scopeId: DEFAULT_SCOPE_ID,
				},
			] ),
		).toBeNull();
	} );

	it( 'preserves a valid bracketed IPv6 stored host while rejecting navigation details', () => {
		expect(
			canonicalizeProtectedSiteRules( [
				{
					host: '[0:0:0:0:0:0:0:1]',
					includeSubdomains: false,
					scopeId: DEFAULT_SCOPE_ID,
				},
			] ),
		).toEqual( [
			{
				host: '[::1]',
				includeSubdomains: false,
				scopeId: DEFAULT_SCOPE_ID,
			},
		] );
	} );

	it.each( [
		null,
		undefined,
		{},
		'default',
		[ null ],
		[ { host: 'https://example.com', includeSubdomains: true, scopeId: DEFAULT_SCOPE_ID } ],
		[ { host: 'example.com:443', includeSubdomains: true, scopeId: DEFAULT_SCOPE_ID } ],
		[ { host: 'localhost', includeSubdomains: true, scopeId: DEFAULT_SCOPE_ID } ],
	] )( 'rejects the invalid stored rule set %j', ( rules ) => {
		expect( canonicalizeProtectedSiteRules( rules ) ).toBeNull();
	} );

	it( 'does not mutate a frozen stored rule set', () => {
		const rule = Object.freeze( {
			host: 'EXAMPLE.COM.',
			includeSubdomains: true,
			scopeId: DEFAULT_SCOPE_ID,
		} );
		const rules = Object.freeze( [ rule ] );

		expect( canonicalizeProtectedSiteRules( rules ) ).toEqual( [
			{
				host: 'example.com',
				includeSubdomains: true,
				scopeId: DEFAULT_SCOPE_ID,
			},
		] );
		expect( rule.host ).toBe( 'EXAMPLE.COM.' );
	} );
} );

describe( 'ProtectedSiteCanonicalizationResultSchema', () => {
	it( 'accepts a descendant identity owned by a subdomain-inclusive rule', () => {
		expect( ProtectedSiteCanonicalizationResultSchema.safeParse( {
			status: 'accepted',
			identityHost: 'mail.google.com',
			rule: {
				host: 'google.com',
				includeSubdomains: true,
				scopeId: DEFAULT_SCOPE_ID,
			},
		} ).success ).toBe( true );
	} );

	it( 'rejects an accepted identity host outside its matching rule', () => {
		expect( ProtectedSiteCanonicalizationResultSchema.safeParse( {
			status: 'accepted',
			identityHost: 'mail.google.com',
			rule: {
				host: 'x.com',
				includeSubdomains: true,
				scopeId: DEFAULT_SCOPE_ID,
			},
		} ).success ).toBe( false );
		expect( ProtectedSiteCanonicalizationResultSchema.safeParse( {
			status: 'accepted',
			identityHost: 'mail.google.com',
			rule: {
				host: 'google.com',
				includeSubdomains: false,
				scopeId: DEFAULT_SCOPE_ID,
			},
		} ).success ).toBe( false );
	} );
} );
