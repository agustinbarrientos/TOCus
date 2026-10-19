/**
 * Matches a document-visible URL to the complete URL retained by the browser.
 * Browsers hide fragment directives from documents while retaining them in tab metadata.
 * @param documentUrl - URL exposed to the sending document.
 * @param browserUrl - Complete URL supplied by the browser.
 * @return Whether the URLs are identical or differ only by a hidden fragment directive.
 * @since 1.1.0 Preserve browser-owned text fragments during navigation handshakes.
 */
export function isMatchingBrowserDocumentUrl( documentUrl: string, browserUrl: string ): boolean {
	if ( documentUrl === browserUrl ) {
		return true;
	}

	const fragmentStart = browserUrl.indexOf( '#' );
	const directiveStart = fragmentStart < 0 ? -1 : browserUrl.indexOf( ':~:', fragmentStart );

	return directiveStart >= 0 && documentUrl === browserUrl.slice( 0, directiveStart );
}
