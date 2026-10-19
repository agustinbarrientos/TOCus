import { describe, expect, it } from 'vitest';
import { isMatchingBrowserDocumentUrl } from './index';

describe( 'isMatchingBrowserDocumentUrl', () => {
	it.each( [
		[ 'https://example.test/article', 'https://example.test/article' ],
		[ 'https://example.test/article#', 'https://example.test/article#:~:text=Example%20highlight' ],
		[ 'https://example.test/article#section-2', 'https://example.test/article#section-2:~:text=Example' ],
		[ 'https://example.test/article?value=:~:query#', 'https://example.test/article?value=:~:query#:~:text=Example' ],
		[ 'chrome-extension://extension-id/pause.html#destination=https://example.test/article#',
			'chrome-extension://extension-id/pause.html#destination=https://example.test/article#:~:text=Example' ],
	] )( 'matches the document URL %s to its complete browser URL %s', ( documentUrl, browserUrl ) => {
		expect( isMatchingBrowserDocumentUrl( documentUrl, browserUrl ) ).toBe( true );
	} );

	it.each( [
		[ 'https://example.test/article#', 'https://other.test/article#:~:text=Example' ],
		[ 'http://example.test/article#', 'https://example.test/article#:~:text=Example' ],
		[ 'https://example.test/article#', 'https://example.test/other#:~:text=Example' ],
		[ 'https://example.test/article?value=1#', 'https://example.test/article?value=2#:~:text=Example' ],
		[ 'https://example.test/article#section-2', 'https://example.test/article#section-3:~:text=Example' ],
		[ 'https://example.test/article#:~:text=First', 'https://example.test/article#:~:text=Second' ],
		[ 'https://example.test/article#:~:text=Example', 'https://example.test/article#' ],
		[ 'https://example.test/article', 'https://example.test/other' ],
		[ 'https://example.test/article#', 'https://example.test/article#section-2' ],
		[ 'https://example.test/', 'https://example.test/:~:text=Example' ],
		[ 'https://example.test/article?value=', 'https://example.test/article?value=:~:text=Example' ],
		[ 'https://example.test/article#', 'https://example.test/article#%3A~%3Atext=Example' ],
	] )( 'rejects a changed document or an unstripped directive: %s vs %s', ( documentUrl, browserUrl ) => {
		expect( isMatchingBrowserDocumentUrl( documentUrl, browserUrl ) ).toBe( false );
	} );
} );
