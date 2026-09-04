import { z } from 'zod';
import {
	CanonicalHostSchema,
	ProtectedSiteRuleSchema,
	ProtectedSiteRuleSetSchema,
} from './protected-site-rule';
import { NormalizedScheduleSchema } from './protection-schedule';
import {
	DefaultProtectionScopeId,
	ProtectionMeasurementRevisionSchema,
	ProtectionScopeIdSchema,
	type ProtectionScopeId,
} from './protection-value';
import { TimingConfigurationSchema } from './timing-configuration';

/**
 * Current protected-site configuration document version.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionConfigurationDocumentVersion = 3;

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
const ProtectionConfigurationDocumentVersionSchema = z.number().int().nonnegative().refine(
	( version ) => version === ProtectionConfigurationDocumentVersion,
);

/**
 * Extracts own entries from one plain protection-scope record input.
 * @param input - Unknown protection-scope record input.
 * @return Own entries, or null for a non-plain record.
 * @since 0.1.0 Initial implementation.
 */
function extractProtectionScopeRecordEntries( input: unknown ): unknown {
	if ( typeof input !== 'object' || input === null || Array.isArray( input ) ) {
		return null;
	}

	const prototype: unknown = Object.getPrototypeOf( input );

	return prototype === Object.prototype || prototype === null
		? Object.entries( input )
		: null;
}

/**
 * Creates one prototype-safe protection-scope record.
 * @param entries - Validated entries indexed by exact protection-scope identifiers.
 * @return Values indexed by their exact protection-scope identifiers.
 * @since 0.1.0 Initial implementation.
 */
function createProtectionScopeRecord<Value>(
	entries: Array<[ProtectionScopeId, Value]>,
): Record<string, Value> {
	return Object.fromEntries( entries );
}

/**
 * Validates one normalized protection-scope schedule entry.
 * @since 0.1.0 Initial implementation.
 */
const ProtectionScopeScheduleEntrySchema = z.tuple( [
	ProtectionScopeIdSchema,
	NormalizedScheduleSchema,
] );

/**
 * Validates normalized schedules indexed by protection scope.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionScopeScheduleMapSchema = z.preprocess(
	extractProtectionScopeRecordEntries,
	z.array( ProtectionScopeScheduleEntrySchema ),
).transform( createProtectionScopeRecord );

/**
 * Normalized schedules indexed by protection scope.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionScopeScheduleMap = z.infer<typeof ProtectionScopeScheduleMapSchema>;

/**
 * Validates one protection-scope measurement-revision entry.
 * @since 0.1.0 Initial implementation.
 */
const ProtectionScopeMeasurementRevisionEntrySchema = z.tuple( [
	ProtectionScopeIdSchema,
	ProtectionMeasurementRevisionSchema,
] );

/**
 * Validates measurement revisions indexed by protection scope.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionScopeMeasurementRevisionMapSchema = z.preprocess(
	extractProtectionScopeRecordEntries,
	z.array( ProtectionScopeMeasurementRevisionEntrySchema ),
).transform( createProtectionScopeRecord );

/**
 * Measurement revisions indexed by protection scope.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionScopeMeasurementRevisionMap = z.infer<
	typeof ProtectionScopeMeasurementRevisionMapSchema
>;

/**
 * Validates one complete local protected-site configuration document.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionConfigurationDocumentSchema = z.object( {
	schemaVersion: ProtectionConfigurationDocumentVersionSchema,
	sites: ProtectedSiteConfigurationSetSchema,
	timingConfiguration: TimingConfigurationSchema,
	schedulesByScope: ProtectionScopeScheduleMapSchema,
	measurementRevisionsByScope: ProtectionScopeMeasurementRevisionMapSchema,
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

	for ( const scopeId of activeScopeIds ) {
		if ( ! Object.hasOwn( configuration.measurementRevisionsByScope, scopeId ) ) {
			context.addIssue( {
				code: 'custom',
				message: 'Every active protection scope must have a measurement revision.',
				path: [ 'measurementRevisionsByScope', scopeId ],
			} );
		}
	}

	for ( const scopeId of Object.keys( configuration.measurementRevisionsByScope ) ) {
		if ( ! activeScopeIds.has( scopeId ) ) {
			context.addIssue( {
				code: 'custom',
				message: 'Measurement revisions must belong to an active protection scope.',
				path: [ 'measurementRevisionsByScope', scopeId ],
			} );
		}
	}
} );

/**
 * Complete local protected-site configuration document.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionConfigurationDocument = z.infer<typeof ProtectionConfigurationDocumentSchema>;
