import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSiteFaviconProvider } from './index';

const DEFAULT_ICON = Uint8Array.from( Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=', 'base64',
) );
const CACHED_ICON = Uint8Array.from( Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVQIW2P4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64',
) );

afterEach( () => vi.unstubAllGlobals() );

describe( 'createSiteFaviconProvider', () => {
	it( 'creates a Chrome extension-local cached favicon source', () => {
		const provider = createSiteFaviconProvider( {
			supportsCachedFavicons: true,
			extensionRootUrl: 'chrome-extension://test-extension-id/',
		} );

		const source = provider.getSource( 'x.com' );

		expect( source ).toBe(
			'chrome-extension://test-extension-id/_favicon/?pageUrl=https%3A%2F%2Fx.com%2F&size=32',
		);
		expect( source === null ? null : new URL( source ).protocol ).toBe( 'chrome-extension:' );
	} );

	it( 'uses the exact identity host instead of its broader protection boundary', () => {
		const provider = createSiteFaviconProvider( {
			supportsCachedFavicons: true,
			extensionRootUrl: 'chrome-extension://test-extension-id/',
		} );

		expect( provider.getSource( 'mail.google.com' ) ).toBe(
			'chrome-extension://test-extension-id/_favicon/?pageUrl=https%3A%2F%2Fmail.google.com%2F&size=32',
		);
	} );

	it( 'uses the local fallback when cached favicons are unavailable', () => {
		const provider = createSiteFaviconProvider( {
			supportsCachedFavicons: false,
			extensionRootUrl: 'moz-extension://test-extension-id/',
		} );

		expect( provider.getSource( 'x.com' ) ).toBeNull();
	} );

	it.each( [
		'https://icons.duckduckgo.com/_favicon/',
		'not a URL',
	] )( 'rejects the nonlocal extension root %s', ( extensionRootUrl ) => {
		const provider = createSiteFaviconProvider( {
			supportsCachedFavicons: true,
			extensionRootUrl,
		} );

		expect( provider.getSource( 'x.com' ) ).toBeNull();
	} );
} );

describe( 'local cached favicon resolution', () => {
	it.each( [
		[ 'infobae.com', 'https://infobae.com/' ],
		[ 'infobae.com', 'http://infobae.com/' ],
		[ 'infobae.com', 'https://www.infobae.com/' ],
		[ 'infobae.com', 'http://www.infobae.com/' ],
		[ 'www.infobae.com', 'https://www.infobae.com/' ],
		[ 'www.infobae.com', 'http://www.infobae.com/' ],
		[ 'www.infobae.com', 'https://infobae.com/' ],
		[ 'www.infobae.com', 'http://infobae.com/' ],
		[ 'tenant.github.io', 'https://www.tenant.github.io/' ],
		[ 'www.tenant.github.io', 'http://tenant.github.io/' ],
	] )( 'finds the cached icon for %s at %s after browser-default responses', async ( host, cachedPage ) => {
		const requested: string[] = [];
		const provider = createSiteFaviconProvider( {
			supportsCachedFavicons: true,
			extensionRootUrl: 'chrome-extension://test-extension-id/',
			/**
			 * Models Chrome's successful default PNG on a local cache miss.
			 * @param source - Extension-local cache resource requested by the provider.
			 * @return Browser default or the exact cached page's icon bytes.
			 */
			readLocalImage: ( source: string ) => {
				requested.push( source );
				return Promise.resolve( new URL( source ).searchParams.get( 'pageUrl' ) === cachedPage ? CACHED_ICON : DEFAULT_ICON );
			},
		} );
		const result = await provider.resolveSource?.( host );
		expect( result ).toBe( `chrome-extension://test-extension-id/_favicon/?pageUrl=${ encodeURIComponent( cachedPage ) }&size=32` );
		expect( requested[ 0 ] ).toBe( 'chrome-extension://test-extension-id/_favicon/?pageUrl=about%3Ablank&size=32' );
		expect( requested.every( ( source ) => {
			const url = new URL( source );
			return url.protocol === 'chrome-extension:' && url.host === 'test-extension-id' &&
				url.pathname === '/_favicon/' && url.searchParams.get( 'size' ) === '32' &&
				! url.searchParams.has( 'allowGoogleServerFallback' );
		} ) ).toBe( true );
	} );

	it.each( [ 'mail.google.com', 'www.mail.google.com', '127.0.0.1', '[::1]', 'localhost', 'project.localhost', 'intranet', 'co.uk' ] )(
		'does not expand unrelated or nonregistrable identity %s', async ( host ) => {
			const pages: Array<string | null> = [];
			const provider = createSiteFaviconProvider( {
				supportsCachedFavicons: true, extensionRootUrl: 'chrome-extension://test-extension-id/',
				/**
				 * Records local candidate identities while returning only browser defaults.
				 * @param source - Provider-created extension-local PNG resource.
				 * @return Local PNG bytes or an unavailable response.
				 */
				readLocalImage: ( source: string ) => {
					pages.push( new URL( source ).searchParams.get( 'pageUrl' ) );
					return Promise.resolve( DEFAULT_ICON );
				},
			} );
			expect( await provider.resolveSource?.( host ) ).toBeNull();
			expect( pages ).toEqual( [ 'about:blank', `https://${ host }/`, `http://${ host }/` ] );
		},
	);

	it( 'tries exact HTTPS and HTTP identities before their www counterpart', async () => {
		const pages: Array<string | null> = [];
		const provider = createSiteFaviconProvider( {
			supportsCachedFavicons: true, extensionRootUrl: 'chrome-extension://test-extension-id/',
			/**
			 * Records bounded candidates without connecting to a website.
			 * @param source - Provider-created extension-local PNG resource.
			 * @return Local PNG bytes or an unavailable response.
			 */
			readLocalImage: ( source: string ) => {
				pages.push( new URL( source ).searchParams.get( 'pageUrl' ) );
				return Promise.resolve( DEFAULT_ICON );
			},
		} );
		expect( await provider.resolveSource?.( 'infobae.com' ) ).toBeNull();
		expect( pages ).toEqual( [ 'about:blank', 'https://infobae.com/', 'http://infobae.com/',
			'https://www.infobae.com/', 'http://www.infobae.com/' ] );
	} );

	it( 'shares only in-flight resolution and finds an icon cached after an earlier miss', async () => {
		/**
		 * Completes the controlled browser-default read.
		 * @return No result.
		 */
		let finishBaseline: ( image: Uint8Array ) => void = () => undefined;
		let cached = false;
		let baselineReads = 0;
		const provider = createSiteFaviconProvider( {
			supportsCachedFavicons: true, extensionRootUrl: 'chrome-extension://test-extension-id/',
			/**
			 * Holds one local default read while concurrent consumers request the same host.
			 * @param source - Provider-created extension-local PNG resource.
			 * @return Local PNG bytes or an unavailable response.
			 */
			readLocalImage: ( source: string ) => {
				if ( new URL( source ).searchParams.get( 'pageUrl' ) === 'about:blank' ) {
					baselineReads++;
					return baselineReads === 1 ? new Promise<Uint8Array>( ( resolve ) => {
						finishBaseline = resolve;
					} ) : Promise.resolve( DEFAULT_ICON );
				}
				return Promise.resolve( cached ? CACHED_ICON : DEFAULT_ICON );
			},
		} );
		const first = provider.resolveSource?.( 'infobae.com' );
		const second = provider.resolveSource?.( 'infobae.com' );
		expect( first ).toBeInstanceOf( Promise );
		expect( first ).toBe( second );
		finishBaseline( DEFAULT_ICON );
		expect( await first ).toBeNull();
		expect( baselineReads ).toBe( 1 );
		cached = true;
		expect( await provider.resolveSource?.( 'infobae.com' ) ).toBe(
			'chrome-extension://test-extension-id/_favicon/?pageUrl=https%3A%2F%2Finfobae.com%2F&size=32',
		);
		expect( baselineReads ).toBe( 2 );
	} );

	it( 'skips failed local candidates and continues to an available HTTP icon', async () => {
		const provider = createSiteFaviconProvider( {
			supportsCachedFavicons: true, extensionRootUrl: 'chrome-extension://test-extension-id/',
			/**
			 * Returns an ordinary read failure for HTTPS while retaining the HTTP cache entry.
			 * @param source - Provider-created extension-local PNG resource.
			 * @return Local PNG bytes or an unavailable response.
			 */
			readLocalImage: ( source: string ) => {
				const page = new URL( source ).searchParams.get( 'pageUrl' );
				if ( page === 'https://infobae.com/' ) {
					throw new Error( 'Local cache read failed.' );
				}
				return Promise.resolve( page === 'about:blank' ? DEFAULT_ICON : CACHED_ICON );
			},
		} );
		expect( await provider.resolveSource?.( 'infobae.com' ) ).toBe(
			'chrome-extension://test-extension-id/_favicon/?pageUrl=http%3A%2F%2Finfobae.com%2F&size=32',
		);
	} );

	it.each( [ null, new Uint8Array(), Uint8Array.from( [ 1, 2, 3 ] ) ] )(
		'uses the monogram when the browser-default sample is unreadable', async ( sample ) => {
			const provider = createSiteFaviconProvider( {
				supportsCachedFavicons: true, extensionRootUrl: 'chrome-extension://test-extension-id/',
				/**
				 * Supplies an unreadable browser-default response.
				 * @return Local PNG bytes or an unavailable response.
				 */
				readLocalImage: () => Promise.resolve( sample ),
			} );
			expect( await provider.resolveSource?.( 'infobae.com' ) ).toBeNull();
		},
	);

	it( 'uses the monogram when the browser-default read rejects', async () => {
		const provider = createSiteFaviconProvider( {
			supportsCachedFavicons: true, extensionRootUrl: 'chrome-extension://test-extension-id/',
			/**
			 * Rejects the unavailable browser-default resource.
			 * @return Local PNG bytes or an unavailable response.
			 */
			readLocalImage: () => Promise.reject( new Error( 'Unavailable extension resource.' ) ),
		} );
		expect( await provider.resolveSource?.( 'infobae.com' ) ).toBeNull();
	} );

	it.each( [
		{ supportsCachedFavicons: false, extensionRootUrl: 'moz-extension://test-extension-id/' },
		{ supportsCachedFavicons: true, extensionRootUrl: 'https://example.com/' },
		{ supportsCachedFavicons: true, extensionRootUrl: 'not a URL' },
	] )( 'does not read images when local cached favicons are unavailable', async ( context ) => {
		const reader = vi.fn();
		const provider = createSiteFaviconProvider( { ...context, readLocalImage: reader } );
		expect( await provider.resolveSource?.( 'infobae.com' ) ).toBeNull();
		expect( reader ).not.toHaveBeenCalled();
	} );

	it.each( [ '', null, 'https://example.com/', 'EXAMPLE.COM', 'example.com/path' ] )(
		'rejects invalid identity %j without reading local resources', async ( host ) => {
			const reader = vi.fn();
			const provider = createSiteFaviconProvider( { supportsCachedFavicons: true,
				extensionRootUrl: 'chrome-extension://test-extension-id/', readLocalImage: reader } );
			expect( await provider.resolveSource?.( host ) ).toBeNull();
			expect( reader ).not.toHaveBeenCalled();
		},
	);

	it.each( [ 'image/png; charset=binary', null ] )(
		'fetches extension-local PNG resources with Content-Type %s without following redirects', async ( contentType ) => {
			const fetcher = vi.fn( ( source: string ) => Promise.resolve( new Response(
				new URL( source ).searchParams.get( 'pageUrl' ) === 'about:blank' ? DEFAULT_ICON : CACHED_ICON,
				{ headers: contentType === null ? {} : { 'Content-Type': contentType } },
			) ) );
			vi.stubGlobal( 'fetch', fetcher );
			const provider = createSiteFaviconProvider( {
				supportsCachedFavicons: true, extensionRootUrl: 'chrome-extension://test-extension-id/',
			} );
			expect( await provider.resolveSource?.( 'infobae.com' ) ).toBe(
				'chrome-extension://test-extension-id/_favicon/?pageUrl=https%3A%2F%2Finfobae.com%2F&size=32',
			);
			expect( fetcher ).toHaveBeenCalledTimes( 2 );
			expect( fetcher ).toHaveBeenNthCalledWith( 1,
				'chrome-extension://test-extension-id/_favicon/?pageUrl=about%3Ablank&size=32',
				{ redirect: 'error' } );
			expect( fetcher ).toHaveBeenNthCalledWith( 2,
				'chrome-extension://test-extension-id/_favicon/?pageUrl=https%3A%2F%2Finfobae.com%2F&size=32',
				{ redirect: 'error' } );
		},
	);

	it.each( [
		{ status: 404, type: 'image/png', body: DEFAULT_ICON },
		{ status: 200, type: 'text/html', body: DEFAULT_ICON },
		{ status: 200, type: null, body: new Uint8Array( 40 ) },
		{ status: 200, type: 'image/png', body: new Uint8Array() },
		{ status: 200, type: 'image/png', body: new Uint8Array( 40 ) },
	] )( 'does not present invalid cache responses as website icons', async ( { status, type, body } ) => {
		vi.stubGlobal( 'fetch', () => Promise.resolve( new Response( body,
			{ status, headers: type === null ? {} : { 'Content-Type': type } } ) ) );
		const provider = createSiteFaviconProvider( {
			supportsCachedFavicons: true, extensionRootUrl: 'chrome-extension://test-extension-id/',
		} );
		expect( await provider.resolveSource?.( 'infobae.com' ) ).toBeNull();
	} );
} );
