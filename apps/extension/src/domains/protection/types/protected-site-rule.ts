import { z } from 'zod';
import { ProtectionScopeIdSchema } from './protection-value';
import { CanonicalHostSchema } from './canonical-host';

const CANONICAL_IPV4_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;

/**
 * Checks whether a canonical host requires exact matching.
 * @param host - Canonical stored host.
 * @return Whether descendants must remain distinct from the stored host.
 * @since 1.0.0 Initial implementation.
 */
function requiresExactMatching( host: string ): boolean {
	return (
		host.startsWith( '[' ) ||
		CANONICAL_IPV4_PATTERN.test( host ) ||
		! host.includes( '.' ) ||
		host === 'localhost' ||
		host.endsWith( '.localhost' )
	);
}

/**
 * Validates a canonical case-sensitive path prefix without a trailing separator.
 * Encoded separators remain encoded and query strings never belong to a target.
 * @since 1.1.0
 */
export const ProtectedSitePathPrefixSchema = z.string().min( 1 ).refine( ( value ) => {
	if ( ! value.startsWith( '/' ) || value.endsWith( '/' ) || /[\\?#\s]|[^\x21-\x7e]|%(?![0-9a-fA-F]{2})/u.test( value ) ) {
		return false;
	}
	return new URL( `https://target.invalid${ value }` ).pathname === value;
} );

/**
 * Validates one canonical protected-site rule.
 * @since 1.0.0 Initial implementation.
 */
export const ProtectedSiteRuleSchema = z.object( {
	host: CanonicalHostSchema,
	includeSubdomains: z.boolean(),
	scopeId: ProtectionScopeIdSchema,
	pathPrefix: ProtectedSitePathPrefixSchema.optional(),
	behavior: z.enum( [ 'pause', 'allow' ] ).optional(),
} ).strict().superRefine( ( rule, context ) => {
	if ( rule.includeSubdomains && requiresExactMatching( rule.host ) ) {
		context.addIssue( {
			code: 'custom',
			message: 'This protected-site host must match exactly.',
			path: [ 'includeSubdomains' ],
		} );
	}
} );

/**
 * Canonical protected-site rule owned by one protection scope.
 * @since 1.0.0 Initial implementation.
 */
export type ProtectedSiteRule = z.infer<typeof ProtectedSiteRuleSchema>;

/**
 * Validates canonical protected-site rules and rejects duplicate canonical match ranges.
 * @since 1.0.0 Initial implementation.
 */
export const ProtectedSiteRuleSetSchema = z.array( ProtectedSiteRuleSchema ).superRefine( ( rules, context ) => {
	for ( const [ index, rule ] of rules.entries() ) {
		for ( const existingRule of rules.slice( 0, index ) ) {
			if (
				rule.host === existingRule.host &&
				rule.includeSubdomains === existingRule.includeSubdomains &&
				rule.pathPrefix === existingRule.pathPrefix
			) {
				context.addIssue( {
					code: 'custom',
					message: 'Protected-site targets must be distinct.',
					path: [ index, 'host' ],
				} );
			}
		}
	}
} );

/**
 * Canonical protected-site rules with distinct canonical target ownership.
 * @since 1.0.0 Initial implementation.
 */
export type ProtectedSiteRuleSet = z.infer<typeof ProtectedSiteRuleSetSchema>;

export { CanonicalHostSchema, type CanonicalHost } from './canonical-host';
