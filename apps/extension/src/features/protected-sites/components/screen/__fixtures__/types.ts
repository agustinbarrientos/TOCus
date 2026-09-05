import { type ProtectionConfigurationStorageService } from '../../../../../domains/protection/services/protection-configuration-storage';
import { type ProtectionConfigurationDocument } from '../../../../../domains/protection/types/protected-site-configuration';
import { type SiteFaviconProvider } from '../../../services/site-favicon-provider';
import { type SitePermissionManager } from '../../../services/site-permission-manager';

/**
 * Runtime constructor used to validate one queried test element.
 * @since 0.1.0 Initial implementation.
 */
export interface ElementConstructor<T extends Element> {
	new(): T;
}

/**
 * Optional dependencies supplied to one connected screen fixture.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectedSitesScreenFixtureOptions {
	storage: ProtectionConfigurationStorageService;
	faviconProvider?: SiteFaviconProvider | null;
	permissionManager?: SitePermissionManager | null;
}

/**
 * Controllable in-memory storage shared by screen component fixtures.
 * @since 0.1.0 Initial implementation.
 */
export interface MemoryProtectedSitesScreenStorage extends ProtectionConfigurationStorageService {
	/**
	 * Current local configuration or malformed-data marker.
	 * @since 0.1.0 Initial implementation.
	 */
	configuration: ProtectionConfigurationDocument | null;

	/**
	 * Whether the next and later reads reject.
	 * @since 0.1.0 Initial implementation.
	 */
	rejectLoads: boolean;

	/**
	 * Whether the next and later writes reject.
	 * @since 0.1.0 Initial implementation.
	 */
	rejectSaves: boolean;

	/**
	 * Number of successful writes completed by this fixture.
	 * @since 0.1.0 Initial implementation.
	 */
	writes: number;
}
