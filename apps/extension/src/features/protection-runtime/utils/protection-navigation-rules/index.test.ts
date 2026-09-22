import { describe, expect, it } from 'vitest';
import { ProtectionScopeIdSchema } from '../../../../domains/protection/types/protection-value';
import {
	ProtectionNavigationRuleIdStart,
	createProtectionNavigationRules,
	isProtectionNavigationRuleId,
} from './index';

/** Default scope used by navigation-rule fixtures. */
const DEFAULT_SCOPE_ID = ProtectionScopeIdSchema.parse( 'scope_default' );

/** Localhost scope used by exact-origin navigation-rule fixtures. */
const LOCAL_SCOPE_ID = ProtectionScopeIdSchema.parse( 'scope_local' );

/** Exact-host scope used by news-site navigation-rule fixtures. */
const NEWS_SCOPE_ID = ProtectionScopeIdSchema.parse( 'scope_news' );

/** Lexically first scope used by deterministic-order fixtures. */
const SCOPE_A_ID = ProtectionScopeIdSchema.parse( 'scope_a' );

/** Lexically last scope used by deterministic-order fixtures. */
const SCOPE_Z_ID = ProtectionScopeIdSchema.parse( 'scope_z' );

/** Trusted packaged interruption page used by redirect fixtures. */
const INTERRUPTION_PAGE_URL = 'chrome-extension://extension-id/pause.html';

describe( 'createProtectionNavigationRules', () => {
	it( 'groups protected domains and their subdomains into one main-frame redirect', () => {
		expect( createProtectionNavigationRules( [
			{
				host: 'second.test',
				includeSubdomains: true,
				scopeId: DEFAULT_SCOPE_ID,
			},
			{
				host: 'example.com',
				includeSubdomains: true,
				scopeId: DEFAULT_SCOPE_ID,
			},
		], INTERRUPTION_PAGE_URL ) ).toEqual( [
			{
				id: ProtectionNavigationRuleIdStart,
				priority: 1,
				action: {
					type: 'redirect',
					redirect: {
						regexSubstitution: `${ INTERRUPTION_PAGE_URL }#destination=\\0`,
					},
				},
				condition: {
					regexFilter: '^https?://.*',
					requestDomains: [ 'example.com', 'second.test' ],
					resourceTypes: [ 'main_frame' ],
				},
			},
		] );
	} );

	it( 'anchors one exact host across HTTP and HTTPS navigation', () => {
		expect( createProtectionNavigationRules( [
			{
				host: 'news.example.com',
				includeSubdomains: false,
				scopeId: NEWS_SCOPE_ID,
			},
		], INTERRUPTION_PAGE_URL ) ).toEqual( [
			{
				id: ProtectionNavigationRuleIdStart,
				priority: 1,
				action: {
					type: 'redirect',
					redirect: {
						regexSubstitution: `${ INTERRUPTION_PAGE_URL }#destination=\\0`,
					},
				},
				condition: {
					regexFilter: '^https?://([^/?#@]*@)?news\\.example\\.com(:[0-9]+)?([/?#].*)?$',
					resourceTypes: [ 'main_frame' ],
				},
			},
		] );
	} );

	it.each( [
		{
			host: 'localhost',
			expectedFilters: [ '^https?://([^/?#@]*@)?localhost(:[0-9]+)?([/?#].*)?$' ],
		},
		{
			host: '127.0.0.1',
			expectedFilters: [ '^https?://([^/?#@]*@)?127\\.0\\.0\\.1(:[0-9]+)?([/?#].*)?$' ],
		},
		{
			host: '[::1]',
			expectedFilters: [ '^https?://([^/?#@]*@)?\\[::1\\](:[0-9]+)?([/?#].*)?$' ],
		},
	] )( 'anchors the exact $host origin without matching lookalike hosts', ( { host, expectedFilters } ) => {
		const rules = createProtectionNavigationRules( [
			{
				host,
				includeSubdomains: false,
				scopeId: LOCAL_SCOPE_ID,
			},
		], INTERRUPTION_PAGE_URL );

		expect( rules.map( ( rule ) => rule.condition.regexFilter ) ).toEqual( expectedFilters );
	} );

	it.each( [
		{
			host: 'news.example.com',
			matchingUrls: [
				'http://news.example.com',
				'https://user:secret@news.example.com:8443/path?query=1#fragment',
			],
			nonMatchingUrls: [
				'https://sub.news.example.com/',
				'https://news.example.com.evil.test/',
			],
		},
		{
			host: 'xn--bcher-kva.example',
			matchingUrls: [ 'https://xn--bcher-kva.example/' ],
			nonMatchingUrls: [ 'https://bücher.example/', 'https://sub.xn--bcher-kva.example/' ],
		},
		{
			host: '[::1]',
			matchingUrls: [ 'http://[::1]:8080/path', 'https://user@[::1]/' ],
			nonMatchingUrls: [ 'https://[::2]/' ],
		},
	] )( 'matches only exact $host destinations while preserving valid URL forms', ( {
		host,
		matchingUrls,
		nonMatchingUrls,
	} ) => {
		const [ rule ] = createProtectionNavigationRules( [ {
			host,
			includeSubdomains: false,
			scopeId: LOCAL_SCOPE_ID,
		} ], INTERRUPTION_PAGE_URL );
		const pattern = new RegExp( rule?.condition.regexFilter ?? '' );

		expect( matchingUrls.every( ( url ) => pattern.test( url ) ) ).toBe( true );
		expect( nonMatchingUrls.every( ( url ) => ! pattern.test( url ) ) ).toBe( true );
		expect( rule?.action ).toEqual( {
			type: 'redirect',
			redirect: { regexSubstitution: `${ INTERRUPTION_PAGE_URL }#destination=\\0` },
		} );
	} );

	it( 'assigns unique positive identifiers deterministically regardless of input order', () => {
		const selectedRules = [
			{
				host: 'z.example',
				includeSubdomains: false,
				scopeId: SCOPE_Z_ID,
			},
			{
				host: 'example.com',
				includeSubdomains: true,
				scopeId: DEFAULT_SCOPE_ID,
			},
			{
				host: 'a.example',
				includeSubdomains: false,
				scopeId: SCOPE_A_ID,
			},
		];

		const forward = createProtectionNavigationRules( selectedRules, INTERRUPTION_PAGE_URL );
		const reversed = createProtectionNavigationRules( [ ...selectedRules ].reverse(), INTERRUPTION_PAGE_URL );
		const identifiers = forward.map( ( rule ) => rule.id );

		expect( reversed ).toEqual( forward );
		expect( forward[ 0 ]?.condition.requestDomains ).toEqual( [ 'example.com' ] );
		expect( identifiers ).toEqual( [
			ProtectionNavigationRuleIdStart,
			ProtectionNavigationRuleIdStart + 1,
			ProtectionNavigationRuleIdStart + 2,
		] );
		expect( new Set( identifiers ).size ).toBe( identifiers.length );
		expect( identifiers.every( ( identifier ) => Number.isInteger( identifier ) && identifier > 0 ) ).toBe( true );
	} );

	it( 'does not mutate the user-selected rule order', () => {
		const selectedRules = [
			{
				host: 'z.example',
				includeSubdomains: false,
				scopeId: SCOPE_Z_ID,
			},
			{
				host: 'a.example',
				includeSubdomains: false,
				scopeId: SCOPE_A_ID,
			},
		];

		createProtectionNavigationRules( selectedRules, INTERRUPTION_PAGE_URL );

		expect( selectedRules.map( ( rule ) => rule.host ) ).toEqual( [ 'z.example', 'a.example' ] );
	} );

	it( 'creates no redirect rules when the user has selected no sites', () => {
		expect( createProtectionNavigationRules( [], INTERRUPTION_PAGE_URL ) ).toEqual( [] );
	} );

	it( 'recognizes only identifiers reserved for protection redirects', () => {
		expect( isProtectionNavigationRuleId( ProtectionNavigationRuleIdStart ) ).toBe( true );
		expect( isProtectionNavigationRuleId( ProtectionNavigationRuleIdStart + 99_999 ) ).toBe( true );
		expect( isProtectionNavigationRuleId( ProtectionNavigationRuleIdStart - 1 ) ).toBe( false );
		expect( isProtectionNavigationRuleId( ProtectionNavigationRuleIdStart + 100_000 ) ).toBe( false );
	} );
} );
