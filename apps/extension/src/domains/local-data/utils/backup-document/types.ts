import type { ProtectionConfigurationDocument } from '../../../protection/types/protected-site-configuration';
import type { ProtectionMeasurementRevision } from '../../../protection/types/protection-value';
import type { PreferencesDocument } from '../../../preferences/types';
import type { StatisticsDocument } from '../../../statistics/types/statistics-document';
import type { StatisticsGenerationId } from '../../../statistics/types/statistics-value';

/**
 * Validated current documents and source metadata used for an export.
 * @since 1.1.0
 */
export interface BackupSource {
	configuration: ProtectionConfigurationDocument;
	preferences: PreferencesDocument;
	statistics: StatisticsDocument;
	extensionVersion: string;
	exportedAt: string;
}

/**
 * Fresh target identities; no runtime identity is transported in a backup.
 * @since 1.1.0
 */
export interface BackupIdentifiers {
	dataGeneration: string;
	statisticsGeneration: StatisticsGenerationId;
	measurementRevision: ProtectionMeasurementRevision;
}

/**
 * Complete internal documents prepared before replacement begins.
 * @since 1.1.0
 */
export interface BackupDocuments {
	configuration: ProtectionConfigurationDocument;
	preferences: PreferencesDocument;
	statistics: StatisticsDocument;
}
