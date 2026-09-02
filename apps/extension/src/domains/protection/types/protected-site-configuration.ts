import { z } from 'zod';
import {
	CanonicalHostSchema,
	ProtectedSiteRuleSchema,
	ProtectedSiteRuleSetSchema,
} from './protected-site-rule';
import { NormalizedScheduleSchema } from './protection-schedule';
import { DefaultProtectionScopeId, ProtectionScopeIdSchema } from './protection-value';
import { TimingConfigurationSchema } from './timing-configuration';

/**
 * Current protected-site configuration document version.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionConfigurationDocumentVersion = 2;

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
 * Validates normalized schedules indexed by protection scope.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionScopeScheduleMapSchema = z.record(
	z.string(),
	NormalizedScheduleSchema,
).superRefine( ( schedulesByScope, context ) => {
	for ( const scopeId of Object.keys( schedulesByScope ) ) {
		if ( ! ProtectionScopeIdSchema.safeParse( scopeId ).success ) {
			context.addIssue( {
				code: 'custom',
				message: 'Schedule keys must be valid protection scope identifiers.',
				path: [ scopeId ],
			} );
		}
	}
} );

/**
 * Normalized schedules indexed by protection scope.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionScopeScheduleMap = z.infer<typeof ProtectionScopeScheduleMapSchema>;

/**
 * Validates one complete local protected-site configuration document.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionConfigurationDocumentSchema = z.object( {
	schemaVersion: ProtectionConfigurationDocumentVersionSchema,
	sites: ProtectedSiteConfigurationSetSchema,
	timingConfiguration: TimingConfigurationSchema,
	schedulesByScope: ProtectionScopeScheduleMapSchema,
} ).strict().superRefine( ( configuration, context ) => {
	const activeScopeIds = new Set<string>( [
		DefaultProtectionScopeId,
		...configuration.sites.map( ( site ) => site.rule.scopeId ),
	] );

	for ( const scopeId of activeScopeIds ) {
		if ( ! Object.hasOwn( configuration.schedulesByScope, scopeId ) ) {
			context.addIssue( {
				code: 'custom',
				message: 'Every active protection scope must have a schedule.',
				path: [ 'schedulesByScope', scopeId ],
			} );
		}
	}

	for ( const scopeId of Object.keys( configuration.schedulesByScope ) ) {
		if ( ! activeScopeIds.has( scopeId ) ) {
			context.addIssue( {
				code: 'custom',
				message: 'Schedules must belong to an active protection scope.',
				path: [ 'schedulesByScope', scopeId ],
			} );
		}
	}
} );

/**
 * Complete local protected-site configuration document.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionConfigurationDocument = z.infer<typeof ProtectionConfigurationDocumentSchema>;
