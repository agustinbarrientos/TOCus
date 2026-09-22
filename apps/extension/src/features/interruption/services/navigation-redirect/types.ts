/**
 * Request that asks the background runtime to resolve the sender's navigation carrier.
 * @since 0.1.0 Initial implementation.
 */
export interface NavigationRedirectRequest {
	/** Dedicated pre-bootstrap request discriminator. */
	type: 'resolve-navigation-redirect';
}

/**
 * Browser runtime boundary used before interruption-page authentication.
 * @since 0.1.0 Initial implementation.
 */
export interface NavigationRedirectRuntime {
	/** Resolves one packaged extension path. */
	getURL: ( path: '/pause.html' ) => string;
	/** Sends one navigation-resolution request to the background runtime. */
	sendMessage: ( message: NavigationRedirectRequest ) => Promise<unknown>;
}

/**
 * Narrow location boundary used to replace carrier history in place.
 * @since 0.1.0 Initial implementation.
 */
export interface NavigationRedirectLocation {
	/** Exact current document URL. */
	readonly href: string;
	/** Replaces the current history entry. */
	replace: ( url: string ) => void;
}

/**
 * Dependencies for the pre-bootstrap navigation redirect handshake.
 * @since 0.1.0 Initial implementation.
 */
export interface NavigationRedirectOptions {
	/** Current document location. */
	location: NavigationRedirectLocation;
	/** Extension runtime messaging and URL resolution. */
	runtime: NavigationRedirectRuntime;
}
