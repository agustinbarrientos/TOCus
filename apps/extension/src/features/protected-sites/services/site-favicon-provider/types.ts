import { z } from 'zod';

/**
 * Creates an extension URL for one packaged or browser-provided path.
 * @since 0.1.0 Initial implementation.
 */
export type ExtensionUrlFactory = ( path: string ) => string;

/**
 * Cached-favicon provider dependencies.
 * @since 0.1.0 Initial implementation.
 */
export interface SiteFaviconProviderOptions {
	supportsCachedFavicons: boolean;
	getExtensionUrl: ExtensionUrlFactory;
}

/**
 * Validates a Chrome extension-local favicon source or a local fallback request.
 * @since 0.1.0 Initial implementation.
 */
export const SiteFaviconSourceSchema = z.union( [
	z.url( { protocol: /^chrome-extension$/ } ),
	z.null(),
] );

/**
 * Chrome extension-local favicon source or null when the monogram must be used.
 * @since 0.1.0 Initial implementation.
 */
export type SiteFaviconSource = z.infer<typeof SiteFaviconSourceSchema>;

/**
 * Browser-capability-aware cached-favicon provider.
 * @since 0.1.0 Initial implementation.
 */
export interface SiteFaviconProvider {
	/**
	 * Returns a cached Chrome favicon source for one exact identity host.
	 * @param identityHost - Unknown canonical identity host input.
	 * @return Extension-local source or null when the local monogram must be used.
	 * @since 0.1.0 Initial implementation.
	 */
	getSource( identityHost: unknown ): SiteFaviconSource;
}
