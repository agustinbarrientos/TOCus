import type { I18n } from '@lingui/core';
import { msg, plural } from '@lingui/core/macro';
import type { OnboardingBackupCopy } from '../../../features/onboarding/components/backup-import/types';
import { createBackupResetScreenCopy } from '../create-backup-reset-screen-copy';

/**
 * Creates localized onboarding backup import and permission recovery copy.
 * @param i18n - Locale-specific Lingui instance.
 * @return Complete onboarding import copy with shared backup feedback.
 * @since 1.1.0
 */
export function createOnboardingBackupCopy( i18n: I18n ): Readonly<OnboardingBackupCopy> {
	const dateFormatter = new Intl.DateTimeFormat( i18n.locale, {
		year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
	} );

	/**
	 * Formats the validated export timestamp without timezone-dependent date shifts.
	 * @param value - Validated ISO export timestamp.
	 * @return Localized creation date and label.
	 * @since 1.1.0
	 */
	function formatCreatedAt( value: string ): string {
		const date = dateFormatter.format( new Date( value ) );

		return i18n._( msg`Created ${ date }` );
	}

	/**
	 * Formats the complete imported visit total with locale-specific plural rules.
	 * @param count - Nonnegative aggregate reconsidered-visit count.
	 * @return Localized visit total and noun.
	 * @since 1.1.0
	 */
	function formatReconsideredVisits( count: number ): string {
		return i18n._( msg( {
			message: plural( { count }, {
				one: '# reconsidered visit', other: '# reconsidered visits',
			} ),
		} ) );
	}

	return Object.freeze( {
		entryLabel: i18n._( msg`Have a backup?` ),
		importTitle: i18n._( msg`Import a backup` ),
		importDescription: i18n._( msg`Choose a JSON backup exported from TOCus on this or another browser.` ),
		chooseFile: i18n._( msg`Choose backup file` ),
		reviewTitle: i18n._( msg`Restore this backup?` ),
		reviewDescription: i18n._( msg`Use this backup to finish setting up TOCus.` ),
		restoreBackup: i18n._( msg`Restore backup` ),
		chooseDifferentFile: i18n._( msg`Choose a different file` ),
		websitesLabel: i18n._( msg`Websites and exceptions` ),
		settingsLabel: i18n._( msg`Settings` ),
		statisticsLabel: i18n._( msg`Statistics` ),
		includedLabel: i18n._( msg`Included` ),
		replacementDescription: i18n._( msg`This replaces your current TOCus data.` ),
		successTitle: i18n._( msg`Your backup is restored` ),
		successDescription: i18n._( msg`Your websites, settings and statistics are ready. You can make changes in Settings.` ),
		accessTitle: i18n._( msg`One more step for your websites` ),
		accessDescription: i18n._( msg`Your settings and statistics are restored. Allow website access so TOCus can pause the sites in your backup.` ),
		allowAccess: i18n._( msg`Allow website access` ),
		later: i18n._( msg`Do this later` ),
		accessError: i18n._( msg`Website access wasn't granted. Try again, or continue in Settings.` ),
		common: Object.freeze( {
			...createBackupResetScreenCopy( i18n ),
			backupStaleError: i18n._( msg`Your local data changed. Review the backup again before restoring it.` ),
		} ),
		formatCreatedAt,
		formatReconsideredVisits,
	} );
}
