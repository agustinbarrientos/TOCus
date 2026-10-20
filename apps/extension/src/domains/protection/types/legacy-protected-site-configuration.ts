import { z } from 'zod';
import { ProtectedSiteRuleSchema } from './protected-site-rule';
import {
	ProtectedSiteConfigurationSchema,
	ProtectionConfigurationDocumentSchema,
	ProtectionConfigurationDocumentVersion,
} from './protected-site-configuration';

/** Validates the historical host-only rule shape before applying unchanged host checks. */
const LegacyProtectedSiteRuleSchema = z.strictObject( {
	host: ProtectedSiteRuleSchema.shape.host,
	includeSubdomains: ProtectedSiteRuleSchema.shape.includeSubdomains,
	scopeId: ProtectedSiteRuleSchema.shape.scopeId,
} ).refine( ( rule ) => ProtectedSiteRuleSchema.safeParse( rule ).success );

/** Validates the historical site shape without accepting exception policy fields. */
const LegacyProtectedSiteConfigurationSchema = z.strictObject( {
	identityHost: ProtectedSiteConfigurationSchema.shape.identityHost,
	rule: LegacyProtectedSiteRuleSchema,
	displayNameOverride: ProtectedSiteConfigurationSchema.shape.displayNameOverride,
	schedule: ProtectedSiteConfigurationSchema.shape.schedule,
} ).refine( ( site ) => ProtectedSiteConfigurationSchema.safeParse( site ).success );

/**
 * Preserves version-five non-overlapping host ownership during legacy decoding.
 * @since 1.1.0
 */
export const LegacyProtectedSiteConfigurationSetSchema = z.array( LegacyProtectedSiteConfigurationSchema )
	.superRefine( ( sites, context ) => {
		for ( const [ index, site ] of sites.entries() ) {
			for ( const existing of sites.slice( 0, index ) ) {
				if ( site.rule.host === existing.rule.host ||
					( site.rule.includeSubdomains && existing.rule.host.endsWith( `.${ site.rule.host }` ) ) ||
					( existing.rule.includeSubdomains && site.rule.host.endsWith( `.${ existing.rule.host }` ) ) ) {
					context.addIssue( { code: 'custom', message: 'Legacy site ranges must not overlap.',
						path: [ index, 'rule', 'host' ] } );
				}
			}
		}
	} );

/**
 * Strictly validates the saved version-five layout, retaining scope-revision checks.
 * @since 1.1.0
 */
export const LegacyProtectionConfigurationDocumentSchema = z.strictObject( {
	...ProtectionConfigurationDocumentSchema.shape,
	schemaVersion: z.literal( 5 ),
	sites: LegacyProtectedSiteConfigurationSetSchema,
} ).refine( ( configuration ) => ProtectionConfigurationDocumentSchema.safeParse( {
	...configuration, schemaVersion: ProtectionConfigurationDocumentVersion,
} ).success );

/**
 * Reads supported storage versions into the current shape without reinterpreting saved coverage.
 * @since 1.1.0
 */
export const CompatibleProtectionConfigurationDocumentSchema = z.union( [
	ProtectionConfigurationDocumentSchema,
	LegacyProtectionConfigurationDocumentSchema.transform( ( configuration ) =>
		ProtectionConfigurationDocumentSchema.parse( {
			...configuration, schemaVersion: ProtectionConfigurationDocumentVersion,
		} ),
	),
] );
