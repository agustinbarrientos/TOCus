import { describe, expect, it } from 'vitest';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import { createProtectionNavigationRules } from './index';

const youtube = { host: 'youtube.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId };

describe( 'authentication interception', () => {
	it.each( [
		[ youtube ],
		[ youtube, { ...youtube, host: 'accounts.youtube.com', includeSubdomains: false, pathPrefix: '/accounts' } ],
		[ { ...youtube, host: 'accounts.youtube.com', includeSubdomains: false } ],
		[ { ...youtube, pathPrefix: '/accounts' } ],
	] )( 'allows authentication even when a saved rule would pause it (%j)', ( ...sites ) => {
		const rules = createProtectionNavigationRules( sites, 'chrome-extension://test/pause.html' );
		for ( const url of [ 'https://accounts.youtube.com/accounts/SetSID',
			'https://accounts.youtube.com./accounts/SetSID?continue=https%3A%2F%2Fexample.com%2F',
			'http://accounts.youtube.com/accounts/CheckConnection' ] ) {
			const selected = rules.filter( ( rule ) => new RegExp( rule.condition.regexFilter ?? '' ).test( url ) )
				.sort( ( a, b ) => ( b.priority ?? 1 ) - ( a.priority ?? 1 ) )[ 0 ];
			expect( selected?.action.type, url ).toBe( 'allow' );
		}
	} );

	it.each( [
		'https://youtube.com/',
		'https://www.youtube.com/watch?v=example',
		'https://www.youtube.com/shorts/example',
		'https://music.youtube.com/',
		'https://child.accounts.youtube.com/',
		'https://notaccounts.youtube.com/',
		'https://www.youtube.com/watch?next=https://accounts.youtube.com/',
	] )( 'still intercepts content outside the exact authentication host: %s', ( url ) => {
		const rules = createProtectionNavigationRules( [ youtube ], 'chrome-extension://test/pause.html' );
		const selected = rules.filter( ( rule ) => new RegExp( rule.condition.regexFilter ?? '' ).test( url ) )
			.sort( ( a, b ) => ( b.priority ?? 1 ) - ( a.priority ?? 1 ) )[ 0 ];
		expect( selected?.action.type ).toBe( 'redirect' );
	} );
} );
