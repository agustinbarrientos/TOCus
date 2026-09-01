import { describe, expect, it, vi } from 'vitest';
import { createSiteFaviconProvider } from './index';

/**
 * Creates one deterministic Chrome extension URL for favicon-provider tests.
 * @param path - Extension-local resource path.
 * @return Chrome extension URL for the requested path.
 * @since 0.1.0 Initial implementation.
 */
function getChromeExtensionUrl( path: string ): string {
	return `chrome-extension://test-extension-id${ path }`;
}

describe( 'createSiteFaviconProvider', () => {
	it( 'creates a Chrome extension-local cached favicon source', () => {
		const getExtensionUrl = vi.fn( ( path: string ) => `chrome-extension://test-extension-id${ path }` );
		const provider = createSiteFaviconProvider( {
			supportsCachedFavicons: true,
			getExtensionUrl,
		} );

		const source = provider.getSource( 'x.com' );

		expect( source ).toBe(
			'chrome-extension://test-extension-id/_favicon/?pageUrl=https%3A%2F%2Fx.com%2F&size=32',
		);
		expect( source === null ? null : new URL( source ).protocol ).toBe( 'chrome-extension:' );
		expect( getExtensionUrl ).toHaveBeenCalledExactlyOnceWith( '/_favicon/' );
	} );

	it( 'uses the exact identity host instead of its broader protection boundary', () => {
		const provider = createSiteFaviconProvider( {
			supportsCachedFavicons: true,
			getExtensionUrl: getChromeExtensionUrl,
		} );

		expect( provider.getSource( 'mail.google.com' ) ).toBe(
			'chrome-extension://test-extension-id/_favicon/?pageUrl=https%3A%2F%2Fmail.google.com%2F&size=32',
		);
	} );

	it( 'uses the local fallback when cached favicons are unavailable', () => {
		const getExtensionUrl = vi.fn( ( path: string ) => `moz-extension://test-extension-id${ path }` );
		const provider = createSiteFaviconProvider( {
			supportsCachedFavicons: false,
			getExtensionUrl,
		} );

		expect( provider.getSource( 'x.com' ) ).toBeNull();
		expect( getExtensionUrl ).not.toHaveBeenCalled();
	} );

	it.each( [
		'https://icons.duckduckgo.com/_favicon/',
		'not a URL',
	] )( 'rejects the nonlocal extension source %s', ( extensionUrl ) => {
		const provider = createSiteFaviconProvider( {
			supportsCachedFavicons: true,
			getExtensionUrl: vi.fn( () => extensionUrl ),
		} );

		expect( provider.getSource( 'x.com' ) ).toBeNull();
	} );
} );
