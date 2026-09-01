import { z } from 'zod';
import {
	CanonicalHostSchema,
	ProtectedSiteRuleSchema,
	ProtectedSiteRuleSetSchema,
} from './protected-site-rule';

/**
 * Current protected-site configuration document version.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionConfigurationDocumentVersion = 1;

/**
 * Validates editable protected-site display-name input, including an empty cleared value.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectedSiteDisplayNameInputSchema = z.string().trim().max( 80 );

/**
 * Editable protected-site display-name input.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectedSiteDisplayNameInput = z.infer<typeof ProtectedSiteDisplayNameInputSchema>;

/**
 * Validates one persisted protected-site display-name override.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectedSiteDisplayNameSchema = ProtectedSiteDisplayNameInputSchema.min( 1 );

/**
 * Persisted protected-site display-name override.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectedSiteDisplayName = z.infer<typeof ProtectedSiteDisplayNameSchema>;

/**
 * Validates one protected-site configuration without mixing presentation data into its matching rule.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectedSiteConfigurationSchema = z.object( {
	identityHost: CanonicalHostSchema,
	rule: ProtectedSiteRuleSchema,
	displayNameOverride: ProtectedSiteDisplayNameSchema.optional(),
} ).strict().superRefine( ( configuration, context ) => {
	const isRuleHost = configuration.identityHost === configuration.rule.host;
	const isRuleDescendant = configuration.rule.includeSubdomains &&
		configuration.identityHost.endsWith( `.${ configuration.rule.host }` );

	if ( ! isRuleHost && ! isRuleDescendant ) {
		context.addIssue( {
			code: 'custom',
			message: 'Protected-site identity host must belong to its matching rule.',
			path: [ 'identityHost' ],
		} );
	}
} );

/**
 * Protected-site configuration with separate identity, matching, and optional presentation data.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectedSiteConfiguration = z.infer<typeof ProtectedSiteConfigurationSchema>;

/**
 * Validates protected-site configurations with non-overlapping matching ranges.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectedSiteConfigurationSetSchema = z.array( ProtectedSiteConfigurationSchema ).superRefine(
	( configurations, context ) => {
		const ruleSet = ProtectedSiteRuleSetSchema.safeParse(
			configurations.map( ( configuration ) => configuration.rule ),
		);

		if ( ! ruleSet.success ) {
			context.addIssue( {
				code: 'custom',
				message: 'Protected-site configuration match ranges must not overlap.',
			} );
		}
	},
);

/**
 * Protected-site configurations with non-overlapping matching ranges.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectedSiteConfigurationSet = z.infer<typeof ProtectedSiteConfigurationSetSchema>;

/**
 * Validates the current protected-site configuration document version.
 * @since 0.1.0 Initial implementation.
 */
const ProtectionConfigurationDocumentVersionSchema = z.literal( ProtectionConfigurationDocumentVersion );

/**
 * Validates one complete local protected-site configuration document.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionConfigurationDocumentSchema = z.object( {
	schemaVersion: ProtectionConfigurationDocumentVersionSchema,
	sites: ProtectedSiteConfigurationSetSchema,
} ).strict();

/**
 * Complete local protected-site configuration document.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionConfigurationDocument = z.infer<typeof ProtectionConfigurationDocumentSchema>;
