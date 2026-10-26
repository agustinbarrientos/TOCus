import { describe, expect, it, vi } from 'vitest';
import { resolveNavigationRedirect } from './index';
import type { NavigationRedirectLocation, NavigationRedirectRuntime } from './types';

const CURRENT_URL = 'chrome-extension://extension-id/pause.html';
const DESTINATION = 'https://person:secret@example.test/watch%2Fencoded?v=one%20two#chapter%201';
const CARRIER_URL = `${ CURRENT_URL }#destination=${ DESTINATION }`;

/**
 * Creates mutable location and runtime boundaries for one redirect handshake.
 * @param href - Initial synthetic document URL.
 * @param initialState - State retained by the current browser-history entry.
 * @return Controllable redirect handshake dependencies.
 */
function createHarness( href = CARRIER_URL, initialState: unknown = null ): {
	history: { readonly state: unknown;
		replaceState: ReturnType<typeof vi.fn<( state: unknown, unused: string, url: string ) => void>> };
	location: NavigationRedirectLocation;
	replace: ReturnType<typeof vi.fn>;
	reload: ReturnType<typeof vi.fn>;
	runtime: NavigationRedirectRuntime;
	sendMessage: ReturnType<typeof vi.fn>;
	setHref: ( href: string ) => void;
} {
	let currentHref = href;
	let currentState = initialState;
	const replaceState = vi.fn<( state: unknown, unused: string, url: string ) => void>( ( state, _unused, url ) => {
		currentState = state;
		currentHref = url;
	} );
	const replace = vi.fn<( url: string ) => void>( ( url ) => {
		currentHref = url;
	} );
	const reload = vi.fn<() => void>();
	const sendMessage = vi.fn<( message: { type: 'resolve-navigation-redirect' } ) => Promise<unknown>>();

	return {
		history: {
			/**
			 * Returns the state owned by the current history entry.
			 * @return State retained by the active entry.
			 */
			get state() {
				return currentState;
			},
			replaceState,
		},
		location: {
			/**
			 * Returns the mutable synthetic document URL.
			 * @return Current synthetic URL.
			 */
			get href() {
				return currentHref;
			},
			replace,
			reload,
		},
		replace,
		reload,
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

	it( 'waits for authorization before retaining the carrier in the canonical pause history entry', async () => {
		const harness = createHarness();
		const response = Promise.withResolvers<unknown>();
		harness.sendMessage.mockReturnValue( response.promise );

		const resolving = resolveNavigationRedirect( harness );
		expect( harness.sendMessage ).toHaveBeenCalledExactlyOnceWith( {
			type: 'resolve-navigation-redirect',
		} );
		expect( harness.replace ).not.toHaveBeenCalled();

		expect( harness.history.state ).toBeNull();
		expect( harness.history.replaceState ).not.toHaveBeenCalled();
		response.resolve( { url: CURRENT_URL } );
		await expect( resolving ).resolves.toBe( true );
		expect( harness.reload ).toHaveBeenCalledOnce();
		expect( harness.location.href ).toBe( CURRENT_URL );
		expect( harness.replace ).not.toHaveBeenCalled();
		expect( harness.history.state ).toEqual( {
			tocusInterruptionNavigation: { documentUrl: CURRENT_URL, destination: DESTINATION, pendingBootstrap: true },
		} );
	} );

	it.each( [ 'reload', undefined ] )( 'consumes one authorized canonical bootstrap without replaying or looping: %s',
		async ( navigationType ) => {
			const harness = createHarness( CURRENT_URL, {
				tocusInterruptionNavigation: {
					documentUrl: CURRENT_URL, destination: DESTINATION, pendingBootstrap: true,
				},
			} );

			await expect( resolveNavigationRedirect( { ...harness, navigationType } ) ).resolves.toBe( false );
			expect( harness.history.state ).toEqual( {
				tocusInterruptionNavigation: {
					documentUrl: CURRENT_URL, destination: DESTINATION, pendingBootstrap: false,
				},
			} );
			expect( harness.location.href ).toBe( CURRENT_URL );
			expect( harness.sendMessage ).not.toHaveBeenCalled();
			expect( harness.replace ).not.toHaveBeenCalled();
			expect( harness.reload ).not.toHaveBeenCalled();

			await expect( resolveNavigationRedirect( { ...harness, navigationType } ) ).resolves.toBe( true );
			expect( harness.location.href ).toBe( CARRIER_URL );
			expect( harness.reload ).toHaveBeenCalledOnce();
		},
	);

	it.each( [ 'navigate', 'back_forward', 'prerender', 'unexpected' ] )(
		'revalidates a retained history destination despite an unconsumed reload marker: %s', async ( navigationType ) => {
			const harness = createHarness( CURRENT_URL, {
				tocusInterruptionNavigation: {
					documentUrl: CURRENT_URL, destination: DESTINATION, pendingBootstrap: true,
				},
			} );

			await expect( resolveNavigationRedirect( { ...harness, navigationType } ) ).resolves.toBe( true );
			expect( harness.location.href ).toBe( CARRIER_URL );
			expect( harness.reload ).toHaveBeenCalledOnce();
			expect( harness.sendMessage ).not.toHaveBeenCalled();
		},
	);

	it( 'revalidates an explicit recovery even during a pending canonical bootstrap', async () => {
		const harness = createHarness( CURRENT_URL, {
			tocusInterruptionNavigation: {
				documentUrl: CURRENT_URL, destination: DESTINATION, pendingBootstrap: true,
			},
		} );

		await expect( resolveNavigationRedirect( {
			...harness, navigationType: 'reload', recoverRetainedHistory: true,
		} ) ).resolves.toBe( true );
		expect( harness.location.href ).toBe( CARRIER_URL );
		expect( harness.reload ).toHaveBeenCalledOnce();
		expect( harness.sendMessage ).not.toHaveBeenCalled();
	} );

	it( 'revalidates each history destination before connecting to any existing participant without a loop', async () => {
		const harness = createHarness( CURRENT_URL, {
			tocusInterruptionNavigation: { documentUrl: CURRENT_URL, destination: DESTINATION },
		} );
		harness.sendMessage.mockResolvedValue( { url: CURRENT_URL } );
		for ( let restore = 1; restore <= 2; restore += 1 ) {
			await expect( resolveNavigationRedirect( { ...harness, navigationType: 'back_forward' } ) )
				.resolves.toBe( true );
			expect( harness.location.href ).toBe( CARRIER_URL );
			expect( harness.sendMessage ).toHaveBeenCalledTimes( restore - 1 );
			expect( harness.reload ).toHaveBeenCalledTimes( restore * 2 - 1 );

			await expect( resolveNavigationRedirect( harness ) ).resolves.toBe( true );
			expect( harness.sendMessage ).toHaveBeenCalledTimes( restore );
			expect( harness.location.href ).toBe( CURRENT_URL );
			expect( harness.reload ).toHaveBeenCalledTimes( restore * 2 );

			await expect( resolveNavigationRedirect( { ...harness, navigationType: 'reload' } ) ).resolves.toBe( false );
			expect( harness.sendMessage ).toHaveBeenCalledTimes( restore );
			expect( harness.reload ).toHaveBeenCalledTimes( restore * 2 );
		}
		expect( harness.replace ).not.toHaveBeenCalled();
	} );

	it( 'releases a recovered history destination only after its new carrier obtains authorization', async () => {
		const harness = createHarness( CURRENT_URL, {
			tocusInterruptionNavigation: { documentUrl: CURRENT_URL, destination: DESTINATION },
		} );
		await expect( resolveNavigationRedirect( { ...harness, recoverRetainedHistory: true } ) ).resolves.toBe( true );
		expect( harness.location.href ).toBe( CARRIER_URL );
		expect( harness.sendMessage ).not.toHaveBeenCalled();
		expect( harness.replace ).not.toHaveBeenCalled();
		const response = Promise.withResolvers<unknown>();
		harness.sendMessage.mockReturnValue( response.promise );
		const resolving = resolveNavigationRedirect( harness );

		response.resolve( { url: DESTINATION } );
		await expect( resolving ).resolves.toBe( true );
		expect( harness.replace ).toHaveBeenCalledExactlyOnceWith( DESTINATION );
		expect( harness.reload ).toHaveBeenCalledOnce();
	} );

	it.each( [
		null, [], {}, { destination: DESTINATION },
		{ tocusInterruptionNavigation: null },
		{ tocusInterruptionNavigation: { documentUrl: 'chrome-extension://other/pause.html', destination: DESTINATION } },
		{ tocusInterruptionNavigation: { documentUrl: CURRENT_URL, destination: 'javascript:alert(1)' } },
		{ tocusInterruptionNavigation: { documentUrl: CURRENT_URL, destination: 'https://' } },
		{ tocusInterruptionNavigation: { documentUrl: CURRENT_URL, destination: 7 } },
	] )( 'ignores unrelated or malformed history state without sending its destination: %j', async ( state ) => {
		const harness = createHarness( CURRENT_URL, state );

		await expect( resolveNavigationRedirect( { ...harness, recoverRetainedHistory: true } ) )
			.resolves.toBe( false );
		expect( harness.sendMessage ).not.toHaveBeenCalled();
		expect( harness.history.replaceState ).not.toHaveBeenCalled();
		expect( harness.replace ).not.toHaveBeenCalled();
	} );

	it.each( [ 'https://unrelated.test/', `${ CURRENT_URL }#unrelated`, 'chrome-extension://other/pause.html' ] )(
		'never restores a history marker from an unrelated current document: %s', async ( href ) => {
			const harness = createHarness( href, {
				tocusInterruptionNavigation: { documentUrl: CURRENT_URL, destination: DESTINATION },
			} );
			await expect( resolveNavigationRedirect( { ...harness, recoverRetainedHistory: true } ) )
				.resolves.toBe( false );
			expect( harness.sendMessage ).not.toHaveBeenCalled();
			expect( harness.history.replaceState ).not.toHaveBeenCalled();
		},
	);

	it( 'does not canonicalize or reload after the carrier navigates elsewhere during authorization', async () => {
		const harness = createHarness();
		const response = Promise.withResolvers<unknown>();
		harness.sendMessage.mockReturnValue( response.promise );
		const resolving = resolveNavigationRedirect( harness );
		harness.setHref( 'https://elsewhere.test/' );
		response.resolve( { url: CURRENT_URL } );

		await expect( resolving ).resolves.toBe( true );
		expect( harness.location.href ).toBe( 'https://elsewhere.test/' );
		expect( harness.history.replaceState ).not.toHaveBeenCalled();
		expect( harness.replace ).not.toHaveBeenCalled();
		expect( harness.reload ).not.toHaveBeenCalled();
	} );

	it( 'keeps a denied history restore as a recoverable carrier without opening the destination', async () => {
		const harness = createHarness( CURRENT_URL, {
			tocusInterruptionNavigation: { documentUrl: CURRENT_URL, destination: DESTINATION },
		} );
		await expect( resolveNavigationRedirect( { ...harness, recoverRetainedHistory: true } ) ).resolves.toBe( true );
		harness.sendMessage.mockResolvedValue( { url: null } );

		await expect( resolveNavigationRedirect( harness ) ).rejects.toThrow( /authorized navigation redirect/u );
		expect( harness.location.href ).toBe( CARRIER_URL );
		expect( harness.replace ).not.toHaveBeenCalled();
		expect( harness.reload ).toHaveBeenCalledOnce();
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

	it( 'retains the complete authorized text directive across canonical history recovery', async () => {
		const visibleCarrier = `${ CURRENT_URL }#destination=https://example.test/article#section-2`;
		const destination = 'https://example.test/article#section-2:~:text=Example%20highlight';
		const harness = createHarness( visibleCarrier );
		harness.sendMessage.mockResolvedValue( { url: CURRENT_URL, retainedDestination: destination } );

		await expect( resolveNavigationRedirect( harness ) ).resolves.toBe( true );
		expect( harness.history.state ).toEqual( {
			tocusInterruptionNavigation: { documentUrl: CURRENT_URL, destination, pendingBootstrap: true },
		} );
		const restored = createHarness( CURRENT_URL, harness.history.state );
		await expect( resolveNavigationRedirect( { ...restored, recoverRetainedHistory: true } ) )
			.resolves.toBe( true );
		expect( restored.history.replaceState ).toHaveBeenCalledExactlyOnceWith(
			harness.history.state, '', `${ CURRENT_URL }#destination=${ destination }`,
		);
		expect( restored.sendMessage ).not.toHaveBeenCalled();
		expect( restored.reload ).toHaveBeenCalledOnce();
		restored.setHref( visibleCarrier );
		restored.sendMessage.mockResolvedValue( { url: CURRENT_URL, retainedDestination: destination } );

		await expect( resolveNavigationRedirect( restored ) ).resolves.toBe( true );
		expect( restored.history.state ).toEqual( harness.history.state );
		expect( restored.location.href ).toBe( CURRENT_URL );
		expect( restored.reload ).toHaveBeenCalledTimes( 2 );
		expect( restored.replace ).not.toHaveBeenCalled();
	} );

	it.each( [
		undefined, null, 7, 'javascript:alert(1)', 'https://attacker.test/',
		'https://example.test/article#other:~:text=Example',
	] )( 'rejects an explicitly malformed or mismatched retained destination: %j', async ( retainedDestination ) => {
		const harness = createHarness( `${ CURRENT_URL }#destination=https://example.test/article#section-2` );
		harness.sendMessage.mockResolvedValue( { url: CURRENT_URL, retainedDestination } );

		await expect( resolveNavigationRedirect( harness ) ).rejects.toThrow( /authorized navigation redirect/u );
		expect( harness.history.replaceState ).not.toHaveBeenCalled();
		expect( harness.replace ).not.toHaveBeenCalled();
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
