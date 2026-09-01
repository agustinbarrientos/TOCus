import { parse } from 'tldts';
import { type ProtectedSiteDisplayName } from '../../../../domains/protection/types/protected-site-configuration';
import {
	CanonicalHostSchema,
	type CanonicalHost,
} from '../../../../domains/protection/types/protected-site-rule';
import {
	SiteDisplayNameCatalogSourceSchema,
	type SiteDisplayNameCatalog,
	type SiteDisplayNameCatalogPattern,
} from './types';

const WILDCARD_PREFIX = '*.';

/**
 * Parses and validates one exact or descendant-only catalog domain pattern.
 * @param domainPattern - Authored exact host or leading-wildcard pattern.
 * @return Canonical host and wildcard mode.
 * @throws {Error} When the pattern is noncanonical or the wildcard base is unsafe.
 * @since 0.1.0 Initial implementation.
 */
function parseDomainPattern( domainPattern: string ): SiteDisplayNameCatalogPattern {
	const isWildcard = domainPattern.startsWith( WILDCARD_PREFIX );
	const hostInput = isWildcard ? domainPattern.slice( WILDCARD_PREFIX.length ) : domainPattern;

	if ( hostInput.includes( '*' ) ) {
		throw new Error( 'Catalog wildcards must use one leading wildcard label.' );
	}

	const host = CanonicalHostSchema.parse( hostInput );

	if ( isWildcard ) {
		const hostDetails = parse( host, {
			allowPrivateDomains: true,
			extractHostname: false,
		} );

		if ( hostDetails.isIp || hostDetails.domain === null ) {
			throw new Error( 'Catalog wildcard bases must be registrable domain hosts.' );
		}
	}

	return { host, isWildcard };
}

/**
 * Compiles a local display-name catalog into immutable lookup operations.
 * @param input - Unknown grouped catalog source.
 * @return Compiled exact and wildcard lookup operations.
 * @since 0.1.0 Initial implementation.
 */
export function compileSiteDisplayNameCatalog( input: unknown ): SiteDisplayNameCatalog {
	const source = SiteDisplayNameCatalogSourceSchema.parse( input );
	const exactNames = new Map<CanonicalHost, ProtectedSiteDisplayName>();
	const wildcardNames = new Map<CanonicalHost, ProtectedSiteDisplayName>();
	const names = new Set<ProtectedSiteDisplayName>();
	const domainPatterns = new Set<string>();

	for ( const group of source ) {
		if ( names.has( group.name ) ) {
			throw new Error( 'Catalog aliases with the same name must share one group.' );
		}

		names.add( group.name );

		for ( const domainPattern of group.domains ) {
			if ( domainPatterns.has( domainPattern ) ) {
				throw new Error( 'Catalog domain patterns must be unique.' );
			}

			domainPatterns.add( domainPattern );

			const pattern = parseDomainPattern( domainPattern );
			const destination = pattern.isWildcard ? wildcardNames : exactNames;
			destination.set( pattern.host, group.name );
		}
	}

	/**
	 * Resolves a site display name using exact and most-specific wildcard precedence.
	 * @param host - Exact normalized site identity host.
	 * @return Matching display name, or undefined when the catalog has no entry.
	 * @since 0.1.0 Initial implementation.
	 */
	function resolve( host: CanonicalHost ): ProtectedSiteDisplayName | undefined {
		const canonicalHost = CanonicalHostSchema.parse( host );
		const exactName = exactNames.get( canonicalHost );

		if ( exactName !== undefined ) {
			return exactName;
		}

		let suffixStart = canonicalHost.indexOf( '.' );

		while ( suffixStart >= 0 ) {
			const parentHost = canonicalHost.slice( suffixStart + 1 );
			const wildcardName = wildcardNames.get( parentHost );

			if ( wildcardName !== undefined ) {
				return wildcardName;
			}

			suffixStart = canonicalHost.indexOf( '.', suffixStart + 1 );
		}

		return undefined;
	}

	return { resolve };
}

export * from './types';
