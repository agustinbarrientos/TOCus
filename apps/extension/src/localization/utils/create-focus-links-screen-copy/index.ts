import type { I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { FocusLinksScreenCopy } from '../../../features/settings/components/focus-links-screen/types';

/**
 * Creates localized controls for links chosen by the user for the pause screen.
 * @param i18n - Locale-specific Lingui instance.
 * @return Complete focus-link settings and recovery messages.
 * @since 1.1.0
 */
export function createFocusLinksScreenCopy( i18n: I18n ): Readonly<FocusLinksScreenCopy> {
	return Object.freeze( {
		title: i18n._( msg`Focus links` ),
		formLabel: i18n._( msg`Focus link preferences` ),
		description: i18n._( msg`Optionally, add up to three website shortcuts to your breathing screen. Use them to quickly visit sites you'd rather spend time on.` ),
		emptyMessage: i18n._( msg`No websites yet` ),
		addLink: i18n._( msg`Add site` ),
		label: i18n._( msg`Label` ),
		url: i18n._( msg`Web address` ),
		remove: i18n._( msg`Remove link` ),
		moveUp: i18n._( msg`Move up` ),
		moveDown: i18n._( msg`Move down` ),
		invalidLabel: i18n._( msg`Enter a label with 1 to 64 characters.` ),
		invalidUrl: i18n._( msg`Enter an http:// or https:// address without a username or password.` ),
		loading: i18n._( msg`Loading focus links...` ),
		malformedDataTitle: i18n._( msg`Personalization settings need your attention` ),
		malformedDataDescription: i18n._( msg`Your local personalization data isn't valid. Restoring defaults will reset appearance, pause, language, and focus links.` ),
		loadErrorTitle: i18n._( msg`Focus links couldn't load` ),
		loadErrorDescription: i18n._( msg`TOCus couldn't load local focus links. Nothing was changed.` ),
		restoreDefaults: i18n._( msg`Restore personalization defaults` ),
		restoreDefaultsError: i18n._( msg`TOCus couldn't restore your personalization defaults. Nothing was changed.` ),
		restoredAnnouncement: i18n._( msg`Personalization defaults restored.` ),
		retry: i18n._( msg`Try again` ),
		saveError: i18n._( msg`Your focus links couldn't be saved. Your changes are still shown here.` ),
		save: i18n._( msg`Save` ),
		saving: i18n._( msg`Saving...` ),
		discard: i18n._( msg`Discard` ),
	} );
}
