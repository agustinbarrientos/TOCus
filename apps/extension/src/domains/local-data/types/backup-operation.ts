import { z } from 'zod';
import { BackupDocumentSchema } from './backup-document';
import { ProtectionConfigurationDocumentSchema } from '../../protection/types/protected-site-configuration';
import { PreferencesDocumentSchema } from '../../preferences/types';
import { StatisticsDocumentSchema } from '../../statistics/types/statistics-document';

export * from './backup-storage-key';

/**
 * Bounded request identity generated once per confirmed import.
 * @since 1.1.0
 */
const BackupRequestIdSchema = z.string().regex( /^[A-Za-z0-9_-]+$/ ).max( 128 );

/**
 * Strict import request revalidated by its background authority.
 * @since 1.1.0
 */
export const BackupImportRequestSchema = z.strictObject( {
	type: z.literal( 'import-local-backup' ), requestId: BackupRequestIdSchema,
	expectedGeneration: z.string().min( 1 ).nullable(), backup: BackupDocumentSchema,
} );

/**
 * Confirmed replacement request.
 * @since 1.1.0
 */
export type BackupImportRequest = z.infer<typeof BackupImportRequestSchema>;

/**
 * Durable deduplication receipt for a completed import.
 * @since 1.1.0
 */
export const BackupImportReceiptSchema = z.strictObject( {
	requestId: BackupRequestIdSchema, fingerprint: z.string().regex( /^[a-f0-9]{64}$/ ),
	generation: z.string().min( 1 ),
} );

/**
 * Complete validated target documents retained until replacement finishes.
 * @since 1.1.0
 */
export const BackupImportJournalSchema = BackupImportReceiptSchema.extend( {
	documents: z.strictObject( {
		configuration: ProtectionConfigurationDocumentSchema,
		preferences: PreferencesDocumentSchema,
		statistics: StatisticsDocumentSchema,
	} ),
} );

/**
 * Recoverable target set with its stable confirmed-request identity.
 * @since 1.1.0
 */
export type BackupImportJournal = z.infer<typeof BackupImportJournalSchema>;

/**
 * Import completion or safe retry state returned to settings.
 * @since 1.1.0
 */
export const BackupImportResultSchema = z.discriminatedUnion( 'status', [
	z.strictObject( { status: z.literal( 'completed' ), requestId: BackupRequestIdSchema,
		generation: z.string().min( 1 ) } ),
	z.strictObject( { status: z.enum( [ 'stale', 'invalid', 'busy', 'failed', 'recovery-pending' ] ) } ),
] );

/**
 * Validated import result.
 * @since 1.1.0
 */
export type BackupImportResult = z.infer<typeof BackupImportResultSchema>;

/**
 * Snapshot response including its data generation for later confirmation.
 * @since 1.1.0
 */
export const BackupExportResultSchema = z.discriminatedUnion( 'status', [
	z.strictObject( { status: z.literal( 'available' ), backup: BackupDocumentSchema,
		generation: z.string().min( 1 ).nullable() } ),
	z.strictObject( { status: z.enum( [ 'unavailable', 'busy' ] ) } ),
] );

/**
 * Validated portable export or a non-mutating failure.
 * @since 1.1.0
 */
export type BackupExportResult = z.infer<typeof BackupExportResultSchema>;
