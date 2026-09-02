import { describe, expect, it } from 'vitest';
import { createSiteFaviconProvider } from './index';

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
