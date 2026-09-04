import { type ProtectedSiteListCopy } from '../site-list/types';

/**
 * Stable loading states rendered by the Protected Sites screen.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectedSitesScreenLoadStatus = {
	FAILED: 'failed',
	LOADING: 'loading',
	MALFORMED: 'malformed',
	READY: 'ready',
} as const;

/**
 * Current loading state rendered by the Protected Sites screen.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectedSitesScreenLoadStatus =
	typeof ProtectedSitesScreenLoadStatus[ keyof typeof ProtectedSitesScreenLoadStatus ];

/**
 * Stable polite statuses retained by the Protected Sites screen.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectedSitesScreenAnnouncementKind = {
	ACCESS_RESTORED: 'access-restored',
	ADDED: 'added',
	PERMISSION_RETAINED: 'permission-retained',
	REMOVED: 'removed',
	UPDATED: 'updated',
} as const;

/**
 * Polite status retained by the Protected Sites screen.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectedSitesScreenAnnouncementKind = typeof ProtectedSitesScreenAnnouncementKind[
	keyof typeof ProtectedSitesScreenAnnouncementKind
];

/**
 * Presentation-neutral protected-site status retained for the live region.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectedSitesScreenAnnouncement {
	kind: ProtectedSitesScreenAnnouncementKind;
	name: string;
}

/**
 * Add-site form submission whose current target is the rendered form.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectedSitesAddSubmitEvent extends SubmitEvent {
	readonly currentTarget: HTMLFormElement;
}

/**
 * Localizable messages rendered by the Protected Sites screen.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectedSitesScreenCopy extends ProtectedSiteListCopy {
	eyebrow: string;
	title: string;
	introduction: string;
	addressLabel: string;
	addressPlaceholder: string;
	addSite: string;
	addingSite: string;
	addressHelp: string;
	behaviorLegend: string;
	sharedBehavior: string;
	sharedBehaviorDescription: string;
	independentBehavior: string;
	independentBehaviorDescription: string;
	loading: string;
	invalidSiteError: string;
	alreadyProtectedError: string;
	invalidConfigurationError: string;
	invalidScopeError: string;
	invalidDisplayNameError: string;
	siteNotFoundError: string;
	saveError: string;
	permissionDeniedError: string;
	permissionRequestError: string;
	permissionRetainedError: string;
	malformedDataTitle: string;
	malformedDataDescription: string;
	loadErrorTitle: string;
	loadErrorDescription: string;
	retry: string;
	/**
	 * Formats the announcement emitted after one site is added.
	 * @param name - Resolved local site name.
	 * @return Human-readable addition announcement.
	 * @since 0.1.0 Initial implementation.
	 */
	formatAddedAnnouncement( name: string ): string;
	/**
	 * Formats the announcement emitted after one site is updated.
	 * @param name - Resolved local site name.
	 * @return Human-readable update announcement.
	 * @since 0.1.0 Initial implementation.
	 */
	formatUpdatedAnnouncement( name: string ): string;
	/**
	 * Formats the announcement emitted after one site is removed.
	 * @param name - Resolved local site name.
	 * @return Human-readable removal announcement.
	 * @since 0.1.0 Initial implementation.
	 */
	formatRemovedAnnouncement( name: string ): string;
	/**
	 * Formats the announcement emitted when a site is removed but browser access remains.
	 * @param name - Resolved local site name.
	 * @return Human-readable permission-retention announcement.
	 * @since 0.1.0 Initial implementation.
	 */
	formatPermissionRetainedAnnouncement( name: string ): string;
	/**
	 * Formats the announcement emitted after browser access is restored.
	 * @param name - Resolved local site name.
	 * @return Human-readable access-restoration announcement.
	 * @since 0.1.0 Initial implementation.
	 */
	formatAccessRestoredAnnouncement( name: string ): string;
}
