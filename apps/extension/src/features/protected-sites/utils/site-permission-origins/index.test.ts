import { describe, expect, it } from 'vitest';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import {
	createSitePermissionOrigins,
	isSitePermissionOriginCovered,
} from './index';

describe( 'createSitePermissionOrigins', () => {
	it( 'requests the selected registrable host and its subdomains', () => {
		expect( createSitePermissionOrigins( {
			host: 'example.com',
			includeSubdomains: true,
			scopeId: DefaultProtectionScopeId,
		} ) ).toEqual( [
			'*://*.example.com/*',
		] );
	} );

	it.each( [
		'localhost',
		'127.0.0.1',
		'[::1]',
	] )( 'requests only the exact protected host for %s', ( host ) => {
		expect( createSitePermissionOrigins( {
			host,
			includeSubdomains: false,
			scopeId: DefaultProtectionScopeId,
		} ) ).toEqual( [ `*://${ host }/*` ] );
	} );
} );

describe( 'isSitePermissionOriginCovered', () => {
	it.each( [
		'<all_urls>',
		'*://*/*',
		'*://*.example.com/*',
	] )( 'recognizes a broader %s grant', ( grantedOrigin ) => {
		expect( isSitePermissionOriginCovered(
			'*://account.example.com/*',
			[ grantedOrigin ],
		) ).toBe( true );
	} );

	it( 'recognizes complementary HTTP and HTTPS grants', () => {
		expect( isSitePermissionOriginCovered(
			'*://example.com/*',
			[ 'http://example.com/*', 'https://example.com/*' ],
		) ).toBe( true );
	} );

	it.each( [
		[ '*://*.example.com/*', '*://*.example.com/*' ],
		[ '*://*.account.example.com/*', '*://*.example.com/*' ],
		[ '*://example.com/*', '*://*.example.com/*' ],
		[ 'https://example.com/*', 'https://example.com/*' ],
	] )( 'recognizes %s as covered by %s', ( requiredOrigin, grantedOrigin ) => {
		expect( isSitePermissionOriginCovered( requiredOrigin, [ grantedOrigin ] ) ).toBe( true );
	} );

	it( 'requires a wildcard host grant for a subdomain permission', () => {
		expect( isSitePermissionOriginCovered(
			'*://*.example.com/*',
			[ '*://example.com/*' ],
		) ).toBe( false );
	} );

	it.each( [
		[ '*://example.com/*', [ 'https://example.com/*' ] ],
		[ '*://example.com/*', [ '*://different.test/*' ] ],
		[ '*://example.com/*', [ '*://example.com/specific/*' ] ],
		[ '*://*.example.com/*', [ '*://*.different.test/*' ] ],
		[ 'not-a-pattern', [ '*://*/*' ] ],
	] )( 'rejects an incomplete grant for %s', ( requiredOrigin, grantedOrigins ) => {
		expect( isSitePermissionOriginCovered( requiredOrigin, grantedOrigins ) ).toBe( false );
	} );
} );
