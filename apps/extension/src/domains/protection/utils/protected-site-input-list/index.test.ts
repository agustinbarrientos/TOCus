import { describe, expect, it } from 'vitest';
import { DefaultProtectionScopeId } from '../../types/protection-value';
import { canonicalizeProtectedSiteInputs, splitProtectedSiteInputs } from './index';

describe( 'comma-separated website inputs', () => {
	it.each( [
		{ input: '', expected: [] },
		{ input: ' ,  , ', expected: [] },
		{ input: ' example.com ', expected: [ 'example.com' ] },
		{ input: ', example.com, , sub.example.com/path, ', expected: [ 'example.com', 'sub.example.com/path' ] },
	] )( 'trims and ignores empty addresses in "$input"', ( { input, expected } ) => {
		expect( splitProtectedSiteInputs( input ) ).toEqual( expected );
	} );

	it( 'canonicalizes complete domains, product subdomains and paths without losing explicit targets', () => {
		expect( canonicalizeProtectedSiteInputs( 'https://www.youtube.com/, music.youtube.com, example.com/articles/',
			DefaultProtectionScopeId ) ).toEqual( { invalidInputs: [], sites: [
			{ identityHost: 'www.youtube.com', rule: { host: 'youtube.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId } },
			{ identityHost: 'music.youtube.com', rule: { host: 'music.youtube.com', includeSubdomains: false, scopeId: DefaultProtectionScopeId } },
			{ identityHost: 'example.com', rule: { host: 'example.com', includeSubdomains: true, pathPrefix: '/articles', scopeId: DefaultProtectionScopeId } },
		] } );
	} );

	it( 'deduplicates canonical rules in first occurrence order while retaining distinct paths and subdomains', () => {
		const result = canonicalizeProtectedSiteInputs( 'www.example.com, https://example.com/, example.com/a, example.com/a/, example.com/b, sub.example.com', DefaultProtectionScopeId );
		expect( result.invalidInputs ).toEqual( [] );
		expect( result.sites.map( ( site ) => [ site.identityHost, site.rule.pathPrefix ] ) ).toEqual( [
			[ 'www.example.com', undefined ], [ 'example.com', '/a' ], [ 'example.com', '/b' ], [ 'sub.example.com', undefined ],
		] );
	} );

	it( 'identifies every invalid address without silently losing valid entries or empty-segment handling', () => {
		const result = canonicalizeProtectedSiteInputs( ', example.com, not a website, , chrome://settings, example.org,', DefaultProtectionScopeId );
		expect( result.invalidInputs ).toEqual( [ 'not a website', 'chrome://settings' ] );
		expect( result.sites.map( ( site ) => site.identityHost ) ).toEqual( [ 'example.com', 'example.org' ] );
	} );

	it( 'does not turn separators into rules', () => {
		expect( canonicalizeProtectedSiteInputs( ', ,', DefaultProtectionScopeId ) ).toEqual( { sites: [], invalidInputs: [] } );
	} );

	it( 'preserves encoded commas within paths as part of a single address', () => {
		const result = canonicalizeProtectedSiteInputs( 'example.com/a%2Cb, example.org', DefaultProtectionScopeId );
		expect( result.sites.map( ( site ) => site.rule.pathPrefix ) ).toEqual( [ '/a%2Cb', undefined ] );
		expect( result.invalidInputs ).toEqual( [] );
	} );
} );
