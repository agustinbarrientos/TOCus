import type { WebsiteDetailsDraft } from '../../utils/website-draft/types';
import type { Ref } from 'react';
import type { ScheduleScreenCopy } from '../../../settings/components/schedule-screen/types';
import type { NormalizedSchedule } from '../../../../domains/protection/types/protection-schedule';

import type {
	ProtectedSiteConfiguration,
	ProtectionConfigurationDocument,
} from '../../../../domains/protection/types/protected-site-configuration';
import type { CanonicalHost } from '../../../../domains/protection/types/protected-site-rule';
import type { SitePermissionReleaseStatus } from '../../services/site-permission-manager';
import type { SiteItemEditorSnapshot } from '../../services/site-item-editor/types';

/**
 * Stable event name emitted after one protected-site configuration change is persisted.
 * @since 1.0.0 Initial implementation.
 */
export const ProtectedSiteConfigurationChangedEventName = 'tocus-protected-site-configuration-changed';

/**
 * Stable event name emitted after browser access is restored for one protected site.
 * @since 1.0.0 Initial implementation.
 */
export const ProtectedSiteAccessRestoredEventName = 'tocus-protected-site-access-restored';

/**
 * Details emitted after browser access is restored for one protected site.
 * @since 1.0.0 Initial implementation.
 */
export interface ProtectedSiteAccessRestoredEventDetail {
	identityHost: CanonicalHost;
}

/**
 * Stable protected-site change kinds announced to the owning screen.
 * @since 1.0.0 Initial implementation.
 */
export const ProtectedSiteConfigurationChangeKind = {
	REMOVED: 'removed',
	UPDATED: 'updated',
} as const;

/**
 * Protected-site change kind announced to the owning screen.
 * @since 1.0.0 Initial implementation.
 */
export type ProtectedSiteConfigurationChangeKind =
	typeof ProtectedSiteConfigurationChangeKind[ keyof typeof ProtectedSiteConfigurationChangeKind ];

/**
 * Stable operation failures retained by one protected-site item.
 * @since 1.0.0 Initial implementation.
 */
export const ProtectedSiteItemOperationErrorReason = {
	ACCESS_REQUEST: 'access-request',
	CONFIGURATION_CHANGED: 'configuration-changed',
	OPERATION: 'operation',
} as const;

/**
 * Operation failure retained by one protected-site item.
 * @since 1.0.0 Initial implementation.
 */
export type ProtectedSiteItemOperationErrorReason = typeof ProtectedSiteItemOperationErrorReason[
	keyof typeof ProtectedSiteItemOperationErrorReason
];

/**
 * Details emitted after one protected-site configuration change is persisted.
 * @since 1.0.0 Initial implementation.
 */
export interface UpdatedProtectedSiteConfigurationChangedEventDetail {
	kind: typeof ProtectedSiteConfigurationChangeKind.UPDATED;
	identityHost: CanonicalHost;
	configuration: ProtectionConfigurationDocument;
}

/**
 * Details emitted after one protected-site removal and its permission cleanup complete.
 * @since 1.0.0 Initial implementation.
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
 * @since 1.0.0 Initial implementation.
 */
export type ProtectedSiteConfigurationChangedEventDetail =
	UpdatedProtectedSiteConfigurationChangedEventDetail |
	RemovedProtectedSiteConfigurationChangedEventDetail;

/**
 * Form submission event whose current target is the protected-site edit form.
 * @since 1.0.0 Initial implementation.
 */
export interface ProtectedSiteEditSubmitEvent extends SubmitEvent {
	readonly currentTarget: HTMLFormElement;
}

/**
 * Edit input event whose current target is the form owning the listener.
 * @since 1.0.0 Initial implementation.
 */
export interface ProtectedSiteEditInputEvent extends Event {
	readonly currentTarget: HTMLFormElement;
}

/**
 * Localizable protected-site item messages.
 * @since 1.0.0 Initial implementation.
 */
export interface ProtectedSiteItemCopy {
	done: string;
	accessRequired: string;
	allowAccess: string;
	allowingAccess: string;
	accessRequestError: string;
	edit: string;
	displayNameLabel: string;
	customScheduleLabel: string;
	automaticNamePlaceholder: string;
	saveChanges: string;
	saving: string;
	cancel: string;
	removeSite: string;
	keepSite: string;
	confirmRemove: string;
	operationError: string;
	configurationChangedError: string;
	/**
	 * Formats the accessible selection label for one website.
	 * @param name - Current resolved display name.
	 * @return Human-readable selection label.
	 * @since 1.0.0 Initial implementation.
	 */
	formatSelectSite( name: string ): string;
	/**
	 * Formats one removal confirmation heading.
	 * @param name - Current resolved display name.
	 * @return Human-readable removal question.
	 * @since 1.0.0 Initial implementation.
	 */
	formatRemoveQuestion( name: string ): string;
}
/**
 * Controlled page-draft changes emitted without persistence or permission side effects.
 * @since 1.0.0 Initial implementation.
 */
export interface ProtectedSiteDraftChangedEventDetail {
	identityHost: string;
	displayName?: string;
	schedule?: NormalizedSchedule;
	removed?: boolean;
}


/**
 * Controlled flat website row and its explicit edit/access actions.
 * @since 1.0.0
 */
export interface WebsiteItemProps {
	/** Optional selection owned by the settings page, outside the row's identity grid. */
	selection?: WebsiteItemSelection;
	/** Allows the owner to reveal this row after an already-listed address is submitted. */
	itemRef?: Ref<HTMLLIElement>;
	/** Brief, non-animated emphasis after a duplicate-add attempt. */
	highlighted?: boolean;
	persistedEditing?: WebsiteItemPersistence;
	site: ProtectedSiteConfiguration;
	copy: ProtectedSiteItemCopy;
	scheduleCopy: ScheduleScreenCopy;
	globalSchedule: NormalizedSchedule;
	details?: WebsiteDetailsDraft;
	validate?: boolean;
	favicon: string | null;
	editing: boolean;
	disabled: boolean;
	accessRequired: boolean;
	accessPending: boolean;
	accessDisabled: boolean;
	onEdit: () => void;
	onDone?: () => void;
	onGrant: () => void;
	onRemove: () => void;
	onChange: ( details: WebsiteDetailsDraft ) => void;
}

/**
 * Page-local selection state with no persistence or permission side effects.
 * @since 1.0.0
 */
export interface WebsiteItemSelection {
	checked: boolean;
	active: boolean;
	onChange: ( checked: boolean ) => void;
}

/**
 * Optional item-owned transaction presentation supplied by the standalone binding.
 * @since 1.0.0
 */
export interface WebsiteItemPersistence {
	state: Readonly<SiteItemEditorSnapshot>;
	save: () => void;
	cancel: () => void;
}
