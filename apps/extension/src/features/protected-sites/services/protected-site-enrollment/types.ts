import { z } from 'zod';
import type {
	ProtectionConfigurationEditRejectionReason,
	ProtectionConfigurationEditor,
} from '../../../../domains/protection/services/protection-configuration-editor';
import type {
	ProtectedSiteConfiguration,
	ProtectionConfigurationDocument,
} from '../../../../domains/protection/types/protected-site-configuration';
import type {
	SitePermissionManager,
	SitePermissionReleaseStatus,
} from '../site-permission-manager';

/**
 * Validates user-entered site strings before batch canonicalization and browser consent.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectedSiteBatchInputsSchema = z.array( z.string() );

/**
 * Stable outcomes returned by protected-site enrollment.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectedSiteEnrollmentStatus = {
	ADDED: 'added',
	PERMISSION_DENIED: 'permission-denied',
	PERMISSION_ERROR: 'permission-error',
	PERMISSION_RETAINED: 'permission-retained',
	REJECTED: 'rejected',
	REMOVED: 'removed',
	SAVE_ERROR: 'save-error',
	SAVED: 'saved',
} as const;

/**
 * Outcome returned by protected-site enrollment.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectedSiteEnrollmentStatus =
	typeof ProtectedSiteEnrollmentStatus[ keyof typeof ProtectedSiteEnrollmentStatus ];

/**
 * Successful protected-site enrollment result.
 * @since 0.1.0 Initial implementation.
 */
export interface AddedProtectedSiteEnrollmentResult {
	status: typeof ProtectedSiteEnrollmentStatus.ADDED;
	configuration: ProtectionConfigurationDocument;
	site: ProtectedSiteConfiguration;
}

/**
 * Successful atomic enrollment of shared protected sites.
 * @since 0.1.0 Initial implementation.
 */
export interface AddedProtectedSiteBatchEnrollmentResult {
	status: typeof ProtectedSiteEnrollmentStatus.ADDED;
	configuration: ProtectionConfigurationDocument;
	sites: ProtectedSiteConfiguration[];
}

/**
 * Domain-rejected protected-site enrollment result.
 * @since 0.1.0 Initial implementation.
 */
export interface RejectedProtectedSiteEnrollmentResult {
	status: typeof ProtectedSiteEnrollmentStatus.REJECTED;
	reason: ProtectionConfigurationEditRejectionReason;
}

/**
 * Protected-site enrollment result that failed outside domain validation.
 * @since 0.1.0 Initial implementation.
 */
export interface FailedProtectedSiteEnrollmentResult {
	status:
		typeof ProtectedSiteEnrollmentStatus.PERMISSION_DENIED |
		typeof ProtectedSiteEnrollmentStatus.PERMISSION_ERROR |
		typeof ProtectedSiteEnrollmentStatus.PERMISSION_RETAINED |
		typeof ProtectedSiteEnrollmentStatus.SAVE_ERROR;
}

/**
 * Complete protected-site enrollment result.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectedSiteEnrollmentResult =
	AddedProtectedSiteEnrollmentResult |
	RejectedProtectedSiteEnrollmentResult |
	FailedProtectedSiteEnrollmentResult;

/**
 * Protected-site enrollment result that can be presented as an error.
 * @since 0.1.0 Initial implementation.
 */
export type UnsuccessfulProtectedSiteEnrollmentResult =
	RejectedProtectedSiteEnrollmentResult |
	FailedProtectedSiteEnrollmentResult;

/**
 * Complete result from one atomic protected-site batch enrollment.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectedSiteBatchEnrollmentResult =
	AddedProtectedSiteBatchEnrollmentResult | UnsuccessfulProtectedSiteEnrollmentResult;

/**
 * Saved website draft including any obsolete access retained by the browser.
 * @since 0.1.0 Initial implementation.
 */
export interface SavedProtectedSiteDraftResult {
	status: typeof ProtectedSiteEnrollmentStatus.SAVED;
	configuration: ProtectionConfigurationDocument;
	permissionReleaseStatus: SitePermissionReleaseStatus;
}

/**
 * Result of committing a page draft.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectedSiteDraftSaveResult = UnsuccessfulProtectedSiteEnrollmentResult | SavedProtectedSiteDraftResult;

/**
 * Mutable permission settlement tracked across the coordinated draft save.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectedSiteDraftSettlementState {
	finalized: boolean;
	verificationFailed: boolean;
	retained: boolean;
	releaseStatus: SitePermissionReleaseStatus;
}

/**
 * Successful protected-site removal with its permission cleanup outcome.
 * @since 0.1.0 Initial implementation.
 */
export interface RemovedProtectedSiteEnrollmentResult {
	status: typeof ProtectedSiteEnrollmentStatus.REMOVED;
	configuration: ProtectionConfigurationDocument;
	permissionReleaseStatus: SitePermissionReleaseStatus;
	site: ProtectedSiteConfiguration;
}

/**
 * Complete protected-site removal result.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectedSiteRemovalResult =
	RemovedProtectedSiteEnrollmentResult |
	RejectedProtectedSiteEnrollmentResult;

/**
 * Dependencies used by protected-site enrollment.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectedSiteEnrollmentServiceOptions {
	editor: ProtectionConfigurationEditor;
	permissionManager: SitePermissionManager;
}

/**
 * Coordinates browser access and protected-site persistence.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectedSiteEnrollmentService {
	/** Requests new origins from the current gesture and persists one complete site draft. */
	saveDraft( expectedSites: unknown, nextSites: unknown ): Promise<ProtectedSiteDraftSaveResult>;
	/**
	 * Adds one protected site after securing its required browser access.
	 * @param siteInput - Unknown user-entered hostname or URL.
	 * @param independent - Whether the site receives its own protection scope.
	 * @return Successful enrollment or a presentation-neutral failure.
	 * @since 0.1.0 Initial implementation.
	 */
	add(
		siteInput: unknown,
		independent: boolean,
	): Promise<ProtectedSiteEnrollmentResult>;

	/**
	 * Adds unique shared sites with one browser permission request and one configuration write.
	 * @param siteInputs - User-entered hostnames or HTTP(S) URLs.
	 * @return Successful batch enrollment or a presentation-neutral failure.
	 * @since 0.1.0 Initial implementation.
	 */
	addMany( siteInputs: readonly string[] ): Promise<ProtectedSiteBatchEnrollmentResult>;

	/**
	 * Removes one protected site and reconciles its browser access before coordination is released.
	 * @param site - Protected-site configuration selected for removal.
	 * @return Successful removal and permission outcome, or a stable rejection.
	 * @since 0.1.0 Initial implementation.
	 */
	remove( site: ProtectedSiteConfiguration ): Promise<ProtectedSiteRemovalResult>;
}
