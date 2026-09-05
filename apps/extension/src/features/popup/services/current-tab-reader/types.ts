import { type PopupCurrentTabContext } from '../../types/current-tab-context';

/**
 * Browser tab fields inspected by the popup after an activeTab grant.
 * @since 0.1.0 Initial implementation.
 */
export interface CurrentTabReaderBrowserTab {
	/** Browser-assigned tab identifier. */
	id?: number | undefined;
	/** Whether the tab belongs to a private browsing context. */
	incognito?: boolean | undefined;
	/** Destination currently loading in the tab. */
	pendingUrl?: string | undefined;
	/** Current top-level tab URL. */
	url?: string | undefined;
}

/**
 * Exact active-tab lookup used by one popup invocation.
 * @since 0.1.0 Initial implementation.
 */
export interface CurrentTabReaderQuery {
	/** Limits the result to the active tab. */
	active: true;
	/** Limits the result to the window that owns the popup. */
	currentWindow: true;
}

/**
 * Active-tab lookup used by the popup.
 * @since 0.1.0 Initial implementation.
 */
export interface CurrentTabReaderTabsApi {
	/**
	 * Queries browser tabs visible to the current popup invocation.
	 * @param query - Active-tab and current-window filters.
	 * @return Matching browser tabs.
	 * @since 0.1.0 Initial implementation.
	 */
	query( query: CurrentTabReaderQuery ): Promise<ReadonlyArray<CurrentTabReaderBrowserTab>>;
}

/**
 * Browser surface used by the current-tab reader.
 * @since 0.1.0 Initial implementation.
 */
export interface CurrentTabReaderBrowser {
	/** Tab lookup granted by the user opening the popup. */
	tabs: CurrentTabReaderTabsApi;
}

/**
 * Ephemeral current-tab reader.
 * @since 0.1.0 Initial implementation.
 */
export interface CurrentTabReader {
	/**
	 * Reads minimal active-tab metadata without retaining title or favicon data.
	 * @return Valid current-tab context or null when unavailable.
	 * @since 0.1.0 Initial implementation.
	 */
	read(): Promise<PopupCurrentTabContext | null>;
}
