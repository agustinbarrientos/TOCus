import { ProtectedSiteCanonicalizationStatus } from './types';
import { describe, expect, it } from 'vitest';
import { ProtectedSiteRuleSchema } from '../../types/protected-site-rule';
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
				pathPrefix: '/path/to/page',
				host: 'example.com',
				identityHost: 'www.example.com',
				includeSubdomains: true,
			},
			{
				input: 'www.example.com:8443/path?query=1#fragment',
				pathPrefix: '/path',
				host: 'example.com',
				identityHost: 'www.example.com',
				includeSubdomains: true,
			},
			{
				input: '//www.example.com/path',
				pathPrefix: '/path',
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
				pathPrefix: '/path',
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
				pathPrefix: '/@evil.com',
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
				host: 'example.com.evil.com',
				identityHost: 'example.com.evil.com',
				includeSubdomains: false,
			},
		] )( 'canonicalizes $input into identity $identityHost and protection host $host', ( {
			input,
			host,
			identityHost,
			includeSubdomains,
			pathPrefix,
		} ) => {
			expect( canonicalizeProtectedSite( input, DEFAULT_SCOPE_ID ) ).toEqual( {
				status: ProtectedSiteCanonicalizationStatus.ACCEPTED,
				identityHost,
				rule: {
					host,
					includeSubdomains,
					scopeId: DEFAULT_SCOPE_ID,
					...( pathPrefix === undefined ? {} : { pathPrefix } ),
				},
			} );
		} );

		it( 'keeps the supplied scope identifier authoritative', () => {
			expect( canonicalizeProtectedSite( 'www.example.com', INDEPENDENT_SCOPE_ID ) ).toEqual( {
				status: ProtectedSiteCanonicalizationStatus.ACCEPTED,
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
				status: ProtectedSiteCanonicalizationStatus.REJECTED,
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
				status: ProtectedSiteCanonicalizationStatus.REJECTED,
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
				status: ProtectedSiteCanonicalizationStatus.REJECTED,
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
				status: ProtectedSiteCanonicalizationStatus.REJECTED,
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
				status: ProtectedSiteCanonicalizationStatus.REJECTED,
				reason: 'unsupported-scheme',
			} );
		} );

		it.each( [ '', 'scope with spaces', 'scope/child', null, {}, [] ] )(
			'rejects the invalid scope identifier %j',
			( scopeId ) => {
				expect( canonicalizeProtectedSite( 'example.com', scopeId ) ).toEqual( {
					status: ProtectedSiteCanonicalizationStatus.REJECTED,
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
			status: ProtectedSiteCanonicalizationStatus.ACCEPTED,
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
			status: ProtectedSiteCanonicalizationStatus.ACCEPTED,
			identityHost: 'mail.google.com',
			rule: {
				host: 'x.com',
				includeSubdomains: true,
				scopeId: DEFAULT_SCOPE_ID,
			},
		} ).success ).toBe( false );
		expect( ProtectedSiteCanonicalizationResultSchema.safeParse( {
			status: ProtectedSiteCanonicalizationStatus.ACCEPTED,
			identityHost: 'mail.google.com',
			rule: {
				host: 'google.com',
				includeSubdomains: false,
				scopeId: DEFAULT_SCOPE_ID,
			},
		} ).success ).toBe( false );
	} );
} );


describe( 'canonical website exceptions', () => {
	it( 'retains distinct path targets without broadening explicit subdomains', () => {
		expect( canonicalizeProtectedSite( 'https://studio.youtube.com/shorts/?x=1#fragment', DEFAULT_SCOPE_ID ) )
			.toEqual( { status: ProtectedSiteCanonicalizationStatus.ACCEPTED, identityHost: 'studio.youtube.com', rule: {
				host: 'studio.youtube.com', includeSubdomains: false, scopeId: DEFAULT_SCOPE_ID, pathPrefix: '/shorts',
			} } );
	} );

	it( 'accepts intentional overlap and preserves legacy whole-host coverage', () => {
		const root = { host: 'youtube.com', includeSubdomains: true, scopeId: DEFAULT_SCOPE_ID };
		const path = { ...root, pathPrefix: '/shorts', behavior: 'pause' };
		expect( canonicalizeProtectedSiteRules( [ root, path ] ) ).toEqual( [ root, path ] );
	} );

	it( 'rejects identical canonical ranges despite different behavior or scope', () => {
		const root = { host: 'youtube.com', includeSubdomains: true, scopeId: DEFAULT_SCOPE_ID };
		expect( canonicalizeProtectedSiteRules( [ root, { ...root, pathPrefix: '/', behavior: 'allow' } ] ) ).toBeNull();
	} );
} );


describe( 'conventional website aliases', () => {
	it( 'rejects duplicate root and www path aliases after canonicalization', () => {
		const root = canonicalizeProtectedSite( 'youtube.com/shorts', DEFAULT_SCOPE_ID );
		const alias = canonicalizeProtectedSite( 'www.youtube.com/shorts/', DEFAULT_SCOPE_ID );
		expect( root ).toEqual( { status: ProtectedSiteCanonicalizationStatus.ACCEPTED, identityHost: 'youtube.com', rule: {
			host: 'youtube.com', includeSubdomains: true, scopeId: DEFAULT_SCOPE_ID, pathPrefix: '/shorts',
		} } );
		expect( alias ).toEqual( { status: ProtectedSiteCanonicalizationStatus.ACCEPTED, identityHost: 'www.youtube.com', rule: {
			host: 'youtube.com', includeSubdomains: true, scopeId: DEFAULT_SCOPE_ID, pathPrefix: '/shorts',
		} } );
		if ( root.status === ProtectedSiteCanonicalizationStatus.ACCEPTED &&
			alias.status === ProtectedSiteCanonicalizationStatus.ACCEPTED ) {
			expect( canonicalizeProtectedSiteRules( [ root.rule, alias.rule ] ) ).toBeNull();
		}
	} );
} );


describe( 'canonical path validation boundaries', () => {
	const rule = { host: 'youtube.com', includeSubdomains: true, scopeId: DEFAULT_SCOPE_ID };

	it.each( [
		'', '/', 'shorts', '/shorts/', '/shorts?cursor=next', '/shorts#saved',
		'/shorts\\saved', '/shorts saved', '/caf\u00e9', '/shorts%2', '/shorts%GG', '/saved/../shorts',
	] )( 'rejects noncanonical or malformed paths at the persisted rule boundary: %j', ( pathPrefix ) => {
		expect( ProtectedSiteRuleSchema.safeParse( { ...rule, pathPrefix } ).success ).toBe( false );
	} );

	it.each( [ '/shorts', '/Shorts', '/shorts%2F123', '/caf%C3%A9' ] )(
		'preserves case and encoded path components at the persisted rule boundary: %s', ( pathPrefix ) => {
			expect( ProtectedSiteRuleSchema.parse( { ...rule, pathPrefix } ) ).toEqual( { ...rule, pathPrefix } );
		},
	);

	it.each( [
		'', 'shorts', '/shorts?cursor=next', '/shorts#saved', '/shorts\\saved',
		'/shorts saved', '/shorts\n', '/caf\u00e9', '/shorts%2', '/shorts%GG',
	] )( 'rejects unsafe stored path input instead of broadening its rule: %j', ( pathPrefix ) => {
		expect( canonicalizeProtectedSiteRules( [ { ...rule, pathPrefix } ] ) ).toBeNull();
	} );

	it.each( [
		{ input: '/shorts/', canonical: '/shorts' },
		{ input: '/saved/../shorts', canonical: '/shorts' },
		{ input: '/shorts%2F123', canonical: '/shorts%2F123' },
		{ input: '/caf%C3%A9', canonical: '/caf%C3%A9' },
	] )( 'normalizes valid stored path $input without decoding its components', ( { input, canonical } ) => {
		expect( canonicalizeProtectedSiteRules( [ { ...rule, pathPrefix: input } ] ) )
			.toEqual( [ { ...rule, pathPrefix: canonical } ] );
	} );

	it( 'normalizes an explicit root path into its original whole-host range', () => {
		expect( canonicalizeProtectedSiteRules( [ { ...rule, pathPrefix: '/' } ] ) ).toEqual( [ rule ] );
	} );

	it.each( [ 'https://youtube.com/shorts%', 'https://youtube.com/shorts%2', 'https://youtube.com/shorts%GG' ] )(
		'rejects malformed percent escapes preserved by URL parsing: %s', ( input ) => {
			expect( canonicalizeProtectedSite( input, DEFAULT_SCOPE_ID ) ).toEqual( {
				status: ProtectedSiteCanonicalizationStatus.REJECTED,
				reason: 'malformed-input',
			} );
		},
	);

	it( 'accepts Unicode URL paths after URL parsing encodes them for canonical storage', () => {
		expect( canonicalizeProtectedSite( 'https://youtube.com/caf\u00e9', DEFAULT_SCOPE_ID ) ).toEqual( {
			status: ProtectedSiteCanonicalizationStatus.ACCEPTED,
			identityHost: 'youtube.com',
			rule: { ...rule, pathPrefix: '/caf%C3%A9' },
		} );
	} );
} );
