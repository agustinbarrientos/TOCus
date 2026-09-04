import { type ProtectedSiteConfiguration } from '../../../../domains/protection/types/protected-site-configuration';
import { type SiteFaviconSource } from '../../services/site-favicon-provider';
import { type SiteDisplayIdentity } from '../../utils/site-display-name-resolver';

/**
 * Protected site with its fully resolved local presentation.
 * @since 0.1.0 Initial implementation.
 */
export interface PresentedProtectedSite {
	site: ProtectedSiteConfiguration;
	identity: SiteDisplayIdentity;
	faviconSource: SiteFaviconSource;
	accessGranted: boolean;
}

/**
 * Localizable messages rendered by the grouped protected-site list.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectedSiteListCopy {
	emptyTitle: string;
	emptyDescription: string;
	sharedGroupTitle: string;
	sharedGroupDescription: string;
	independentGroupTitle: string;
	independentGroupDescription: string;
	/**
	 * Compares two display names using the selected language's collation rules.
	 * @param firstName - First display name.
	 * @param secondName - Second display name.
	 * @return Negative, zero, or positive locale-aware ordering result.
	 * @since 0.1.0 Initial implementation.
	 */
	compareNames( firstName: string, secondName: string ): number;
}
