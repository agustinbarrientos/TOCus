import {
	ProtectionConfigurationDocumentSchema, ProtectionConfigurationDocumentVersion,
} from '../../../protection/types/protected-site-configuration';
import { DefaultProtectionScopeId } from '../../../protection/types/protection-value';
import { PreferencesDocumentSchema, PreferencesDocumentVersion } from '../../../preferences/types';
import { StatisticsDocumentSchema, StatisticsDocumentVersion } from '../../../statistics/types/statistics-document';
import type { BackupDocuments, BackupIdentifiers, BackupSource } from './types';
import { BackupDataFormatVersion, BackupDocumentSchema, BackupMaximumBytes, type BackupDocument } from '../../types/backup-document';

/**
 * Exports user choices and history without live sessions or internal versions.
 * @param source - Current documents and metadata, validated before conversion.
 * @return Detached portable backup.
 * @since 1.1.0
 */
export function createBackupDocument( source: BackupSource ): BackupDocument {
	const configuration = ProtectionConfigurationDocumentSchema.parse( source.configuration );
	const preferences = PreferencesDocumentSchema.parse( source.preferences );
	const statistics = StatisticsDocumentSchema.parse( source.statistics );
	return BackupDocumentSchema.parse( {
		application: 'TOCus', dataFormatVersion: BackupDataFormatVersion,
		extensionVersion: source.extensionVersion, exportedAt: source.exportedAt,
		settings: { sites: configuration.sites, timingConfiguration: configuration.timingConfiguration,
			schedule: configuration.schedule },
		preferences: { theme: preferences.theme, palette: preferences.palette,
			pauseMode: preferences.pauseMode, language: preferences.language },
		statistics: { firstRecordedDate: statistics.firstRecordedDate, dailyTotals: statistics.dailyTotals,
			scopes: Object.fromEntries( Object.entries( statistics.scopes ).map( ( [ id,
				scope ] ) => [ id, scope.totals ] ) ) },
	} );
}

/**
 * Parses bounded UTF-8 JSON without repairing invalid or unsupported values.
 * @param text - Contents of a user-selected local file.
 * @return Detached portable backup.
 * @throws {Error} When the file is oversized, malformed, or unsupported.
 * @since 1.1.0
 */
export function parseBackupText( text: string ): BackupDocument {
	if ( new TextEncoder().encode( text ).byteLength > BackupMaximumBytes ) {
		throw new Error( 'Backup size exceeds ten MiB.' );
	}
	return BackupDocumentSchema.parse( JSON.parse( text ) );
}

/**
 * Constructs current storage documents with new generations and inactive history.
 * @param input - Portable backup revalidated at the conversion boundary.
 * @param ids - Fresh target identities.
 * @return Complete replacement documents without live sessions.
 * @since 1.1.0
 */
export function createBackupDocuments( input: BackupDocument, ids: BackupIdentifiers ): BackupDocuments {
	const backup = BackupDocumentSchema.parse( input );
	return {
		configuration: ProtectionConfigurationDocumentSchema.parse( {
			schemaVersion: ProtectionConfigurationDocumentVersion, ...backup.settings,
			measurementRevisionsByScope: { [ DefaultProtectionScopeId ]: ids.measurementRevision },
		} ),
		preferences: PreferencesDocumentSchema.parse( {
			schemaVersion: PreferencesDocumentVersion, ...backup.preferences,
		} ),
		statistics: StatisticsDocumentSchema.parse( {
			schemaVersion: StatisticsDocumentVersion, generationId: ids.statisticsGeneration, lastAppliedBatchId: null,
			...backup.statistics,
			scopes: Object.fromEntries( Object.entries( backup.statistics.scopes ).map( ( [ id, totals ] ) => [ id, {
				totals,
				...( id === DefaultProtectionScopeId
					? { currentMeasurementRevision: ids.measurementRevision }
					: {} ),
			} ] ) ),
		} ),
	};
}

export * from './types';
