import {
	DefaultProtectedSiteListCopy,
	type ProtectedSiteListCopy,
} from '../site-list/types';

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

/**
 * Formats the default addition announcement.
 * @param name - Resolved local site name.
 * @return Human-readable addition announcement.
 * @since 0.1.0 Initial implementation.
 */
function formatAddedAnnouncement( name: string ): string {
	return `${ name } was added to protected sites.`;
}

/**
 * Formats the default update announcement.
 * @param name - Resolved local site name.
 * @return Human-readable update announcement.
 * @since 0.1.0 Initial implementation.
 */
function formatUpdatedAnnouncement( name: string ): string {
	return `${ name } was updated.`;
}

/**
 * Formats the default removal announcement.
 * @param name - Resolved local site name.
 * @return Human-readable removal announcement.
 * @since 0.1.0 Initial implementation.
 */
function formatRemovedAnnouncement( name: string ): string {
	return `${ name } was removed from protected sites.`;
}

/**
 * Formats the default permission-retention announcement.
 * @param name - Resolved local site name.
 * @return Human-readable permission-retention announcement.
 * @since 0.1.0 Initial implementation.
 */
function formatPermissionRetainedAnnouncement( name: string ): string {
	return `${ name } was removed, but its browser access could not be removed automatically.`;
}

/**
 * Formats the default browser-access restoration announcement.
 * @param name - Resolved local site name.
 * @return Human-readable access-restoration announcement.
 * @since 0.1.0 Initial implementation.
 */
function formatAccessRestoredAnnouncement( name: string ): string {
	return `${ name } access was restored.`;
}

/**
 * Default English messages for the Protected Sites screen.
 * @since 0.1.0 Initial implementation.
 */
export const DefaultProtectedSitesScreenCopy: Readonly<ProtectedSitesScreenCopy> = Object.freeze( {
	...DefaultProtectedSiteListCopy,
	eyebrow: 'Protection',
	title: 'Protected sites',
	introduction: 'Choose the websites where a calm pause can help you return to your intentions.',
	addressLabel: 'Website address',
	addressPlaceholder: 'example.com',
	addSite: 'Add site',
	addingSite: 'Adding...',
	addressHelp: 'Enter a website address or domain. Whole-domain protection includes its subdomains.',
	behaviorLegend: 'How should this site behave?',
	sharedBehavior: 'Share protection',
	sharedBehaviorDescription: 'Use the same wait and allowance as your other protected sites.',
	independentBehavior: 'Protect independently',
	independentBehaviorDescription: 'Give this site its own wait and allowance.',
	loading: 'Loading protected sites...',
	invalidSiteError: 'Enter a valid website address, such as example.com.',
	alreadyProtectedError: 'This website is already protected by an existing rule.',
	invalidConfigurationError: 'Your protected-site data changed. Retry before adding this site.',
	invalidScopeError: 'TOCus could not create independent protection for this site.',
	invalidDisplayNameError: 'The website name is not valid.',
	siteNotFoundError: 'This protected site no longer exists.',
	saveError: 'This website could not be saved. Your entry is still here.',
	permissionDeniedError: 'Browser access is required to protect this website. Nothing was saved.',
	permissionRequestError: 'Browser access could not be requested. Nothing was saved.',
	permissionRetainedError: 'This website could not be saved. Its browser access may still be active.',
	malformedDataTitle: 'Protected sites need your attention',
	malformedDataDescription: 'Your local protected-site data is not valid, so it was not replaced.',
	loadErrorTitle: 'Protected sites could not load',
	loadErrorDescription: 'TOCus could not load local settings. Nothing was changed.',
	retry: 'Try again',
	formatAddedAnnouncement,
	formatUpdatedAnnouncement,
	formatRemovedAnnouncement,
	formatPermissionRetainedAnnouncement,
	formatAccessRestoredAnnouncement,
} );
