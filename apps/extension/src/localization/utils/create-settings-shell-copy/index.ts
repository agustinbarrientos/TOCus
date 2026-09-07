import type { I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { SettingsShellCopy } from '../../../features/settings/components/shell/types';

/**
 * Creates localized settings-shell navigation copy.
 * @param i18n - Locale-specific Lingui instance.
 * @return Complete localized settings-shell copy.
 * @since 0.1.0 Initial implementation.
 */
export function createSettingsShellCopy( i18n: I18n ): Readonly<SettingsShellCopy> {
	return Object.freeze( {
		navigationLabel: i18n._( msg`Settings` ),
		about: i18n._( msg`About` ),
		appearance: i18n._( msg`Appearance` ),
		protectedSites: i18n._( msg`Websites` ),
		schedule: i18n._( msg`Schedule` ),
		timing: i18n._( msg`Pause timing` ),
		language: i18n._( msg`Language` ),
		privacy: i18n._( msg`Privacy and local data` ),
		statistics: i18n._( msg`Statistics` ),
		unsavedChangesTitle: i18n._( msg`Discard unsaved changes?` ),
		unsavedChangesDescription: i18n._( msg`Leaving this page will discard your unsaved changes.` ),
		stay: i18n._( msg`Stay` ),
		discard: i18n._( msg`Discard` ),
	} );
}
