import { z } from 'zod';
import { ProtectionConfigurationDocumentSchema } from '../../protection/types/protected-site-configuration';
import { ProtectionScopeIdSchema } from '../../protection/types/protection-value';
import { PreferencesDocumentSchema } from '../../preferences/types';
import { StatisticsDocumentSchema, StatisticsDocumentVersion, StatisticsTotalsSchema } from '../../statistics/types/statistics-document';
import { StatisticsVisitOutcomesSchema } from '../../statistics/types/statistics-visit-outcomes';

/**
 * Portable backup contract introduced with the 1.1.0 release.
 * @since 1.1.0
 */
export const BackupDataFormatVersion = '1.1.0';

/**
 * Maximum UTF-8 backup size accepted by both the UI and authority.
 * @since 1.1.0
 */
export const BackupMaximumBytes = 10 * 1_024 * 1_024;

/**
 * Extracts own entries without accepting arrays or custom object prototypes.
 * @param input - Untrusted portable scope record.
 * @return Own entries, or an invalid sentinel.
 * @since 1.1.0
 */
function scopeEntries( input: unknown ): unknown {
	if ( typeof input !== 'object' || input === null || Array.isArray( input ) ) {
		return null;
	}
	const prototype: unknown = Object.getPrototypeOf( input );
	return prototype === Object.prototype || prototype === null ? Object.entries( input ) : null;
}

/**
 * Validates aggregate values indexed by exact, prototype-safe scope identifiers.
 * @since 1.1.0
 */
const BackupScopesSchema = z.preprocess( scopeEntries,
	z.array( z.tuple( [ ProtectionScopeIdSchema, StatisticsTotalsSchema ] ) ),
).transform( ( entries ) => Object.fromEntries( entries ) );

/**
 * Historical aggregates without any live measurement or delivery identity.
 * @since 1.1.0
 */
const BackupStatisticsSchema = z.strictObject( {
	firstRecordedDate: StatisticsDocumentSchema.shape.firstRecordedDate,
	dailyTotals: StatisticsDocumentSchema.shape.dailyTotals,
	scopes: BackupScopesSchema,
	visitOutcomes: StatisticsVisitOutcomesSchema.optional(),
} ).refine( ( statistics ) => StatisticsDocumentSchema.safeParse( {
	schemaVersion: StatisticsDocumentVersion, generationId: 'backup_validation', lastAppliedBatchId: null,
	...statistics,
	scopes: Object.fromEntries( Object.entries( statistics.scopes ).map( ( [ id, totals ] ) => [ id, { totals } ] ) ),
} ).success, { message: 'Backup statistics history is inconsistent.' } );

/**
 * Strict portable JSON contract independent of internal storage versions.
 * @since 1.1.0
 */
export const BackupDocumentSchema = z.strictObject( {
	application: z.literal( 'TOCus' ),
	dataFormatVersion: z.literal( BackupDataFormatVersion ),
	extensionVersion: z.string().regex( /^\d+(?:\.\d+){0,3}$/ ),
	exportedAt: z.iso.datetime(),
	settings: z.strictObject( {
		sites: ProtectionConfigurationDocumentSchema.shape.sites,
		timingConfiguration: ProtectionConfigurationDocumentSchema.shape.timingConfiguration,
		schedule: ProtectionConfigurationDocumentSchema.shape.schedule,
	} ),
	preferences: PreferencesDocumentSchema.omit( { schemaVersion: true } ).extend( {
		focusLinks: PreferencesDocumentSchema.shape.focusLinks.default( [] ),
	} ),
	statistics: BackupStatisticsSchema,
} );

/**
 * Validated settings and historical aggregates for a local portable backup.
 * @since 1.1.0
 */
export type BackupDocument = z.infer<typeof BackupDocumentSchema>;
