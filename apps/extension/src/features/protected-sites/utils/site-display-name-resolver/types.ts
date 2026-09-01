import { z } from 'zod';
import {
	ProtectedSiteDisplayNameInputSchema,
	ProtectedSiteDisplayNameSchema,
} from '../../../../domains/protection/types/protected-site-configuration';
import {
	CanonicalHostSchema,
	ProtectedSiteRuleSchema,
} from '../../../../domains/protection/types/protected-site-rule';

/**
 * Validates one local site display-name resolution request against its complete protection rule.
 * @since 0.1.0 Initial implementation.
 */
export const SiteDisplayNameResolutionInputSchema = z.object( {
	identityHost: CanonicalHostSchema,
	rule: ProtectedSiteRuleSchema,
	displayNameOverride: ProtectedSiteDisplayNameInputSchema.optional(),
} ).strict().superRefine( ( input, context ) => {
	const isRuleHost = input.identityHost === input.rule.host;
	const isRuleDescendant = input.rule.includeSubdomains && input.identityHost.endsWith( `.${ input.rule.host }` );

	if ( ! isRuleHost && ! isRuleDescendant ) {
		context.addIssue( {
			code: 'custom',
			message: 'Site identity host must belong to its protection boundary.',
			path: [ 'identityHost' ],
		} );
	}
} );

/**
 * Local site display-name resolution request with its complete protection rule.
 * @since 0.1.0 Initial implementation.
 */
export type SiteDisplayNameResolutionInput = z.infer<typeof SiteDisplayNameResolutionInputSchema>;

/**
 * Validates one resolved local site identity.
 * @since 0.1.0 Initial implementation.
 */
export const SiteDisplayIdentitySchema = z.object( {
	name: ProtectedSiteDisplayNameSchema,
	monogram: z.string().min( 1 ).max( 2 ),
	colorIndex: z.number().int().min( 0 ).max( 5 ),
} ).strict();

/**
 * Resolved local site identity for protected-site presentation.
 * @since 0.1.0 Initial implementation.
 */
export type SiteDisplayIdentity = z.infer<typeof SiteDisplayIdentitySchema>;
