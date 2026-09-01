import { z } from 'zod';
import { type ProtectedSiteDisplayName } from '../../../../domains/protection/types/protected-site-configuration';
import { type CanonicalHost } from '../../../../domains/protection/types/protected-site-rule';

/**
 * Validates a catalog display name without silently trimming authored data.
 * @since 0.1.0 Initial implementation.
 */
export const SiteDisplayNameCatalogNameSchema = z.string()
	.min( 1 )
	.max( 80 )
	.refine( ( name ) => name === name.trim() );

/**
 * Validates one grouped display-name catalog entry before domain-pattern compilation.
 * @since 0.1.0 Initial implementation.
 */
export const SiteDisplayNameCatalogGroupSchema = z.object( {
	name: SiteDisplayNameCatalogNameSchema,
	domains: z.array( z.string().min( 1 ) ).min( 1 ),
} ).strict();

/**
 * Grouped display-name catalog entry.
 * @since 0.1.0 Initial implementation.
 */
export type SiteDisplayNameCatalogGroup = z.infer<typeof SiteDisplayNameCatalogGroupSchema>;

/**
 * Validates a nonempty grouped display-name catalog source.
 * @since 0.1.0 Initial implementation.
 */
export const SiteDisplayNameCatalogSourceSchema = z.array( SiteDisplayNameCatalogGroupSchema ).min( 1 );

/**
 * Nonempty grouped display-name catalog source.
 * @since 0.1.0 Initial implementation.
 */
export type SiteDisplayNameCatalogSource = z.infer<typeof SiteDisplayNameCatalogSourceSchema>;

/**
 * Compiled exact or wildcard catalog pattern.
 * @since 0.1.0 Initial implementation.
 */
export interface SiteDisplayNameCatalogPattern {
	host: CanonicalHost;
	isWildcard: boolean;
}

/**
 * Compiled local site display-name catalog operations.
 * @since 0.1.0 Initial implementation.
 */
export interface SiteDisplayNameCatalog {
	/**
	 * Resolves an exact or wildcard catalog name.
	 * @param host - Exact normalized site identity host.
	 * @return Catalog name, or undefined when no entry matches.
	 * @since 0.1.0 Initial implementation.
	 */
	resolve( host: CanonicalHost ): ProtectedSiteDisplayName | undefined;
}
