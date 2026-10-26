/**
 * Request that asks the background runtime to resolve the sender's navigation carrier.
 * @since 1.0.0 Initial implementation.
 */
export interface NavigationRedirectRequest {
	/** Dedicated pre-bootstrap request discriminator. */
	type: 'resolve-navigation-redirect';
}

/**
 * Browser runtime boundary used before interruption-page authentication.
 * @since 1.0.0 Initial implementation.
 */
export interface NavigationRedirectRuntime {
	/** Resolves one packaged extension path. */
	getURL: ( path: '/pause.html' ) => string;
	/** Sends one navigation-resolution request to the background runtime. */
	sendMessage: ( message: NavigationRedirectRequest ) => Promise<unknown>;
}

/**
 * Narrow location boundary used to replace carrier history in place.
 * @since 1.0.0 Initial implementation.
 */
export interface NavigationRedirectLocation {
	/** Exact current document URL. */
	readonly href: string;
	/** Replaces the current history entry. */
	replace: ( url: string ) => void;
	/** Reloads the current history URL while retaining its state. */
	reload: () => void;
}

/**
 * Validated state retained by an owned canonical pause history entry.
 * @since 1.1.0
 */
export interface NavigationRedirectRetainedHistory {
	/** Original protected HTTP(S) destination awaiting policy revalidation. */
	destination: string;
	/** Whether the next canonical reload follows an authorized carrier resolution. */
	pendingBootstrap: boolean;
}

/**
 * Earlier navigation timing value used when modern entries are unavailable.
 * @since 1.1.0
 */
export interface NavigationRedirectLegacyTiming {
	/** Zero for navigation, one for reload, or two for history traversal. */
	type: number;
}

/**
 * Optional modern and legacy browser timing used to identify a canonical reload.
 * @since 1.1.0
 */
export interface NavigationRedirectTiming {
	/** Modern navigation timing entries, when available. */
	getEntriesByType?: ( type: string ) => ReadonlyArray<PerformanceEntry>;
	/** Earlier navigation timing fallback for browsers without a modern entry. */
	navigation?: NavigationRedirectLegacyTiming;
}

/**
 * Browser-history state used to recover a pause without adding or skipping entries.
 * @since 1.1.0
 */
export interface NavigationRedirectHistory {
	/** Untrusted state retained by the current session-history entry. */
	readonly state: unknown;
	/** Updates the current history entry without navigating or changing adjacent entries. */
	replaceState: ( state: unknown, unused: string, url: string ) => void;
}

/**
 * Dependencies for the pre-bootstrap navigation redirect handshake.
 * @since 1.0.0 Initial implementation.
 */
export interface NavigationRedirectOptions {
	/** Current history entry and same-document replacement boundary. */
	history: NavigationRedirectHistory;
	/** Whether an unavailable canonical pause may replay its retained carrier for fresh authorization. */
	recoverRetainedHistory?: boolean;
	/** Browser navigation kind used to distinguish the authorized reload from a later history visit. */
	navigationType?: string | undefined;
	/** Current document location. */
	location: NavigationRedirectLocation;
	/** Extension runtime messaging and URL resolution. */
	runtime: NavigationRedirectRuntime;
}
