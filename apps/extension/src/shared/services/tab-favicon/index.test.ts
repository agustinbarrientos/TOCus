import { afterEach, describe, expect, test, vi } from 'vitest';

/**
 * Browser appearance source whose changes can be dispatched synchronously.
 */
class AppearancePreference extends EventTarget {
	/** Whether the browser requests a dark appearance. */
	matches = false;
}

afterEach( () => {
	vi.unstubAllGlobals();
	vi.resetModules();
} );

describe( 'tab favicon', () => {
	test.each( [ false, true ] )( 'follows browser appearance from an initial dark preference of %s', async ( dark ) => {
		const preference = new AppearancePreference();
		const favicon = { href: '/icons/tab-light.png' };
		preference.matches = dark;
		vi.stubGlobal( 'document', {
			/**
			 * Supplies the document-owned favicon element.
			 * @param selector - Element selector requested by the bootstrap.
			 * @return Favicon element for the required icon selector.
			 */
			querySelector: ( selector: string ) => selector === 'link[rel="icon"]' ? favicon : null,
		} );
		vi.stubGlobal( 'window', {
			/**
			 * Supplies the browser appearance query.
			 * @param query - Requested browser preference query.
			 * @return Browser appearance preference.
			 */
			matchMedia: ( query: string ) => {
				expect( query ).toBe( '(prefers-color-scheme: dark)' );
				return preference;
			},
		} );

		await import( './index.ts' );
		expect( favicon.href ).toBe( dark ? '/icons/tab-light.png' : '/icons/tab-dark.png' );

		preference.matches = ! dark;
		preference.dispatchEvent( new Event( 'change' ) );
		expect( favicon.href ).toBe( dark ? '/icons/tab-dark.png' : '/icons/tab-light.png' );

		preference.matches = dark;
		preference.dispatchEvent( new Event( 'change' ) );
		expect( favicon.href ).toBe( dark ? '/icons/tab-light.png' : '/icons/tab-dark.png' );
	} );

	test( 'leaves documents without an explicit tab favicon alone', async () => {
		vi.stubGlobal( 'document', { querySelector: vi.fn().mockReturnValue( null ) } );
		await expect( import( './index.ts' ) ).resolves.toBeDefined();
	} );
} );
