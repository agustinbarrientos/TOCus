/**
 * Stable enrollment errors rendered by the popup.
 * @since 0.1.0 Initial implementation.
 */
export const PopupOperationError = {
	PERMISSION_DENIED: 'permission-denied',
	PERMISSION_ERROR: 'permission-error',
	PERMISSION_RETAINED: 'permission-retained',
	SAVE_ERROR: 'save-error',
} as const;

/**
 * Enrollment error rendered by the popup.
 * @since 0.1.0 Initial implementation.
 */
export type PopupOperationError = typeof PopupOperationError[ keyof typeof PopupOperationError ];

/**
 * Name of the composed event requesting enrollment of the current website.
 * @since 0.1.0 Initial implementation.
 */
export const PopupAddSiteRequestEventName = 'tocus-popup-add-site-request';

/**
 * Name of the composed event requesting a fresh popup projection.
 * @since 0.1.0 Initial implementation.
 */
export const PopupRetryRequestEventName = 'tocus-popup-retry-request';

/**
 * Localizable messages and duration formatters rendered by the extension popup.
 * @since 0.1.0 Initial implementation.
 */
export interface PopupShellCopy {
	/** Label above the current website identity. */
	currentWebsite: string;
	/** Status shown when the current website is not on the user's list. */
	noPauseHere: string;
	/** Status shown when the current website is configured and idle. */
	tocusActive: string;
	/** Status shown while the current website's pause is progressing. */
	pauseInProgress: string;
	/** Status shown while the current website's visit window is open. */
	visitWindowOpen: string;
	/** Status shown while the current website's schedule is inactive. */
	offRightNow: string;
	/** Status shown when a configured website no longer has browser access. */
	browserAccessNeeded: string;
	/** Status shown when schedule evaluation cannot be trusted. */
	statusUnavailable: string;
	/** Message shown for browser-controlled and private pages. */
	unsupportedPage: string;
	/** Message shown when active-tab metadata is unavailable. */
	currentWebsiteUnavailable: string;
	/** Label for an idle scope's next pause duration. */
	nextPause: string;
	/** Heading above currently active timing scopes. */
	activeTiming: string;
	/** Name of the default shared timing scope. */
	sharedTiming: string;
	/** Accessible marker for the current website's active scope. */
	currentScope: string;
	/** Label for a focused pause timer. */
	pause: string;
	/** Label for a wall-clock visit-window timer. */
	visitWindow: string;
	/** Action that enrolls the current website. */
	addPauseHere: string;
	/** Pending label while the current website is being enrolled. */
	addingPause: string;
	/** Action that opens the current website's settings. */
	manageWebsite: string;
	/** Navigation label for Settings. */
	settings: string;
	/** Navigation label for Statistics. */
	statistics: string;
	/** Recovery action label. */
	retry: string;
	/** Pending recovery action label. */
	retrying: string;
	/** Heading shown when runtime status cannot load. */
	unavailableTitle: string;
	/** Supporting message shown when runtime status cannot load. */
	unavailableDescription: string;
	/** Error shown after the user declines required browser access. */
	permissionDeniedError: string;
	/** Error shown when browser access cannot be confirmed. */
	permissionError: string;
	/** Error shown when unsuccessful enrollment may have retained browser access. */
	permissionRetainedError: string;
	/** Error shown when enrollment cannot be persisted. */
	saveError: string;
	/**
	 * Formats one nonnegative timer duration as localized minutes and seconds.
	 * @param milliseconds - Remaining duration in milliseconds.
	 * @return Compact localized countdown.
	 * @since 0.1.0 Initial implementation.
	 */
	formatCountdown( milliseconds: number ): string;
	/**
	 * Formats one next-pause duration as a localized whole-second value.
	 * @param milliseconds - Next pause duration in milliseconds.
	 * @return Localized duration.
	 * @since 0.1.0 Initial implementation.
	 */
	formatNextPause( milliseconds: number ): string;
	/**
	 * Formats the number of websites using one shared scope.
	 * @param count - Positive website count.
	 * @return Localized website count.
	 * @since 0.1.0 Initial implementation.
	 */
	formatWebsiteCount( count: number ): string;
}
