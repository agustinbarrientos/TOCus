import {
	type ProtectedSiteConfiguration,
	type ProtectionConfigurationDocument,
} from '../../../../domains/protection/types/protected-site-configuration';
import { type CanonicalHost } from '../../../../domains/protection/types/protected-site-rule';
import { type SitePermissionReleaseStatus } from '../../services/site-permission-manager';

/**
 * Stable event name emitted after one protected-site configuration change is persisted.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectedSiteConfigurationChangedEventName = 'tocus-protected-site-configuration-changed';

/**
 * Stable event name emitted after browser access is restored for one protected site.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectedSiteAccessRestoredEventName = 'tocus-protected-site-access-restored';

/**
 * Details emitted after browser access is restored for one protected site.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectedSiteAccessRestoredEventDetail {
	identityHost: CanonicalHost;
}

/**
 * Stable protected-site change kinds announced to the owning screen.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectedSiteConfigurationChangeKind = {
	REMOVED: 'removed',
	UPDATED: 'updated',
} as const;

/**
 * Protected-site change kind announced to the owning screen.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectedSiteConfigurationChangeKind =
	typeof ProtectedSiteConfigurationChangeKind[ keyof typeof ProtectedSiteConfigurationChangeKind ];

/**
 * Stable operation failures retained by one protected-site item.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectedSiteItemOperationErrorReason = {
	ACCESS_REQUEST: 'access-request',
	CONFIGURATION_CHANGED: 'configuration-changed',
	OPERATION: 'operation',
} as const;

/**
 * Operation failure retained by one protected-site item.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectedSiteItemOperationErrorReason = typeof ProtectedSiteItemOperationErrorReason[
	keyof typeof ProtectedSiteItemOperationErrorReason
];

/**
 * Details emitted after one protected-site configuration change is persisted.
 * @since 0.1.0 Initial implementation.
 */
export interface UpdatedProtectedSiteConfigurationChangedEventDetail {
	kind: typeof ProtectedSiteConfigurationChangeKind.UPDATED;
	identityHost: CanonicalHost;
	configuration: ProtectionConfigurationDocument;
}

/**
 * Details emitted after one protected-site removal and its permission cleanup complete.
 * @since 0.1.0 Initial implementation.
 */
export interface RemovedProtectedSiteConfigurationChangedEventDetail {
	kind: typeof ProtectedSiteConfigurationChangeKind.REMOVED;
	identityHost: CanonicalHost;
	configuration: ProtectionConfigurationDocument;
	permissionReleaseStatus: SitePermissionReleaseStatus;
	site: ProtectedSiteConfiguration;
}

/**
 * Details emitted after one protected-site configuration change is persisted.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectedSiteConfigurationChangedEventDetail =
	UpdatedProtectedSiteConfigurationChangedEventDetail |
	RemovedProtectedSiteConfigurationChangedEventDetail;

/**
 * Form submission event whose current target is the protected-site edit form.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectedSiteEditSubmitEvent extends SubmitEvent {
	readonly currentTarget: HTMLFormElement;
}

/**
 * Localizable protected-site item messages.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectedSiteItemCopy {
	accessRequired: string;
	allowAccess: string;
	allowingAccess: string;
	accessRequestError: string;
	edit: string;
	displayNameLabel: string;
	useAutomaticName: string;
	behaviorLegend: string;
	sharedBehavior: string;
	sharedBehaviorDescription: string;
	independentBehavior: string;
	independentBehaviorDescription: string;
	saveChanges: string;
	saving: string;
	cancel: string;
	removeSite: string;
	keepSite: string;
	confirmRemove: string;
	operationError: string;
	configurationChangedError: string;
	sharedLabel: string;
	independentLabel: string;
	/**
	 * Formats the protection boundary shown below one site.
	 * @param host - Canonical protection host.
	 * @param includesSubdomains - Whether descendants are protected.
	 * @return Human-readable boundary explanation.
	 * @since 0.1.0 Initial implementation.
	 */
	formatBoundary( host: string, includesSubdomains: boolean ): string;
	/**
	 * Formats one inline removal question.
	 * @param name - Current resolved display name.
	 * @return Human-readable removal question.
	 * @since 0.1.0 Initial implementation.
	 */
	formatRemoveQuestion( name: string ): string;
}
