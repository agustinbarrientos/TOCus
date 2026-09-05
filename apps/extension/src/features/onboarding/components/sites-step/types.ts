import { type UnsuccessfulProtectedSiteEnrollmentResult } from '../../../protected-sites/services/protected-site-enrollment';

/**
 * Presentation-neutral marker for an unexpected onboarding enrollment failure.
 * @since 0.1.0 Initial implementation.
 */
export const OnboardingSiteUnexpectedFailure = 'unexpected';

/**
 * Unexpected onboarding enrollment failure marker.
 * @since 0.1.0 Initial implementation.
 */
export type OnboardingSiteUnexpectedFailure = typeof OnboardingSiteUnexpectedFailure;

/**
 * Presentation-neutral onboarding enrollment failure retained across localization changes.
 * @since 0.1.0 Initial implementation.
 */
export type OnboardingEnrollmentFailure =
	| UnsuccessfulProtectedSiteEnrollmentResult
	| OnboardingSiteUnexpectedFailure;

/**
 * Complete localizable messages rendered by the onboarding Sites step.
 * @since 0.1.0 Initial implementation.
 */
export interface OnboardingSitesStepCopy {
	title: string;
	introduction: string;
	suggestionsLegend: string;
	manualLegend: string;
	addressLabel: string;
	addressPlaceholder: string;
	addressHelp: string;
	addSiteLabel: string;
	addingSiteLabel: string;
	invalidSiteError: string;
	alreadyProtectedError: string;
	permissionDeniedError: string;
	permissionRequestError: string;
	permissionRetainedError: string;
	saveError: string;
	unexpectedError: string;
	finishLabel: string;
	/**
	 * Formats the accessible action for one available suggestion.
	 * @param siteName - Fixed site brand name.
	 * @return Localized suggestion action.
	 * @since 0.1.0 Initial implementation.
	 */
	formatAddSuggestionLabel( siteName: string ): string;

	/**
	 * Formats the accessible status for one pending suggestion.
	 * @param siteName - Fixed site brand name.
	 * @return Localized pending suggestion status.
	 * @since 0.1.0 Initial implementation.
	 */
	formatAddingSuggestionLabel( siteName: string ): string;

	/**
	 * Formats the accessible status for one protected suggestion.
	 * @param siteName - Fixed site brand name.
	 * @return Localized protected suggestion status.
	 * @since 0.1.0 Initial implementation.
	 */
	formatAddedSuggestionLabel( siteName: string ): string;

	/**
	 * Formats one successful protected-site announcement.
	 * @param siteName - Site name displayed to the user.
	 * @return Localized success announcement.
	 * @since 0.1.0 Initial implementation.
	 */
	formatAddedAnnouncement( siteName: string ): string;
}

/**
 * Native suggestion click whose current target identifies one catalog entry.
 * @since 0.1.0 Initial implementation.
 */
export interface OnboardingSiteSuggestionClickEvent extends MouseEvent {
	readonly currentTarget: HTMLButtonElement;
}

/**
 * Native manual-site form submission.
 * @since 0.1.0 Initial implementation.
 */
export interface OnboardingSiteSubmitEvent extends SubmitEvent {
	readonly currentTarget: HTMLFormElement;
}

/**
 * Name of the composed event emitted when the user finishes onboarding.
 * @since 0.1.0 Initial implementation.
 */
export const OnboardingSitesFinishEventName = 'tocus-onboarding-sites-finish';
