import { parse } from 'tldts';
import { CanonicalHostSchema } from '../../../../domains/protection/types/protected-site-rule';
import { getProtectedSiteGroupHost } from '../../../../domains/protection/utils/protected-site-rule-key';
import siteDisplayNameCatalogSource from '../site-display-name-catalog/catalog.json';
import { compileSiteDisplayNameCatalog } from '../site-display-name-catalog';
import productHostsSource from './product-hosts.json';
import {
	SiteDisplayIdentitySchema,
	SiteDisplayNameResolutionInputSchema,
	type SiteDisplayIdentity,
	type SiteDisplayNameResolutionInput,
} from './types';

const SITE_DISPLAY_NAME_CATALOG = compileSiteDisplayNameCatalog( siteDisplayNameCatalogSource );
const PRODUCT_HOSTS = new Set( productHostsSource.map( ( host ) => CanonicalHostSchema.parse( host ) ) );

/**
 * Finds the most specific curated product boundary containing a canonical host.
 * @param host - Exact canonical site identity host.
 * @return Exact product host, or undefined when no product boundary contains it.
 * @since 1.1.0
 */
function getProductHost( host: string ): string | undefined {
	let candidateHost = host;
	let separatorIndex = candidateHost.indexOf( '.' );

	while ( separatorIndex >= 0 ) {
		if ( PRODUCT_HOSTS.has( candidateHost ) ) {
			return candidateHost;
		}

		candidateHost = candidateHost.slice( separatorIndex + 1 );
		separatorIndex = candidateHost.indexOf( '.' );
	}

	return undefined;
}

/**
 * Groups one canonical host at its curated product boundary for website presentation.
 * @param host - Exact canonical site identity host without URL navigation details.
 * @return Most specific product host, or the ordinary protected-site group host.
 * @since 1.1.0
 */
export function getWebsitePresentationGroupHost( host: string ): string {
	return getProductHost( host ) ?? getProtectedSiteGroupHost( host );
}

/**
 * Converts one canonical site identity into a readable local fallback name.
 * @param identityHost - Exact canonical site identity.
 * @param protectionHost - Canonical protection boundary used for ordinary fallback names.
 * @return Readable fallback name derived without external metadata.
 * @since 1.0.0 Initial implementation.
 */
function deriveDisplayName( identityHost: string, protectionHost: string ): string {
	if ( identityHost.split( '.' ).some( ( label ) => label.startsWith( 'xn--' ) ) ) {
		return identityHost;
	}

	const details = parse( protectionHost, {
		allowPrivateDomains: true,
		extractHostname: false,
	} );

	if ( details.isIp ) {
		return protectionHost;
	}

	const firstHostLabel = protectionHost.replace( /\..*$/u, '' );
	const sourceLabel = details.domainWithoutSuffix ?? firstHostLabel;
	const readableLabel = sourceLabel.replace( /-+/gu, ' ' );

	return readableLabel.toLowerCase().replace( /^./u, ( firstCharacter ) => firstCharacter.toUpperCase() );
}

/**
 * Creates one Unicode-aware monogram from a resolved display name.
 * @param displayName - Resolved nonempty display name.
 * @return First letter or number in uppercase, or a neutral fallback mark.
 * @since 1.0.0 Initial implementation.
 */
function createMonogram( displayName: string ): string {
	for ( const character of displayName ) {
		if ( /[\p{L}\p{N}]/u.test( character ) ) {
			return Array.from( character.toUpperCase() ).slice( 0, 1 ).join( '' );
		}
	}

	return '?';
}

/**
 * Selects one stable local monogram color slot from a canonical host.
 * @param host - Canonical protected-site host.
 * @return Integer color slot from zero through five.
 * @since 1.0.0 Initial implementation.
 */
function selectColorIndex( host: string ): number {
	let hash = 2_166_136_261;

	for ( const character of host ) {
		hash ^= character.charCodeAt( 0 );
		hash = Math.imul( hash, 16_777_619 );
	}

	return ( hash >>> 0 ) % 6;
}

/**
 * Resolves a protected site's editable name and deterministic local monogram.
 * @param input - Exact identity host, complete protection rule, and optional editable display name.
 * @return Local site identity without page-title or network access.
 * @since 1.0.0 Initial implementation.
 */
export function resolveSiteDisplayIdentity(
	input: SiteDisplayNameResolutionInput,
): SiteDisplayIdentity {
	const parsedInput = SiteDisplayNameResolutionInputSchema.parse( input );
	const catalogHost = getProductHost( parsedInput.identityHost ) ?? parsedInput.identityHost;
	const catalogName = SITE_DISPLAY_NAME_CATALOG.resolve( catalogHost );
	const name = parsedInput.displayNameOverride || catalogName || deriveDisplayName(
		parsedInput.identityHost,
		parsedInput.rule.host,
	);

	return SiteDisplayIdentitySchema.parse( {
		name,
		monogram: createMonogram( name ),
		colorIndex: selectColorIndex( parsedInput.identityHost ),
	} );
}

export * from './types';
