import { type I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { type ProtectedSitesScreenCopy } from '../../../features/protected-sites/components/screen/types';
import { type LocalizationFormatters } from '../create-localization-formatters';
import { createProtectedSiteListCopy } from '../create-protected-site-list-copy';

/**
 * Creates localized Protected-sites screen copy.
 * @param i18n - Locale-specific Lingui instance.
 * @param formatters - Locale-sensitive formatters for the bundle.
 * @return Complete localized Protected-sites screen copy.
 * @since 0.1.0 Initial implementation.
 */
export function createProtectedSitesCopy(
	i18n: I18n,
	formatters: LocalizationFormatters,
): Readonly<ProtectedSitesScreenCopy> {
	const listCopy = createProtectedSiteListCopy( i18n, formatters );

	/**
	 * Formats one addition announcement.
	 * @param name - Resolved local site name.
	 * @return Complete localized announcement.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatAddedAnnouncement( name: string ): string {
		return i18n._( msg`${ { name } } was added to your list.` );
	}

	/**
	 * Formats one update announcement.
	 * @param name - Resolved local site name.
	 * @return Complete localized announcement.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatUpdatedAnnouncement( name: string ): string {
		return i18n._( msg`${ { name } } was updated.` );
	}

	/**
	 * Formats one removal announcement.
	 * @param name - Resolved local site name.
	 * @return Complete localized announcement.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatRemovedAnnouncement( name: string ): string {
		return i18n._( msg`${ { name } } was removed from your list.` );
	}

	/**
	 * Formats one retained-permission announcement.
	 * @param name - Resolved local site name.
	 * @return Complete localized announcement.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatPermissionRetainedAnnouncement( name: string ): string {
		return i18n._( msg`${ { name } } was removed, but its browser access could not be removed automatically.` );
	}

	/**
	 * Formats one restored-access announcement.
	 * @param name - Resolved local site name.
	 * @return Complete localized announcement.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatAccessRestoredAnnouncement( name: string ): string {
		return i18n._( msg`${ { name } } access was restored.` );
	}

	return Object.freeze( {
		...listCopy,
		eyebrow: i18n._( msg`Pause setup` ),
		title: i18n._( msg`Websites` ),
		introduction: i18n._( msg`Choose the websites where a calm pause can help you return to your intentions.` ),
		addressLabel: i18n._( msg`Website address` ),
		addressPlaceholder: i18n._( msg`example.com` ),
		addSite: i18n._( msg`Add a pause here` ),
		addingSite: i18n._( msg`Adding...` ),
		addressHelp: i18n._( msg`Enter a website address or domain. TOCus includes its subdomains by default.` ),
		behaviorLegend: i18n._( msg`How should this site behave?` ),
		sharedBehavior: i18n._( msg`Shared timing` ),
		sharedBehaviorDescription: i18n._( msg`Use the same wait and allowance as your other websites.` ),
		independentBehavior: i18n._( msg`Give this website its own timing` ),
		independentBehaviorDescription: i18n._( msg`Give this site its own wait and allowance.` ),
		loading: i18n._( msg`Loading websites...` ),
		invalidSiteError: i18n._( msg`Enter a valid website address, such as example.com.` ),
		alreadyProtectedError: i18n._( msg`This website is already on your list.` ),
		invalidConfigurationError: i18n._( msg`Your website list changed. Retry before adding this site.` ),
		invalidScopeError: i18n._( msg`TOCus could not create separate timing for this site.` ),
		invalidDisplayNameError: i18n._( msg`The website name is not valid.` ),
		siteNotFoundError: i18n._( msg`This website is no longer on your list.` ),
		saveError: i18n._( msg`This website could not be saved. Your entry is still here.` ),
		permissionDeniedError: i18n._( msg`Browser access to show the pause on this website is required. Nothing was saved.` ),
		permissionRequestError: i18n._( msg`Browser access could not be requested. Nothing was saved.` ),
		permissionRetainedError: i18n._( msg`This website could not be saved. Its browser access may still be active.` ),
		malformedDataTitle: i18n._( msg`Your website list needs attention` ),
		malformedDataDescription: i18n._( msg`Your local website list is not valid, so it was not replaced.` ),
		loadErrorTitle: i18n._( msg`Websites could not load` ),
		loadErrorDescription: i18n._( msg`TOCus could not load local settings. Nothing was changed.` ),
		retry: i18n._( msg`Try again` ),
		formatAddedAnnouncement,
		formatUpdatedAnnouncement,
		formatRemovedAnnouncement,
		formatPermissionRetainedAnnouncement,
		formatAccessRestoredAnnouncement,
	} );
}
