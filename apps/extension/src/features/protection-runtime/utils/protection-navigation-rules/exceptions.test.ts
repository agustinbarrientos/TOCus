import { describe, expect, it } from 'vitest';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import { createProtectionNavigationRules } from './index';

describe( 'exception navigation projection', () => {
	it( 'ranks full-URL selectors with segment boundaries and specific protection over an allow', () => {
		const root = { host: 'example.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId };
		const rules = createProtectionNavigationRules(
			[
				root,
				{ ...root, pathPrefix: '/feed', behavior: 'allow' },
				{ ...root, pathPrefix: '/feed/private' },
				{ ...root, host: 'studio.example.com', includeSubdomains: false, behavior: 'allow' },
			],
			'chrome-extension://test/pause.html',
		);
		for ( const [ url, expected ] of [
			[ 'https://example.com/feed?x=1#:~:text=hello', 'allow' ],
			[ 'https://example.com./feed', 'allow' ],
			[ 'https://example.com/feed/private/one?q=1#two', 'redirect' ],
			[ 'https://example.com/feedmore', 'redirect' ],
			[ 'https://example.com/Feed', 'redirect' ],
			[ 'https://example.com/feed%2Fone', 'redirect' ],
			[ 'https://studio.example.com/feed/private', 'allow' ],
			[ 'https://user:pass@sub.example.com:8443/feed/one#two', 'allow' ],
		] as const ) {
			const selected = rules
				.filter( ( rule ) => new RegExp( rule.condition.regexFilter ?? '' ).test( url ) )
				.sort( ( a, b ) => ( b.priority ?? 1 ) - ( a.priority ?? 1 ) )[ 0 ];
			expect( selected?.action.type, url ).toBe( expected );
			expect( selected?.condition.isUrlFilterCaseSensitive ).toBe( true );
			expect( new RegExp( selected?.condition.regexFilter ?? '' ).exec( url )?.[ 0 ] ).toBe( url );
		}
		expect(
			rules.every(
				( rule ) => ! new RegExp( rule.condition.regexFilter ?? '' ).test( 'https://example.com.evil.test/feed' ),
			),
		).toBe( true );
	} );
} );
