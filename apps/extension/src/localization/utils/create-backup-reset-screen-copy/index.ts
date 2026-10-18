import type { I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { BackupResetScreenCopy } from '../../../features/settings/components/backup-reset-screen/types';

/**
 * Creates localized copy for the dedicated backup and reset destination.
 * @param i18n - Locale-specific Lingui instance.
 * @return Local backup, replacement and reset explanations and confirmation feedback.
 * @since 1.1.0
 */
export function createBackupResetScreenCopy( i18n: I18n ): Readonly<BackupResetScreenCopy> {
	return Object.freeze( {
		title: i18n._( msg`Backup and reset` ),
		backupTitle: i18n._( msg`Back up and restore` ),
		backupDescription: i18n._( msg`Your backup contains configured website addresses, settings, and statistics. TOCus creates it entirely on your device. Keep it somewhere you trust.` ),
		exportBackup: i18n._( msg`Export backup` ),
		importBackup: i18n._( msg`Import backup` ),
		exportingBackup: i18n._( msg`Exporting backup...` ),
		importingBackup: i18n._( msg`Importing backup...` ),
		backupPreviewTitle: i18n._( msg`Backup preview` ),
		exportedAtLabel: i18n._( msg`Exported on` ),
		extensionVersionLabel: i18n._( msg`Source extension version` ),
		dataFormatVersionLabel: i18n._( msg`Data format version` ),
		websiteCountLabel: i18n._( msg`Website count` ),
		historyRangeLabel: i18n._( msg`Recorded date range` ),
		globalScheduleLabel: i18n._( msg`Global schedule` ),
		inheritedScheduleLabel: i18n._( msg`Uses the global schedule` ),
		includesSubdomainsLabel: i18n._( msg`Includes subdomains` ),
		excludesSubdomainsLabel: i18n._( msg`Excludes subdomains` ),
		replaceConfirmationTitle: i18n._( msg`Replace your settings and statistics?` ),
		replaceConfirmation: i18n._( msg`Importing replaces your current websites, schedules, timing, preferences, and statistics. The two sets of data will not be combined. Current temporary pauses and browsing sessions will end.` ),
		missingPermissionDescription: i18n._( msg`TOCus will ask for browser access. If you deny access, the website rules will still be imported, but websites without access will remain unprotected. You can allow access later.` ),
		replaceBackup: i18n._( msg`Replace settings and statistics` ),
		exportSuccess: i18n._( msg`Backup download started.` ),
		importSuccess: i18n._( msg`Settings and statistics replaced.` ),
		importMissingAccessSuccess: i18n._( msg`Settings and statistics replaced. Some websites still need browser access before TOCus can pause them.` ),
		exportError: i18n._( msg`TOCus couldn't export the backup. Your saved data is unchanged.` ),
		exportInvalidDataError: i18n._( msg`Your saved data isn't valid or uses an unsupported format. TOCus couldn't create a backup.` ),
		backupReadError: i18n._( msg`TOCus couldn't read this file. Choose it again.` ),
		backupJsonError: i18n._( msg`This file isn't valid JSON. Choose a TOCus backup.` ),
		backupApplicationError: i18n._( msg`This file isn't a TOCus backup.` ),
		backupInvalidError: i18n._( msg`This backup contains invalid or incomplete data. Your settings and statistics weren't replaced.` ),
		backupUnsupportedError: i18n._( msg`This backup's data format isn't supported. Your settings and statistics weren't replaced.` ),
		backupOversizeError: i18n._( msg`This backup exceeds the 10 MiB file limit. Choose a smaller file.` ),
		backupPermissionError: i18n._( msg`Browser access couldn't be requested. Your settings and statistics weren't replaced. Try again.` ),
		backupStaleError: i18n._( msg`Your local data changed. Reload settings before importing this backup.` ),
		backupImportError: i18n._( msg`TOCus couldn't start the replacement. Your saved settings and statistics are unchanged. Try again.` ),
		backupRecoveryError: i18n._( msg`TOCus couldn't finish importing. Try again to complete the replacement.` ),
		backupProtectionRecoveryError: i18n._( msg`TOCus couldn't restart protection. Try again to restore it.` ),
		backupPendingError: i18n._( msg`Local data recovery is still pending. Try again to complete it before exporting or importing.` ),
		backupPrivacy: i18n._( msg`Backups include configured website addresses and historical counts and durations. TOCus doesn't collect browsing history or page contents.` ),
		statisticsTitle: i18n._( msg`Reset statistics` ),
		statisticsDescription: i18n._( msg`Clear your recorded counts and time totals. Your websites and settings stay the same.` ),
		statisticsConfirmationTitle: i18n._( msg`Reset your statistics?` ),
		statisticsConfirmation: i18n._( msg`All recorded counts and time totals will be deleted. This can't be undone.` ),
		resetStatistics: i18n._( msg`Reset statistics` ),
		allTitle: i18n._( msg`Start fresh` ),
		allDescription: i18n._( msg`Remove all TOCus data and set it up again.` ),
		allConfirmationTitle: i18n._( msg`Reset all TOCus data?` ),
		allConfirmation: i18n._( msg`Your websites, schedules, pause times, preferences, active pauses, and statistics will be erased. The setup will begin again. This can't be reversed.` ),
		resetAll: i18n._( msg`Reset all TOCus data` ),
		cancel: i18n._( msg`Cancel` ),
		resetting: i18n._( msg`Resetting...` ),
		retry: i18n._( msg`Try again` ),
		resetError: i18n._( msg`TOCus couldn't finish the reset. Try again to complete it.` ),
		statisticsSuccess: i18n._( msg`Statistics reset. Your websites and settings are unchanged.` ),
		allSuccess: i18n._( msg`All TOCus data reset.` ),
		unavailable: i18n._( msg`Local data controls are unavailable right now.` ),
	} );
}
