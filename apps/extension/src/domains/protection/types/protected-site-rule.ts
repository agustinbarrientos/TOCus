import { z } from 'zod';
import { ProtectionScopeIdSchema } from './protection-value';

const CANONICAL_DNS_LABEL_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/u;
const CANONICAL_IPV4_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;

/**
 * Checks whether a host is already in canonical ASCII form.
 * @param value - Candidate canonical host.
 * @return Whether URL parsing preserves the host and every DNS label is valid.
 * @since 0.1.0 Initial implementation.
 */
function isCanonicalHost( value: string ): boolean {
	if ( value.endsWith( '.' ) ) {
		return false;
	}

	try {
		const parsedUrl = new URL( `https://${ value }` );

		if ( parsedUrl.hostname !== value ) {
			return false;
		}
	} catch {
		return false;
	}

	if ( value.startsWith( '[' ) ) {
		return value.endsWith( ']' ) && ! value.includes( '%' );
	}

	return value.split( '.' ).every( ( label ) => CANONICAL_DNS_LABEL_PATTERN.test( label ) );
}

/**
 * Checks whether a canonical host requires exact matching.
 * @param host - Canonical stored host.
 * @return Whether descendants must remain distinct from the stored host.
 * @since 0.1.0 Initial implementation.
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
 * Validates a canonical ASCII host.
 * @since 0.1.0 Initial implementation.
 */
export const CanonicalHostSchema = z.string().min( 1 ).max( 253 ).refine( isCanonicalHost );

/**
 * Canonical ASCII host.
 * @since 0.1.0 Initial implementation.
 */
export type CanonicalHost = z.infer<typeof CanonicalHostSchema>;

/**
 * Validates one canonical protected-site rule.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectedSiteRuleSchema = z.object( {
	host: CanonicalHostSchema,
	includeSubdomains: z.boolean(),
	scopeId: ProtectionScopeIdSchema,
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
 * @since 0.1.0 Initial implementation.
 */
export type ProtectedSiteRule = z.infer<typeof ProtectedSiteRuleSchema>;

/**
 * Validates canonical protected-site rules and rejects overlapping match ranges.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectedSiteRuleSetSchema = z.array( ProtectedSiteRuleSchema ).superRefine( ( rules, context ) => {
	for ( const [ index, rule ] of rules.entries() ) {
		for ( const existingRule of rules.slice( 0, index ) ) {
			if (
				rule.host === existingRule.host ||
				( rule.includeSubdomains && existingRule.host.endsWith( `.${ rule.host }` ) ) ||
				( existingRule.includeSubdomains && rule.host.endsWith( `.${ existingRule.host }` ) )
			) {
				context.addIssue( {
					code: 'custom',
					message: 'Protected-site rule match ranges must not overlap.',
					path: [ index, 'host' ],
				} );
			}
		}
	}
} );

/**
 * Canonical protected-site rules with non-overlapping host ownership.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectedSiteRuleSet = z.infer<typeof ProtectedSiteRuleSetSchema>;
