import { CanonicalHostSchema } from '../../../../domains/protection/types/protected-site-rule';
import { parse } from 'tldts';
import {
	SiteFaviconSourceSchema,
	type SiteFaviconProvider,
	type SiteFaviconProviderOptions,
	type SiteFaviconSource,
} from './types';

const CACHED_FAVICON_PATH = '/_favicon/';
const CACHED_FAVICON_SIZE = 32;
const PNG_SIGNATURE = [ 137, 80, 78, 71, 13, 10, 26, 10 ];

/**
 * Rejects empty or non-PNG local responses before comparing native cache images.
 * @param image - Browser-local image bytes or an unavailable response.
 * @return Whether a complete PNG header is present.
 */
function isPng( image: Uint8Array | null ): image is Uint8Array {
	return image !== null && image.length >= 33 &&
		PNG_SIGNATURE.every( ( byte, index ) => image[ index ] === byte );
}

/**
 * Reads only the provider's validated extension-origin cache resources.
 * @param source - Extension-local favicon resource.
 * @return Native PNG bytes, or null for an unsuccessful or non-image response.
 */
async function readLocalImage( source: string ): Promise<Uint8Array | null> {
	const response = await fetch( source, { redirect: 'error' } );
	const contentType = response.headers.get( 'Content-Type' );
	// Chromium can omit this header for native favicons; readImage still validates the PNG bytes.
	if ( ! response.ok || ( contentType !== null && ! contentType.startsWith( 'image/png' ) ) ) {
		return null;
	}
	return new Uint8Array( await response.arrayBuffer() );
}

/**
 * Creates a provider for browser-cached favicons with a local-only fallback.
 * @param options - Browser capability and extension URL dependency.
 * @return Cached-favicon provider without network access.
 * @since 1.0.0 Initial implementation.
 */
export function createSiteFaviconProvider(
	options: SiteFaviconProviderOptions,
): SiteFaviconProvider {
	const inFlight = new Map<string, Promise<SiteFaviconSource>>();
	/**
	 * Converts a failed local read into the ordinary monogram fallback.
	 * @param source - Provider-created local resource to read.
	 * @return Valid local PNG bytes or null.
	 */
	async function readImage( source: string ): Promise<Uint8Array | null> {
		try {
			const image = await ( options.readLocalImage ?? readLocalImage )( source );
			return isPng( image ) ? image : null;
		} catch {
			return null;
		}
	}
	/**
	 * Creates an extension-local cached favicon source for one exact identity host.
	 * @param input - Unknown canonical identity host input.
	 * @return Extension-local source or null when cached favicons are unavailable.
	 * @since 1.0.0 Initial implementation.
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

	/**
	 * Checks exact-host variants before the equivalent registrable apex or www host.
	 * @param host - Validated configured identity host.
	 * @param source - Validated extension-local cache URL.
	 * @return First non-placeholder cached icon without visiting any website.
	 */
	async function resolveVariants( host: string, source: string ): Promise<SiteFaviconSource> {
		const url = new URL( source );
		url.searchParams.set( 'pageUrl', 'about:blank' );
		const defaultImage = await readImage( url.href );
		if ( defaultImage === null ) {
			return null;
		}
		const details = parse( host, { allowPrivateDomains: true } );
		const domain = details.isIcann || details.isPrivate ? details.domain : null;
		const alternate = host === domain ? `www.${ host }` :
			domain !== null && host === `www.${ domain }` ? domain : null;
		const hosts = alternate === null ? [ host ] : [ host, alternate ];
		for ( const candidate of hosts ) {
			for ( const scheme of [ 'https:', 'http:' ] ) {
				url.searchParams.set( 'pageUrl', `${ scheme }//${ candidate }/` );
				const image = await readImage( url.href );
				if ( image !== null && ( image.length !== defaultImage.length ||
					image.some( ( byte, index ) => byte !== defaultImage[ index ] ) ) ) {
					return SiteFaviconSourceSchema.parse( url.href );
				}
			}
		}
		return null;
	}
	/**
	 * Shares concurrent local lookups, retaining no results after the lookup finishes.
	 * @param input - Unknown canonical identity host input.
	 * @return Available cached variant or the ordinary local fallback.
	 * @since 1.1.0
	 */
	function resolveSource( input: unknown ): Promise<SiteFaviconSource> {
		const identity = CanonicalHostSchema.safeParse( input );
		if ( ! identity.success ) {
			return Promise.resolve( null );
		}
		const source = getSource( identity.data );
		if ( source === null ) {
			return Promise.resolve( null );
		}
		const pending = inFlight.get( identity.data );
		if ( pending !== undefined ) {
			return pending;
		}
		const lookup = resolveVariants( identity.data, source ).finally( () => inFlight.delete( identity.data ) );
		inFlight.set( identity.data, lookup );
		return lookup;
	}
	return { getSource, resolveSource };
}

export * from './types';
