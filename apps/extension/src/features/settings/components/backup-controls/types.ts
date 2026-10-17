import type { SettingsPageShell } from '../../services/settings-page/types';
import type { BackupDocument } from '../../../../domains/local-data/types/backup-document';

/**
 * Localized backup controls and safe failure messages.
 * @since 1.1.0
 */
export interface BackupControlsCopy {
	backupTitle: string;
	backupDescription: string;
	exportBackup: string;
	importBackup: string;
	exportingBackup: string;
	importingBackup: string;
	backupPreviewTitle: string;
	exportedAtLabel: string;
	extensionVersionLabel: string;
	dataFormatVersionLabel: string;
	websiteCountLabel: string;
	historyRangeLabel: string;
	globalScheduleLabel: string;
	inheritedScheduleLabel: string;
	includesSubdomainsLabel: string;
	excludesSubdomainsLabel: string;
	replaceConfirmationTitle: string;
	replaceConfirmation: string;
	missingPermissionDescription: string;
	replaceBackup: string;
	exportSuccess: string;
	importSuccess: string;
	importMissingAccessSuccess: string;
	exportError: string;
	exportInvalidDataError: string;
	backupReadError: string;
	backupJsonError: string;
	backupApplicationError: string;
	backupInvalidError: string;
	backupUnsupportedError: string;
	backupOversizeError: string;
	backupPermissionError: string;
	backupStaleError: string;
	backupImportError: string;
	backupRecoveryError: string;
	backupProtectionRecoveryError: string;
	backupPendingError: string;
	backupPrivacy: string;
 }

/**
 * Readable replacement preview with existing localized settings labels.
 * @since 1.1.0
 */
export interface BackupPreviewProps {
	shell: SettingsPageShell;
	backup: BackupDocument;
}
