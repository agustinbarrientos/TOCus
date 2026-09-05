import { type I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { type ProtectedSiteItemCopy } from '../../../features/protected-sites/components/site-item/types';

/**
 * Creates localized protected-site item copy.
 * @param i18n - Locale-specific Lingui instance.
 * @return Complete localized protected-site item copy.
 * @since 0.1.0 Initial implementation.
 */
export function createProtectedSiteItemCopy( i18n: I18n ): Readonly<ProtectedSiteItemCopy> {
	/**
	 * Formats one protection boundary.
	 * @param host - Canonical protection host.
	 * @param includesSubdomains - Whether descendant hosts are protected.
	 * @return Complete localized boundary explanation.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatBoundary( host: string, includesSubdomains: boolean ): string {
		return includesSubdomains
			? i18n._( msg`Includes ${ { host } } and its subdomains` )
			: i18n._( msg`Includes only ${ { host } }` );
	}

	/**
	 * Formats one removal question.
	 * @param name - Current resolved display name.
	 * @return Complete localized question.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatRemoveQuestion( name: string ): string {
		return i18n._( msg`Remove ${ { name } }?` );
	}

	return Object.freeze( {
		accessRequired: i18n._( msg`Access required` ),
		allowAccess: i18n._( msg`Allow access` ),
		allowingAccess: i18n._( msg`Allowing...` ),
		accessRequestError: i18n._( msg`Browser access is still required to show the pause on this website.` ),
		edit: i18n._( msg`Manage this website` ),
		displayNameLabel: i18n._( msg`Display name` ),
		useAutomaticName: i18n._( msg`Use automatic name` ),
		behaviorLegend: i18n._( msg`Pause behavior` ),
		sharedBehavior: i18n._( msg`Use shared timing` ),
		sharedBehaviorDescription: i18n._( msg`Uses the shared wait, allowance, and schedule.` ),
		independentBehavior: i18n._( msg`Give this website its own timing` ),
		independentBehaviorDescription: i18n._( msg`Uses its own wait, allowance, and schedule.` ),
		saveChanges: i18n._( msg`Save changes` ),
		saving: i18n._( msg`Saving...` ),
		cancel: i18n._( msg`Cancel` ),
		removeSite: i18n._( msg`Remove site` ),
		keepSite: i18n._( msg`Keep site` ),
		confirmRemove: i18n._( msg`Remove` ),
		operationError: i18n._( msg`Your changes could not be saved. Nothing was replaced.` ),
		configurationChangedError: i18n._( msg`This site changed elsewhere. Reload settings and try again.` ),
		sharedLabel: i18n._( msg( {
			comment: 'Status adjective for a site that shares protection timing with other sites.',
			message: 'Shared',
		} ) ),
		independentLabel: i18n._( msg( {
			comment: 'Status adjective for a site with its own protection timing.',
			message: 'Independent',
		} ) ),
		formatBoundary,
		formatRemoveQuestion,
	} );
}
