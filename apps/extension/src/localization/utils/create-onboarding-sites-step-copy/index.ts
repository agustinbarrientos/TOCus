import { type I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { type OnboardingSitesStepCopy } from '../../../features/onboarding/components/sites-step/types';

/**
 * Creates localized onboarding Sites-step copy.
 * @param i18n - Locale-specific Lingui instance.
 * @return Complete localized Sites-step copy.
 * @since 0.1.0 Initial implementation.
 */
export function createOnboardingSitesStepCopy( i18n: I18n ): Readonly<OnboardingSitesStepCopy> {
	/**
	 * Formats the accessible action for one available site suggestion.
	 * @param siteName - Fixed site brand name.
	 * @return Localized suggestion action.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatAddSuggestionLabel( siteName: string ): string {
		return i18n._( msg`Add ${ siteName }` );
	}

	/**
	 * Formats the accessible status for one pending site suggestion.
	 * @param siteName - Fixed site brand name.
	 * @return Localized pending suggestion status.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatAddingSuggestionLabel( siteName: string ): string {
		return i18n._( msg`Adding ${ siteName }...` );
	}

	/**
	 * Formats the accessible status for one protected site suggestion.
	 * @param siteName - Fixed site brand name.
	 * @return Localized protected suggestion status.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatAddedSuggestionLabel( siteName: string ): string {
		return i18n._( msg`${ siteName } added` );
	}

	/**
	 * Formats one successful protected-site announcement.
	 * @param siteName - Site name displayed to the user.
	 * @return Localized success announcement.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatAddedAnnouncement( siteName: string ): string {
		return i18n._( msg`${ siteName } was added to your list.` );
	}

	return Object.freeze( {
		title: i18n._( msg`Choose websites` ),
		introduction: i18n._( msg`Pick any suggestions or add a site yourself. You can finish without choosing one.` ),
		suggestionsLegend: i18n._( msg`Popular choices` ),
		manualLegend: i18n._( msg`Add another site` ),
		addressLabel: i18n._( msg`Website address` ),
		addressPlaceholder: i18n._( msg`example.com` ),
		addressHelp: i18n._( msg`Enter a domain or a full web address. TOCus includes the whole domain by default.` ),
		addSiteLabel: i18n._( msg`Add a pause here` ),
		addingSiteLabel: i18n._( msg`Adding...` ),
		invalidSiteError: i18n._( msg`Enter a valid website address.` ),
		alreadyProtectedError: i18n._( msg`That website is already on your list.` ),
		permissionDeniedError: i18n._( msg`TOCus needs browser access to show the pause on that website. Nothing was added.` ),
		permissionRequestError: i18n._( msg`Your browser could not request access for that site. Try again.` ),
		permissionRetainedError: i18n._(
			msg`This site was not saved, but TOCus may still have browser access to it. Add it again to finish setup, or remove that access from your browser's extension settings.`,
		),
		saveError: i18n._( msg`TOCus could not save that site. Try again.` ),
		unexpectedError: i18n._( msg`Something went wrong while adding that site. Try again.` ),
		finishLabel: i18n._( msg`Finish setup` ),
		formatAddSuggestionLabel,
		formatAddingSuggestionLabel,
		formatAddedSuggestionLabel,
		formatAddedAnnouncement,
	} );
}
