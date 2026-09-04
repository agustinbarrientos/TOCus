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
}

/**
 * Default English messages for the grouped protected-site list.
 * @since 0.1.0 Initial implementation.
 */
export const DefaultProtectedSiteListCopy: Readonly<ProtectedSiteListCopy> = Object.freeze( {
	emptyTitle: 'No protected sites yet',
	emptyDescription: 'Add the first site you want TOCus to gently interrupt.',
	sharedGroupTitle: 'Shared protection',
	sharedGroupDescription: 'These sites share one wait ladder and allowance.',
	independentGroupTitle: 'Independent sites',
	independentGroupDescription: 'Each of these sites keeps its own wait ladder and allowance.',
} );
