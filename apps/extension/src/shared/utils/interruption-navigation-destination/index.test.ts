import { describe, expect, it } from 'vitest';
import { readInterruptionNavigationDestination } from './index';

const CURRENT_URL = 'chrome-extension://extension-id/pause.html';

describe( 'readInterruptionNavigationDestination', () => {
	it.each( [
		'https://example.test/watch?v=regression#chapter-2',
		'https://example.test/a%2Fb/%E2%9C%93?next=https%3A%2F%2Fother.test%2Fx%3Fy%3D1#encoded%20fragment',
		'http://person:secret@example.test/private?mode=exact#credentials',
		'https://[2001:db8::1]:8443/watch?quality=high#ipv6',
	] )( 'preserves the exact HTTP(S) destination %s', ( destination ) => {
		expect( readInterruptionNavigationDestination(
			`${ CURRENT_URL }#destination=${ destination }`,
			CURRENT_URL,
		) ).toBe( destination );
	} );

	it.each( [
		undefined,
		'',
		CURRENT_URL,
		`${ CURRENT_URL }#destination=`,
		`${ CURRENT_URL }#destination=https://`,
		`${ CURRENT_URL }#destination=https://[2001:db8::1`,
		`${ CURRENT_URL }#destination= https://example.test/watch`,
		`${ CURRENT_URL }#destination=/watch`,
		`${ CURRENT_URL }#destination=HTTPS://example.test/watch`,
		`${ CURRENT_URL }#destination=ftp://example.test/watch`,
		`${ CURRENT_URL }#destination=javascript:alert(1)`,
		`${ CURRENT_URL }#destination=chrome-extension://extension-id/options.html`,
		`${ CURRENT_URL }?destination=https://example.test/watch`,
		`${ CURRENT_URL }#website=example.test`,
		`${ CURRENT_URL }#https://example.test/watch`,
		'chrome-extension://extension-id/interruption.html#destination=https://example.test/watch',
		'chrome-extension://another-extension/pause.html#destination=https://example.test/watch',
		`${ CURRENT_URL }/spoof#destination=https://example.test/watch`,
		`https://attacker.test/${ CURRENT_URL }#destination=https://example.test/watch`,
	] )( 'rejects unavailable, malformed, non-HTTP, legacy, or spoofed candidate %s', ( candidate ) => {
		expect( readInterruptionNavigationDestination( candidate, CURRENT_URL ) ).toBeNull();
	} );
} );
