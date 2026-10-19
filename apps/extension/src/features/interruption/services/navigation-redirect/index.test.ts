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
		{
			label: 'a text directive without an ordinary anchor',
			documentDestination: 'https://example.test/article#',
			retainedDestination: 'https://example.test/article#:~:text=Example%20highlight',
		},
		{
			label: 'an ordinary anchor followed by a text directive',
			documentDestination: 'https://example.test/article#section-2',
			retainedDestination: 'https://example.test/article#section-2:~:text=Example%20highlight',
		},
		{
			label: 'a directive marker inside the carrier destination path',
			documentDestination: 'https://example.test/',
			retainedDestination: 'https://example.test/:~:text=Example',
		},
		{
			label: 'a directive marker inside the carrier destination query',
			documentDestination: 'https://example.test/article?value=',
			retainedDestination: 'https://example.test/article?value=:~:text=Example',
		},
	] )( 'restores the complete authorized destination for $label', async ( { documentDestination, retainedDestination } ) => {
		const harness = createHarness( `${ CURRENT_URL }#destination=${ documentDestination }` );
		harness.sendMessage.mockResolvedValue( { url: retainedDestination } );

		await expect( resolveNavigationRedirect( harness ) ).resolves.toBe( true );
		expect( harness.replace ).toHaveBeenCalledExactlyOnceWith( retainedDestination );
		expect( harness.location.href ).toBe( retainedDestination );
	} );

	it.each( [
		{
			label: 'a different path',
			documentDestination: 'https://example.test/article#',
			responseDestination: 'https://example.test/other#:~:text=Example%20highlight',
		},
		{
			label: 'a different query',
			documentDestination: 'https://example.test/article?mode=original#',
			responseDestination: 'https://example.test/article?mode=changed#:~:text=Example%20highlight',
		},
		{
			label: 'a different ordinary anchor',
			documentDestination: 'https://example.test/article#section-2',
			responseDestination: 'https://example.test/article#section-3:~:text=Example%20highlight',
		},
		{
			label: 'a different fully visible text directive',
			documentDestination: 'https://example.test/article#:~:text=Original%20highlight',
			responseDestination: 'https://example.test/article#:~:text=Example%20highlight',
		},
	] )( 'rejects a text-directive response with $label', async ( { documentDestination, responseDestination } ) => {
		const harness = createHarness( `${ CURRENT_URL }#destination=${ documentDestination }` );
		harness.sendMessage.mockResolvedValue( { url: responseDestination } );

		await expect( resolveNavigationRedirect( harness ) ).rejects.toThrow(
			/authorized navigation redirect URL/u,
		);
		expect( harness.replace ).not.toHaveBeenCalled();
	} );

	it( 'retries a failed stripped carrier without losing its complete authorized destination', async () => {
		const carrierUrl = `${ CURRENT_URL }#destination=https://example.test/article#`;
		const retainedDestination = 'https://example.test/article#:~:text=Example%20highlight';
		const harness = createHarness( carrierUrl );
		harness.sendMessage.mockResolvedValueOnce( { url: null } )
			.mockResolvedValueOnce( { url: retainedDestination } );

		await expect( resolveNavigationRedirect( harness ) ).rejects.toThrow(
			/authorized navigation redirect URL/u,
		);
		expect( harness.location.href ).toBe( carrierUrl );
		expect( harness.replace ).not.toHaveBeenCalled();

		await expect( resolveNavigationRedirect( harness ) ).resolves.toBe( true );
		expect( harness.replace ).toHaveBeenCalledExactlyOnceWith( retainedDestination );
		expect( harness.location.href ).toBe( retainedDestination );
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

	it.each( [
		{
			label: 'an ordinary carrier',
			carrierUrl: CARRIER_URL,
			retainedDestination: DESTINATION,
		},
		{
			label: 'a stripped text-directive carrier',
			carrierUrl: `${ CURRENT_URL }#destination=https://example.test/article#`,
			retainedDestination: 'https://example.test/article#:~:text=Example%20highlight',
		},
	] )( 'does not replace a changed document while $label has a pending response', async ( { carrierUrl, retainedDestination } ) => {
		const harness = createHarness( carrierUrl );
		const response = Promise.withResolvers<unknown>();
		harness.sendMessage.mockReturnValue( response.promise );
		const resolving = resolveNavigationRedirect( harness );

		harness.setHref( CURRENT_URL );
		response.resolve( { url: retainedDestination } );

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
