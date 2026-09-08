import type { InterruptionDocumentPath } from '../../utils/interruption-document-url/types';

/**
 * Browser tab fields required to match a live extension document.
 * @since 0.1.0 Initial implementation.
 */
export interface ExtensionTabContextTab {
	/** Browser-assigned identifier of one queried tab. */
	id?: number | undefined;
	/** Privacy state explicitly reported for the queried tab. */
	incognito?: boolean | undefined;
	/** Pending top-level navigation visible to the extension. */
	pendingUrl?: string | undefined;
	/** Current top-level URL visible to the extension. */
	url?: string | undefined;
}

/**
 * Live extension document metadata reported by the browser runtime.
 * @since 0.1.0 Initial implementation.
 */
export interface ExtensionTabContext {
	/** Browser context category containing the document. */
	contextType: string;
	/** Exact document URL when the context owns a document. */
	documentUrl?: string | undefined;
	/** Browser frame identifier, with zero identifying the top-level frame. */
	frameId: number;
	/** Privacy state of the document's browser context. */
	incognito: boolean;
	/** Browser tab identifier, or a negative identifier outside a tab. */
	tabId: number;
}

/**
 * Runtime filter restricted to extension documents hosted in tabs.
 * @since 0.1.0 Initial implementation.
 */
export interface ExtensionTabContextFilter {
	/** Extension document category required by the lookup. */
	contextTypes: [ 'TAB' ];
}

/**
 * Optional browser-runtime operations for identifying extension interruption tabs.
 * @since 0.1.0 Initial implementation.
 */
export interface ExtensionTabContextRuntime {
	/**
	 * Queries live extension documents when the browser supports context lookup.
	 * @param filter - Extension tab context filter.
	 * @return Current matching extension documents.
	 * @since 0.1.0 Initial implementation.
	 */
	getContexts?: ( filter: ExtensionTabContextFilter ) => Promise<ReadonlyArray<ExtensionTabContext>>;

	/**
	 * Resolves the packaged interruption document within this extension.
	 * @param path - Packaged interruption document path.
	 * @return Exact extension-owned interruption URL.
	 * @since 0.1.0 Initial implementation.
	 */
	getURL: ( path: InterruptionDocumentPath ) => string;
}
