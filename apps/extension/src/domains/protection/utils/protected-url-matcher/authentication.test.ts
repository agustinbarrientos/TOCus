import { describe, expect, it } from 'vitest';
import { ProtectedUrlMatchStatus } from '../../types/protected-url-match';
import { matchProtectedUrl } from './index';

const youtube = { host: 'youtube.com', includeSubdomains: true, scopeId: 'scope_default' };

describe( 'authentication navigation', () => {
	it.each( [
		'https://accounts.youtube.com/accounts/SetSID?continue=https%3A%2F%2Fexample.com%2F',
		'https://ACCOUNTS.YOUTUBE.COM./accounts/SetSID',
		'http://accounts.youtube.com/accounts/CheckConnection',
	] )( 'bypasses the exact authentication host for an existing YouTube rule: %s', ( url ) => {
		expect( matchProtectedUrl( url, [ youtube ] ) ).toEqual( { status: ProtectedUrlMatchStatus.UNPROTECTED } );
	} );

	it( 'bypasses explicit authentication-host and path rules without changing stored choices', () => {
		const rules = [ youtube, { ...youtube, host: 'accounts.youtube.com', includeSubdomains: false,
			pathPrefix: '/accounts', behavior: 'pause' } ];
		const saved = structuredClone( rules );
		expect( matchProtectedUrl( 'https://accounts.youtube.com/accounts/SetSID', rules ) ).toEqual( { status: ProtectedUrlMatchStatus.UNPROTECTED } );
		expect( rules ).toEqual( saved );
	} );

	it.each( [
		'https://youtube.com/',
		'https://www.youtube.com/watch?v=example',
		'https://www.youtube.com/shorts/example',
		'https://music.youtube.com/',
		'https://child.accounts.youtube.com/',
		'https://notaccounts.youtube.com/',
		'https://www.youtube.com/watch?next=https://accounts.youtube.com/',
	] )( 'keeps YouTube content and other subdomains protected: %s', ( url ) => {
		expect( matchProtectedUrl( url, [ youtube ] ).status ).toBe( ProtectedUrlMatchStatus.PROTECTED );
	} );

	it( 'does not treat account-host lookalikes as authentication infrastructure', () => {
		const rule = { ...youtube, host: 'accounts.youtube.com.example.com', includeSubdomains: false };
		expect( matchProtectedUrl( 'https://accounts.youtube.com.example.com/', [ rule ] ).status ).toBe( ProtectedUrlMatchStatus.PROTECTED );
	} );
} );
