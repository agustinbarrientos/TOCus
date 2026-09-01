import { describe, expect, it } from 'vitest';
import { ProtectedSiteRuleSetSchema } from '../../types/protected-site-rule';
import { matchProtectedUrl } from './index';

const DEFAULT_SCOPE_ID = 'scope_default';
const INDEPENDENT_SCOPE_ID = 'scope_independent';

describe( 'matchProtectedUrl', () => {
	const defaultRule = {
		host: 'example.com',
		includeSubdomains: true,
		scopeId: DEFAULT_SCOPE_ID,
	};

	describe( 'protected navigation', () => {
		it.each( [
			'https://example.com',
			'https://news.example.com',
			'HTTPS://user:secret@NEWS.EXAMPLE.COM.:8443/path?query=1#fragment',
			'//news.example.com/path',
			'https:news.example.com',
		] )( 'matches the exact host or a label-boundary descendant for %s', ( input ) => {
			expect( matchProtectedUrl( input, [ defaultRule ] ) ).toEqual( {
				status: 'protected',
				rule: defaultRule,
			} );
		} );

		it( 'matches Unicode and punycode navigation to the same stored host', () => {
			const rule = {
				host: 'xn--bcher-kva.de',
				includeSubdomains: true,
				scopeId: INDEPENDENT_SCOPE_ID,
			};

			expect( matchProtectedUrl( 'https://b\u00fccher.de', [ rule ] ) ).toEqual( {
				status: 'protected',
				rule,
			} );
			expect( matchProtectedUrl( 'https://xn--bcher-kva.de', [ rule ] ) ).toEqual( {
				status: 'protected',
				rule,
			} );
		} );

		it( 'canonicalizes stored host spelling without reducing the stored host through the suffix list', () => {
			expect(
				matchProtectedUrl( 'https://child.www.example.com', [
					{
						host: 'WWW.Example.COM.',
						includeSubdomains: true,
						scopeId: INDEPENDENT_SCOPE_ID,
					},
				] ),
			).toEqual( {
				status: 'protected',
				rule: {
					host: 'www.example.com',
					includeSubdomains: true,
					scopeId: INDEPENDENT_SCOPE_ID,
				},
			} );
		} );

		it( 'does not recalculate a stored host registrable domain', () => {
			expect(
				matchProtectedUrl( 'https://example.com', [
					{
						host: 'www.example.com',
						includeSubdomains: true,
						scopeId: DEFAULT_SCOPE_ID,
					},
				] ),
			).toEqual( { status: 'unprotected' } );
		} );

		it( 'matches a stored range without reclassifying it through the current suffix list', () => {
			const rule = {
				host: 'co.uk',
				includeSubdomains: true,
				scopeId: DEFAULT_SCOPE_ID,
			};

			expect( matchProtectedUrl( 'https://example.co.uk', [ rule ] ) ).toEqual( {
				status: 'protected',
				rule,
			} );
		} );

		it( 'keeps private-suffix tenants independent', () => {
			const rule = {
				host: 'alice.github.io',
				includeSubdomains: true,
				scopeId: INDEPENDENT_SCOPE_ID,
			};

			expect( matchProtectedUrl( 'https://child.alice.github.io', [ rule ] ) ).toEqual( {
				status: 'protected',
				rule,
			} );
			expect( matchProtectedUrl( 'https://bob.github.io', [ rule ] ) ).toEqual( {
				status: 'unprotected',
			} );
		} );

		it( 'selects the matching rule from disjoint protected ranges', () => {
			const rules = [
				defaultRule,
				{
					host: 'example.net',
					includeSubdomains: true,
					scopeId: INDEPENDENT_SCOPE_ID,
				},
			];

			expect( matchProtectedUrl( 'https://news.example.net', rules ) ).toEqual( {
				status: 'protected',
				rule: rules[ 1 ],
			} );
		} );

		it( 'matches canonical IPv4 and IPv6 spellings exactly', () => {
			const ipv4Rule = {
				host: '127.0.0.1',
				includeSubdomains: false,
				scopeId: DEFAULT_SCOPE_ID,
			};
			const ipv6Rule = {
				host: '[::1]',
				includeSubdomains: false,
				scopeId: INDEPENDENT_SCOPE_ID,
			};

			expect( matchProtectedUrl( 'http://0x7f000001', [ ipv4Rule ] ) ).toEqual( {
				status: 'protected',
				rule: ipv4Rule,
			} );
			expect( matchProtectedUrl( 'http://127.0.0.2', [ ipv4Rule ] ) ).toEqual( {
				status: 'unprotected',
			} );
			expect( matchProtectedUrl( 'http://[0:0:0:0:0:0:0:1]', [ ipv6Rule ] ) ).toEqual( {
				status: 'protected',
				rule: ipv6Rule,
			} );
			expect( matchProtectedUrl( 'http://[::2]', [ ipv6Rule ] ) ).toEqual( {
				status: 'unprotected',
			} );
		} );

		it( 'matches a dotted non-registrable development host exactly', () => {
			const rule = {
				host: 'a.dev.internal',
				includeSubdomains: false,
				scopeId: DEFAULT_SCOPE_ID,
			};

			expect( matchProtectedUrl( 'https://a.dev.internal', [ rule ] ) ).toEqual( {
				status: 'protected',
				rule,
			} );
		} );
	} );

	describe( 'unprotected navigation', () => {
		it.each( [
			'https://notexample.com',
			'https://example.com.evil.com',
			'https://example.net',
		] )( 'rejects the boundary attack or unrelated host %s', ( input ) => {
			expect( matchProtectedUrl( input, [ defaultRule ] ) ).toEqual( {
				status: 'unprotected',
			} );
		} );

		it.each( [
			{ storedHost: 'localhost', navigation: 'http://foo.localhost' },
			{ storedHost: 'foo.localhost', navigation: 'http://bar.foo.localhost' },
			{ storedHost: 'foo.localhost', navigation: 'http://bar.localhost' },
			{ storedHost: 'devbox', navigation: 'http://child.devbox' },
			{ storedHost: 'a.dev.internal', navigation: 'https://child.a.dev.internal' },
			{ storedHost: 'a.dev.internal', navigation: 'https://b.dev.internal' },
		] )( 'matches the development host $storedHost exactly for $navigation', ( { storedHost, navigation } ) => {
			expect(
				matchProtectedUrl( navigation, [
					{
						host: storedHost,
						includeSubdomains: false,
						scopeId: DEFAULT_SCOPE_ID,
					},
				] ),
			).toEqual( { status: 'unprotected' } );
		} );
	} );

	describe( 'unsupported navigation', () => {
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
			expect( matchProtectedUrl( input, [ defaultRule ] ) ).toEqual( {
				status: 'unsupported',
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
			expect( matchProtectedUrl( input, [ defaultRule ] ) ).toEqual( {
				status: 'unsupported',
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
		] )( 'classifies the malformed navigation %j without throwing', ( input ) => {
			expect( matchProtectedUrl( input, [ defaultRule ] ) ).toEqual( {
				status: 'unsupported',
				reason: 'malformed-input',
			} );
		} );
	} );

	describe( 'invalid stored rule sets', () => {
		it.each( [
			'example.com\\attacker.test',
			'exam\tple.com',
			'exam\nple.com',
			'exam\rple.com',
			'exam ple.com',
			'exam\u0000ple.com',
			'exam\u001fple.com',
			'exam\u007fple.com',
		] )( 'rejects the stored host containing a navigation separator or ASCII control %j', ( host ) => {
			expect(
				matchProtectedUrl( 'https://example.com', [
					{
						host,
						includeSubdomains: true,
						scopeId: DEFAULT_SCOPE_ID,
					},
				] ),
			).toEqual( {
				status: 'unsupported',
				reason: 'invalid-rule-set',
			} );
		} );

		it( 'rejects a noncanonical host through the exported rule-set contract', () => {
			expect(
				ProtectedSiteRuleSetSchema.safeParse( [
					{
						host: 'EXAMPLE.COM.',
						includeSubdomains: true,
						scopeId: DEFAULT_SCOPE_ID,
					},
				] ).success,
			).toBe( false );
		} );

		it( 'rejects a canonical DNS hostname longer than 253 characters', () => {
			const overlongHostname = `${ 'a'.repeat( 63 ) }.${ 'b'.repeat( 63 ) }.${ 'c'.repeat( 63 ) }.${ 'd'.repeat( 62 ) }`;
			const rules = [
				{
					host: overlongHostname,
					includeSubdomains: false,
					scopeId: DEFAULT_SCOPE_ID,
				},
			];

			expect( overlongHostname ).toHaveLength( 254 );
			expect( ProtectedSiteRuleSetSchema.safeParse( rules ).success ).toBe( false );
			expect( matchProtectedUrl( 'https://example.com', rules ) ).toEqual( {
				status: 'unsupported',
				reason: 'invalid-rule-set',
			} );
		} );

		it( 'rejects a stored host that the URL parser cannot parse', () => {
			const rules = [
				{
					host: '[',
					includeSubdomains: false,
					scopeId: DEFAULT_SCOPE_ID,
				},
			];

			expect( ProtectedSiteRuleSetSchema.safeParse( rules ).success ).toBe( false );
			expect( matchProtectedUrl( 'https://example.com', rules ) ).toEqual( {
				status: 'unsupported',
				reason: 'invalid-rule-set',
			} );
		} );

		it.each( [
			null,
			undefined,
			{},
			'default',
			[ null ],
			[ {} ],
			[ { host: 'example.com', includeSubdomains: true, scopeId: DEFAULT_SCOPE_ID, extra: true } ],
			[ { host: 'https://example.com', includeSubdomains: true, scopeId: DEFAULT_SCOPE_ID } ],
			[ { host: 'example.com:443', includeSubdomains: true, scopeId: DEFAULT_SCOPE_ID } ],
			[ { host: 'example..com', includeSubdomains: true, scopeId: DEFAULT_SCOPE_ID } ],
			[ { host: 'example.com', includeSubdomains: true, scopeId: 'scope with spaces' } ],
			[ { host: 'localhost', includeSubdomains: true, scopeId: DEFAULT_SCOPE_ID } ],
			[ { host: 'foo.localhost', includeSubdomains: true, scopeId: DEFAULT_SCOPE_ID } ],
			[ { host: '127.0.0.1', includeSubdomains: true, scopeId: DEFAULT_SCOPE_ID } ],
		] )( 'rejects the invalid stored rule set %j', ( rules ) => {
			expect( matchProtectedUrl( 'https://example.com', rules ) ).toEqual( {
				status: 'unsupported',
				reason: 'invalid-rule-set',
			} );
		} );

		it.each( [
			{
				rules: [
					{ host: 'example.com', includeSubdomains: true, scopeId: DEFAULT_SCOPE_ID },
					{ host: 'EXAMPLE.COM.', includeSubdomains: true, scopeId: INDEPENDENT_SCOPE_ID },
				],
			},
			{
				rules: [
					{ host: 'b\u00fccher.de', includeSubdomains: true, scopeId: DEFAULT_SCOPE_ID },
					{ host: 'xn--bcher-kva.de', includeSubdomains: true, scopeId: DEFAULT_SCOPE_ID },
				],
			},
		] )( 'rejects duplicate canonical hosts before matching', ( { rules } ) => {
			expect( matchProtectedUrl( 'https://example.com', rules ) ).toEqual( {
				status: 'unsupported',
				reason: 'invalid-rule-set',
			} );
		} );

		it.each( [
			{
				label: 'same scope with parent first',
				rules: [
					{ host: 'example.com', includeSubdomains: true, scopeId: DEFAULT_SCOPE_ID },
					{ host: 'child.example.com', includeSubdomains: false, scopeId: DEFAULT_SCOPE_ID },
				],
			},
			{
				label: 'same scope with child first',
				rules: [
					{ host: 'child.example.com', includeSubdomains: false, scopeId: DEFAULT_SCOPE_ID },
					{ host: 'example.com', includeSubdomains: true, scopeId: DEFAULT_SCOPE_ID },
				],
			},
			{
				label: 'different scopes with parent first',
				rules: [
					{ host: 'example.com', includeSubdomains: true, scopeId: DEFAULT_SCOPE_ID },
					{ host: 'child.example.com', includeSubdomains: false, scopeId: INDEPENDENT_SCOPE_ID },
				],
			},
			{
				label: 'different scopes with child first',
				rules: [
					{ host: 'child.example.com', includeSubdomains: false, scopeId: INDEPENDENT_SCOPE_ID },
					{ host: 'example.com', includeSubdomains: true, scopeId: DEFAULT_SCOPE_ID },
				],
			},
		] )( 'rejects overlapping protected ranges for $label', ( { rules } ) => {
			expect( matchProtectedUrl( 'https://child.example.com', rules ) ).toEqual( {
				status: 'unsupported',
				reason: 'invalid-rule-set',
			} );
		} );
	} );

	describe( 'immutability', () => {
		it( 'does not mutate a frozen stored rule set', () => {
			const rule = Object.freeze( {
				host: 'EXAMPLE.COM.',
				includeSubdomains: true,
				scopeId: DEFAULT_SCOPE_ID,
			} );
			const rules = Object.freeze( [ rule ] );

			expect( () => matchProtectedUrl( 'https://www.example.com', rules ) ).not.toThrow();
			expect( rule ).toEqual( {
				host: 'EXAMPLE.COM.',
				includeSubdomains: true,
				scopeId: DEFAULT_SCOPE_ID,
			} );
		} );
	} );
} );
