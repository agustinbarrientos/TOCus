import { describe, expect, it, vi } from 'vitest';
import { resolveNavigationRedirect } from './index';
import type { NavigationRedirectLocation, NavigationRedirectRuntime } from './types';

const CURRENT_URL = 'chrome-extension://extension-id/pause.html';
const DESTINATION = 'https://person:secret@example.test/watch%2Fencoded?v=one%20two#chapter%201';
const CARRIER_URL = `${ CURRENT_URL }#destination=${ DESTINATION }`;

/**
 * Creates mutable location and runtime boundaries for one redirect handshake.
 * @param href - Initial synthetic document URL.
 * @return Controllable redirect handshake dependencies.
 */
function createHarness( href = CARRIER_URL ): {
	location: NavigationRedirectLocation;
	replace: ReturnType<typeof vi.fn>;
	runtime: NavigationRedirectRuntime;
	sendMessage: ReturnType<typeof vi.fn>;
	setHref: ( href: string ) => void;
} {
	let currentHref = href;
	const replace = vi.fn<( url: string ) => void>( ( url ) => {
		currentHref = url;
	} );
	const sendMessage = vi.fn<( message: { type: 'resolve-navigation-redirect' } ) => Promise<unknown>>();

	return {
		location: {
			/**
			 * Returns the mutable synthetic document URL.
			 * @return Current synthetic URL.
			 */
			get href() {
				return currentHref;
			},
			replace,
		},
		replace,
		runtime: {
			getURL: vi.fn().mockReturnValue( CURRENT_URL ),
			sendMessage,
		},
		sendMessage,
		/**
		 * Replaces the synthetic URL without invoking the location boundary.
		 * @param nextHref - Next synthetic URL.
		 */
		setHref: ( nextHref ) => {
			currentHref = nextHref;
		},
	};
}

describe( 'resolveNavigationRedirect', () => {
	it.each( [
		CURRENT_URL,
		`${ CURRENT_URL }#other=${ DESTINATION }`,
		'chrome-extension://another-extension/pause.html#destination=https://example.test/',
	] )( 'leaves an ordinary or unrelated document available to bootstrap: %s', async ( href ) => {
		const harness = createHarness( href );

		await expect( resolveNavigationRedirect( harness ) ).resolves.toBe( false );
		expect( harness.sendMessage ).not.toHaveBeenCalled();
		expect( harness.replace ).not.toHaveBeenCalled();
	} );

	it( 'waits for authorization before replacing the exact carrier with the canonical pause page', async () => {
		const harness = createHarness();
		const response = Promise.withResolvers<unknown>();
		harness.sendMessage.mockReturnValue( response.promise );

		const resolving = resolveNavigationRedirect( harness );
		expect( harness.sendMessage ).toHaveBeenCalledExactlyOnceWith( {
			type: 'resolve-navigation-redirect',
		} );
		expect( harness.replace ).not.toHaveBeenCalled();

		response.resolve( { url: CURRENT_URL } );
		await expect( resolving ).resolves.toBe( true );
		expect( harness.replace ).toHaveBeenCalledExactlyOnceWith( CURRENT_URL );
	} );

	it( 'replaces the carrier with its exact retained destination when entry is authorized', async () => {
		const harness = createHarness();
		harness.sendMessage.mockResolvedValue( { url: DESTINATION } );

		await expect( resolveNavigationRedirect( harness ) ).resolves.toBe( true );
		expect( harness.replace ).toHaveBeenCalledExactlyOnceWith( DESTINATION );
	} );

	it.each( [
		undefined,
		null,
		{},
		{ url: 7 },
		{ url: 'javascript:alert(1)' },
		{ url: 'https://attacker.test/' },
		{ url: `${ CURRENT_URL }#unexpected` },
		{ url: null },
	] )( 'rejects a malformed or unauthorized response for carrier recovery: %j', async ( response ) => {
		const harness = createHarness();
		harness.sendMessage.mockResolvedValue( response );

		await expect( resolveNavigationRedirect( harness ) ).rejects.toThrow(
			/authorized navigation redirect/u,
		);
		expect( harness.replace ).not.toHaveBeenCalled();
	} );

	it( 'does not replace a document that changed while the runtime request was pending', async () => {
		const harness = createHarness();
		const response = Promise.withResolvers<unknown>();
		harness.sendMessage.mockReturnValue( response.promise );
		const resolving = resolveNavigationRedirect( harness );

		harness.setHref( CURRENT_URL );
		response.resolve( { url: DESTINATION } );

		await expect( resolving ).resolves.toBe( true );
		expect( harness.replace ).not.toHaveBeenCalled();
	} );

	it( 'reports a failed runtime response for carrier recovery', async () => {
		const harness = createHarness();
		const failure = new Error( 'Background unavailable.' );
		harness.sendMessage.mockRejectedValue( failure );

		await expect( resolveNavigationRedirect( harness ) ).rejects.toBe( failure );
		expect( harness.replace ).not.toHaveBeenCalled();
	} );
} );
