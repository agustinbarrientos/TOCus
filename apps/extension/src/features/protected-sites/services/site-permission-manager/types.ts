import { type Browser } from 'wxt/browser';
import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { type ProtectedSiteRule } from '../../../../domains/protection/types/protected-site-rule';

/**
 * Permission request passed to the browser permissions API.
 * @since 0.1.0 Initial implementation.
 */
export interface SitePermissionDescriptor {
	permissions?: Browser.runtime.ManifestPermission[];
	origins: string[];
}

/**
 * Complete browser permission snapshot returned without prompting the user.
 * @since 0.1.0 Initial implementation.
 */
export interface SitePermissionGrantSnapshot {
	permissions?: Browser.runtime.ManifestPermission[];
	origins?: string[];
}

/**
 * Narrow browser permissions API used by protected-site settings.
 * @since 0.1.0 Initial implementation.
 */
export interface SitePermissionApi {
	/**
	 * Returns all current named and origin grants in one browser snapshot.
	 * @return Current optional permission grants.
	 * @since 0.1.0 Initial implementation.
	 */
	getAll: () => Promise<SitePermissionGrantSnapshot>;

	/**
	 * Reports whether every requested permission is already granted.
	 * @param permissions - Named and origin permissions to inspect.
	 * @return Whether the complete permission set is granted.
	 * @since 0.1.0 Initial implementation.
	 */
	contains: ( permissions: SitePermissionDescriptor ) => Promise<boolean>;

	/**
	 * Requests permissions during a user gesture.
	 * @param permissions - Named and origin permissions to request.
	 * @return Whether the user granted the complete permission set.
	 * @since 0.1.0 Initial implementation.
	 */
	request: ( permissions: SitePermissionDescriptor ) => Promise<boolean>;

	/**
	 * Removes permissions that are no longer required.
	 * @param permissions - Named and origin permissions to remove.
	 * @return Whether the browser removed the complete permission set.
	 * @since 0.1.0 Initial implementation.
	 */
	remove: ( permissions: SitePermissionDescriptor ) => Promise<boolean>;
}

/**
 * Stable outcomes returned by a protected-site permission request.
 * @since 0.1.0 Initial implementation.
 */
export const SitePermissionRequestStatus = {
	DENIED: 'denied',
	ERROR: 'error',
	GRANTED: 'granted',
} as const;

/**
 * Protected-site permission request outcome.
 * @since 0.1.0 Initial implementation.
 */
export type SitePermissionRequestStatus =
	typeof SitePermissionRequestStatus[ keyof typeof SitePermissionRequestStatus ];

/**
 * Stable provenance of browser access observed around a successful permission request.
 * @since 0.1.0 Initial implementation.
 */
export const SitePermissionGrantProvenance = {
	EXISTING: 'existing',
	NEW: 'new',
	UNKNOWN: 'unknown',
} as const;

/**
 * Provenance of browser access observed around a successful permission request.
 * @since 0.1.0 Initial implementation.
 */
export type SitePermissionGrantProvenance =
	typeof SitePermissionGrantProvenance[ keyof typeof SitePermissionGrantProvenance ];

/**
 * Successful protected-site permission request.
 * @since 0.1.0 Initial implementation.
 */
export interface GrantedSitePermissionRequestResult {
	status: typeof SitePermissionRequestStatus.GRANTED;
	provenance: SitePermissionGrantProvenance;
}

/**
 * Unsuccessful protected-site permission request.
 * @since 0.1.0 Initial implementation.
 */
export interface UnsuccessfulSitePermissionRequestResult {
	status: typeof SitePermissionRequestStatus.DENIED | typeof SitePermissionRequestStatus.ERROR;
}

/**
 * Complete protected-site permission request result.
 * @since 0.1.0 Initial implementation.
 */
export type SitePermissionRequestResult =
	GrantedSitePermissionRequestResult |
	UnsuccessfulSitePermissionRequestResult;

/**
 * Stable outcomes returned when releasing protected-site permissions.
 * @since 0.1.0 Initial implementation.
 */
export const SitePermissionReleaseStatus = {
	ERROR: 'error',
	RELEASED: 'released',
	RETAINED: 'retained',
} as const;

/**
 * Protected-site permission release outcome.
 * @since 0.1.0 Initial implementation.
 */
export type SitePermissionReleaseStatus =
	typeof SitePermissionReleaseStatus[ keyof typeof SitePermissionReleaseStatus ];

/**
 * Browser permission manager for configured protected sites.
 * @since 0.1.0 Initial implementation.
 */
export interface SitePermissionManager {
	/**
	 * Filters one runtime projection to sites with complete current browser access.
	 * @param configuration - Validated persisted protection configuration.
	 * @return Valid configuration containing only currently accessible sites.
	 * @since 0.1.0 Initial implementation.
	 */
	filterConfiguration(
		configuration: ProtectionConfigurationDocument,
	): Promise<ProtectionConfigurationDocument>;

	/**
	 * Reports whether one rule has navigation observation and every required origin.
	 * @param rule - Canonical protected-site rule to inspect.
	 * @return Whether the complete browser permission descriptor is granted.
	 * @since 0.1.0 Initial implementation.
	 */
	hasAccess( rule: ProtectedSiteRule ): Promise<boolean>;

	/**
	 * Requests the exact browser capabilities required by one rule.
	 * @param rule - Canonical protected-site rule selected by the user.
	 * @return Explicit grant, denial, or browser-error result.
	 * @since 0.1.0 Initial implementation.
	 */
	request( rule: ProtectedSiteRule ): Promise<SitePermissionRequestResult>;

	/**
	 * Releases one rule's origins and the shared navigation capability when no sites remain.
	 * @param rule - Removed canonical protected-site rule.
	 * @param hasRemainingSites - Whether another configured protected site remains.
	 * @return Explicit released, retained, or browser-error result.
	 * @since 0.1.0 Initial implementation.
	 */
	release( rule: ProtectedSiteRule, hasRemainingSites: boolean ): Promise<SitePermissionReleaseStatus>;
}

/**
 * Dependencies used by the protected-site permission manager.
 * @since 0.1.0 Initial implementation.
 */
export interface SitePermissionManagerOptions {
	permissions: SitePermissionApi;
}
