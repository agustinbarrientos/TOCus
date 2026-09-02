import { CanonicalHostSchema } from '../../../../domains/protection/types/protected-site-rule';
import {
	SiteFaviconSourceSchema,
	type SiteFaviconProvider,
	type SiteFaviconProviderOptions,
	type SiteFaviconSource,
} from './types';

const CACHED_FAVICON_PATH = '/_favicon/';
const CACHED_FAVICON_SIZE = 32;

/**
 * Creates a provider for browser-cached favicons with a local-only fallback.
 * @param options - Browser capability and extension URL dependency.
 * @return Cached-favicon provider without network access.
 * @since 0.1.0 Initial implementation.
 */
export function createSiteFaviconProvider(
	options: SiteFaviconProviderOptions,
): SiteFaviconProvider {
	/**
	 * Creates an extension-local cached favicon source for one exact identity host.
	 * @param input - Unknown canonical identity host input.
	 * @return Extension-local source or null when cached favicons are unavailable.
	 * @since 0.1.0 Initial implementation.
	 */
	function getSource( input: unknown ): SiteFaviconSource {
		const identityHost = CanonicalHostSchema.parse( input );

		if ( ! options.supportsCachedFavicons ) {
			return null;
		}

		let faviconUrl: URL;

		try {
			faviconUrl = new URL( CACHED_FAVICON_PATH, options.extensionRootUrl );
		} catch {
			return null;
		}

		if ( faviconUrl.protocol !== 'chrome-extension:' ) {
			return null;
		}

		faviconUrl.searchParams.set( 'pageUrl', new URL( `https://${ identityHost }/` ).href );
		faviconUrl.searchParams.set( 'size', String( CACHED_FAVICON_SIZE ) );

		return SiteFaviconSourceSchema.parse( faviconUrl.href );
	}

	return { getSource };
}

export * from './types';
