import { describe, expect, it } from 'vitest';
import {
	ProtectedSiteRuleSchema,
	type ProtectedSiteRule,
} from '../../../../domains/protection/types/protected-site-rule';
import { resolveSiteDisplayIdentity } from './index';

const DEFAULT_SCOPE_ID = 'scope_default';

/**
 * Creates one protected-site rule for display-name resolver tests.
 * @param host - Canonical protection boundary.
 * @param includeSubdomains - Whether the rule owns descendant hosts.
 * @return Complete protected-site rule.
 * @since 0.1.0 Initial implementation.
 */
function createRule( host: string, includeSubdomains = true ): ProtectedSiteRule {
	return ProtectedSiteRuleSchema.parse( {
		host,
		includeSubdomains,
		scopeId: DEFAULT_SCOPE_ID,
	} );
}

describe( 'resolveSiteDisplayIdentity', () => {
	it.each( [
		[ 'x.com', 'X' ],
		[ 'twitter.com', 'X' ],
		[ 'chatgpt.com', 'ChatGPT' ],
		[ 'youtube.com', 'YouTube' ],
		[ 'github.com', 'GitHub' ],
	] )( 'uses the exact local alias for %s', ( host, name ) => {
		expect( resolveSiteDisplayIdentity( {
			identityHost: host,
			rule: createRule( host ),
		} ).name ).toBe( name );
	} );

	it.each( [
		[ 'crazygames.com', 'crazygames.com', 'CrazyGames' ],
		[ 'mail.google.com', 'google.com', 'Gmail' ],
		[ 'docs.google.com', 'google.com', 'Google Docs' ],
		[ 'news.ycombinator.com', 'ycombinator.com', 'Hacker News' ],
		[ 'old.reddit.com', 'reddit.com', 'Reddit' ],
	] )( 'uses the catalog identity %s for %s', ( identityHost, protectionHost, name ) => {
		expect( resolveSiteDisplayIdentity( {
			identityHost,
			rule: createRule( protectionHost ),
		} ).name ).toBe( name );
	} );

	it( 'derives a readable name when no exact alias exists', () => {
		expect( resolveSiteDisplayIdentity( {
			identityHost: 'instagram.com',
			rule: createRule( 'instagram.com' ),
		} ).name ).toBe( 'Instagram' );
		expect( resolveSiteDisplayIdentity( {
			identityHost: 'app.my-focus-space.example',
			rule: createRule( 'my-focus-space.example' ),
		} ).name ).toBe( 'My focus space' );
		expect( resolveSiteDisplayIdentity( {
			identityHost: 'localhost',
			rule: createRule( 'localhost', false ),
		} ).name ).toBe( 'Localhost' );
		expect( resolveSiteDisplayIdentity( {
			identityHost: '127.0.0.1',
			rule: createRule( '127.0.0.1', false ),
		} ).name ).toBe( '127.0.0.1' );
		expect( resolveSiteDisplayIdentity( {
			identityHost: 'notx.com',
			rule: createRule( 'notx.com' ),
		} ).name ).toBe( 'Notx' );
	} );

	it( 'keeps an unknown internationalized host in its canonical form', () => {
		expect( resolveSiteDisplayIdentity( {
			identityHost: 'xn--bcher-kva.de',
			rule: createRule( 'xn--bcher-kva.de' ),
		} ) ).toMatchObject( {
			name: 'xn--bcher-kva.de',
			monogram: 'X',
		} );
		expect( resolveSiteDisplayIdentity( {
			identityHost: 'xn--test-9k5y.com',
			rule: createRule( 'xn--test-9k5y.com' ),
		} ) ).toMatchObject( {
			name: 'xn--test-9k5y.com',
			monogram: 'X',
		} );
		expect( resolveSiteDisplayIdentity( {
			identityHost: 'xn--pple-43d.example.com',
			rule: createRule( 'example.com' ),
		} ) ).toMatchObject( {
			name: 'xn--pple-43d.example.com',
			monogram: 'X',
		} );
	} );

	it( 'uses a trimmed editable name and falls back when it is cleared', () => {
		expect( resolveSiteDisplayIdentity( {
			identityHost: 'x.com',
			rule: createRule( 'x.com' ),
			displayNameOverride: '  My social space  ',
		} ).name ).toBe( 'My social space' );
		expect( resolveSiteDisplayIdentity( {
			identityHost: 'x.com',
			rule: createRule( 'x.com' ),
			displayNameOverride: '   ',
		} ).name ).toBe( 'X' );
	} );

	it.each( [
		[ '\u00c1nimo', '\u00c1' ],
		[ '\u042f\u043d\u0434\u0435\u043a\u0441', '\u042f' ],
		[ '\u30c1\u30e3\u30c3\u30c8', '\u30c1' ],
		[ '\ufb03nd', 'F' ],
		[ '...', '?' ],
	] )( 'creates the Unicode monogram %s for %s', ( name, monogram ) => {
		expect( resolveSiteDisplayIdentity( {
			identityHost: 'example.com',
			rule: createRule( 'example.com' ),
			displayNameOverride: name,
		} ).monogram ).toBe( monogram );
	} );

	it( 'returns a stable local identity without mutating its input', () => {
		const input = Object.freeze( {
			identityHost: 'subdomain.quiet-corner.example',
			rule: createRule( 'quiet-corner.example' ),
		} );
		const firstIdentity = resolveSiteDisplayIdentity( input );
		const secondIdentity = resolveSiteDisplayIdentity( input );

		expect( firstIdentity.name ).toBe( 'Quiet corner' );
		expect( firstIdentity.monogram ).toBe( 'Q' );
		expect( firstIdentity.colorIndex ).toBeGreaterThanOrEqual( 0 );
		expect( firstIdentity.colorIndex ).toBeLessThan( 6 );
		expect( secondIdentity ).toEqual( firstIdentity );
	} );

	it( 'rejects an identity host outside its protection boundary', () => {
		expect( () => resolveSiteDisplayIdentity( {
			identityHost: 'mail.google.com',
			rule: createRule( 'x.com' ),
		} ) ).toThrow();
	} );

	it( 'rejects a descendant identity owned by an exact-only rule', () => {
		expect( () => resolveSiteDisplayIdentity( {
			identityHost: 'sub.localhost',
			rule: createRule( 'localhost', false ),
		} ) ).toThrow();
	} );
} );
