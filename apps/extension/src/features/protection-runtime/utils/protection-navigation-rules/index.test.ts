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

describe( 'createProtectionNavigationRules', () => {
	it( 'creates one main-frame redirect for a protected domain and its subdomains', () => {
		expect( createProtectionNavigationRules( [
			{
				host: 'example.com',
				includeSubdomains: true,
				scopeId: DEFAULT_SCOPE_ID,
			},
		] ) ).toEqual( [
			{
				id: ProtectionNavigationRuleIdStart,
				priority: 1,
				action: {
					type: 'redirect',
					redirect: {
						extensionPath: '/interruption.html',
					},
				},
				condition: {
					urlFilter: '||example.com^',
					resourceTypes: [ 'main_frame' ],
				},
			},
		] );
	} );

	it( 'anchors exact hosts independently for HTTP and HTTPS navigation', () => {
		expect( createProtectionNavigationRules( [
			{
				host: 'news.example.com',
				includeSubdomains: false,
				scopeId: NEWS_SCOPE_ID,
			},
		] ) ).toEqual( [
			{
				id: ProtectionNavigationRuleIdStart,
				priority: 1,
				action: {
					type: 'redirect',
					redirect: {
						extensionPath: '/interruption.html',
					},
				},
				condition: {
					urlFilter: '|http://news.example.com^',
					resourceTypes: [ 'main_frame' ],
				},
			},
			{
				id: ProtectionNavigationRuleIdStart + 1,
				priority: 1,
				action: {
					type: 'redirect',
					redirect: {
						extensionPath: '/interruption.html',
					},
				},
				condition: {
					urlFilter: '|https://news.example.com^',
					resourceTypes: [ 'main_frame' ],
				},
			},
		] );
	} );

	it.each( [
		{
			host: 'localhost',
			expectedFilters: [ '|http://localhost^', '|https://localhost^' ],
		},
		{
			host: '127.0.0.1',
			expectedFilters: [ '|http://127.0.0.1^', '|https://127.0.0.1^' ],
		},
		{
			host: '[::1]',
			expectedFilters: [ '|http://[::1]^', '|https://[::1]^' ],
		},
	] )( 'anchors the exact $host origin without matching lookalike hosts', ( { host, expectedFilters } ) => {
		const rules = createProtectionNavigationRules( [
			{
				host,
				includeSubdomains: false,
				scopeId: LOCAL_SCOPE_ID,
			},
		] );

		expect( rules.map( ( rule ) => rule.condition.urlFilter ) ).toEqual( expectedFilters );
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

		const forward = createProtectionNavigationRules( selectedRules );
		const reversed = createProtectionNavigationRules( [ ...selectedRules ].reverse() );
		const identifiers = forward.map( ( rule ) => rule.id );

		expect( reversed ).toEqual( forward );
		expect( identifiers ).toEqual( [
			ProtectionNavigationRuleIdStart,
			ProtectionNavigationRuleIdStart + 1,
			ProtectionNavigationRuleIdStart + 2,
			ProtectionNavigationRuleIdStart + 3,
			ProtectionNavigationRuleIdStart + 4,
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

		createProtectionNavigationRules( selectedRules );

		expect( selectedRules.map( ( rule ) => rule.host ) ).toEqual( [ 'z.example', 'a.example' ] );
	} );

	it( 'creates no redirect rules when the user has selected no sites', () => {
		expect( createProtectionNavigationRules( [] ) ).toEqual( [] );
	} );

	it( 'recognizes only identifiers reserved for protection redirects', () => {
		expect( isProtectionNavigationRuleId( ProtectionNavigationRuleIdStart ) ).toBe( true );
		expect( isProtectionNavigationRuleId( ProtectionNavigationRuleIdStart + 99_999 ) ).toBe( true );
		expect( isProtectionNavigationRuleId( ProtectionNavigationRuleIdStart - 1 ) ).toBe( false );
		expect( isProtectionNavigationRuleId( ProtectionNavigationRuleIdStart + 100_000 ) ).toBe( false );
	} );
} );
