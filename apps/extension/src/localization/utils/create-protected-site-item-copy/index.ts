import type { I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { ProtectedSiteItemCopy } from '../../../features/protected-sites/components/site-item/types';

/**
 * Creates localized protected-site item copy.
 * @param i18n - Locale-specific Lingui instance.
 * @return Complete localized protected-site item copy.
 * @since 1.0.0 Initial implementation.
 */
export function createProtectedSiteItemCopy( i18n: I18n ): Readonly<ProtectedSiteItemCopy> {
	/**
	 * Formats one accessible selection label.
	 * @param name - Current resolved display name.
	 * @return Complete localized selection label.
	 * @since 1.0.0 Initial implementation.
	 */
	function formatSelectSite( name: string ): string {
		return i18n._( msg`Select ${ { name } }` );
	}

	/**
	 * Formats one removal question.
	 * @param name - Current resolved display name.
	 * @return Complete localized question.
	 * @since 1.0.0 Initial implementation.
	 */
	function formatRemoveQuestion( name: string ): string {
		return i18n._( msg`Remove ${ { name } }?` );
	}

	return Object.freeze( {
		customScheduleLabel: i18n._( msg`Use custom schedule` ),
		automaticNamePlaceholder: i18n._( msg`Automatic name` ),
		done: i18n._( msg`Done` ),
		accessRequired: i18n._( msg`Access required` ),
		allowAccess: i18n._( msg`Allow access` ),
		allowingAccess: i18n._( msg`Allowing...` ),
		accessRequestError: i18n._( msg`Browser access is still required to show the pause on this website.` ),
		edit: i18n._( msg`Change when TOCus pauses this site, or rename it` ),
		displayNameLabel: i18n._( msg`Name` ),
		saveChanges: i18n._( msg`Save changes` ),
		saving: i18n._( msg`Saving...` ),
		cancel: i18n._( msg`Cancel` ),
		removeSite: i18n._( msg`Remove site` ),
		keepSite: i18n._( msg`Keep site` ),
		confirmRemove: i18n._( msg`Remove` ),
		operationError: i18n._( msg`Your changes couldn't be saved. Nothing was replaced.` ),
		configurationChangedError: i18n._( msg`This site changed elsewhere. Reload settings and try again.` ),
		formatSelectSite,
		formatRemoveQuestion,
	} );
}
