import { describe, expect, it } from 'vitest';
import { DefaultProtectionScopeId, ProtectionScopeIdSchema } from '../../types/protection-value';
import { getProtectedSiteGroupHost, getProtectedSiteRuleKey } from './index';

const root = { host: 'youtube.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId };

describe( 'protected-site identity', () => {
	it( 'keeps keys stable across behavior and scope edits while distinguishing ranges', () => {
		expect( getProtectedSiteRuleKey( root ) ).toBe( '["youtube.com",true,"/"]' );
		expect( getProtectedSiteRuleKey( { ...root, behavior: 'allow', scopeId: ProtectionScopeIdSchema.parse( 'scope_other' ) } ) ).toBe( '["youtube.com",true,"/"]' );
		expect( getProtectedSiteRuleKey( { ...root, pathPrefix: '/shorts' } ) ).toBe( '["youtube.com",true,"/shorts"]' );
		expect( getProtectedSiteRuleKey( { ...root, includeSubdomains: false } ) ).toBe( '["youtube.com",false,"/"]' );
	} );

	it.each( [
		[ 'studio.youtube.com', 'youtube.com' ], [ 'www.alice.github.io', 'alice.github.io' ],
		[ 'example.co.uk', 'example.co.uk' ], [ 'foo.localhost', 'foo.localhost' ], [ 'a.dev.internal', 'a.dev.internal' ],
		[ '[::1]', '[::1]' ],
	] )( 'groups %s under %s without manufacturing a rule', ( host, group ) => {
		expect( getProtectedSiteGroupHost( host ) ).toBe( group );
	} );
} );
