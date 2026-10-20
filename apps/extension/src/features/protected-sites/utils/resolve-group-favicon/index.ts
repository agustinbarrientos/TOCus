import type { SiteFaviconProvider, SiteFaviconSource } from '../../services/site-favicon-provider';

/**
 * Orders the shared website identity before stable, unique configured member identities.
 * @param groupHost - Canonical group host or the standalone item's existing identity.
 * @param identityHosts - Configured member identities whose cached icons remain eligible.
 * @return Stable cache candidates independent of member order or duplicate paths.
 * @since 1.1.0
 */
export function getGroupFaviconHosts( groupHost: string, identityHosts: Iterable<string> ): string[] {
	return [ groupHost, ...[ ...new Set( identityHosts ) ].filter( ( host ) => host !== groupHost ).sort() ];
}

/**
 * Reuses the first available browser-cached group or member icon without visiting a website.
 * @param provider - Existing cache-only favicon provider, or unavailable browser capability.
 * @param hosts - Canonical group-first configured identity candidates.
 * @return First non-placeholder cached icon, or the ordinary local monogram fallback.
 * @since 1.1.0
 */
export async function resolveGroupFavicon(
	provider: SiteFaviconProvider | null | undefined,
	hosts: ReadonlyArray<string>,
): Promise<SiteFaviconSource> {
	if ( ! provider ) {
		return null;
	}
	for ( const host of hosts ) {
		try {
			const source = provider.resolveSource === undefined ? provider.getSource( host )
				: await provider.resolveSource( host );
			if ( source !== null ) {
				return source;
			}
		} catch {
			// A failed local read must not discard a different member's cached icon.
		}
	}
	return null;
}
