import { type UnsuccessfulProtectedSiteEnrollmentResult } from '../../../protected-sites/services/protected-site-enrollment';
import { type ProtectedSiteConfiguration } from '../../../../domains/protection/types/protected-site-configuration';

/**
 * Focused row retained until its pending removal operation settles.
 * @since 0.1.0 Initial implementation.
 */
export interface OnboardingPendingSiteRemoval {
	readonly site: ProtectedSiteConfiguration;
	readonly index: number;
}

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
	finishHelp: string;
	removeSiteLabel: string;
	removalError: string;
	/**
	 * Formats one removed-site announcement.
	 * @param name - Local site display name.
	 * @return Localized removal status.
	 * @since 0.1.0 Initial implementation.
	 */
	formatRemovedAnnouncement( name: string ): string;
	/**
	 * Formats a removal whose browser access could not be released.
	 * @param name - Local site display name.
	 * @return Localized browser-access status.
	 * @since 0.1.0 Initial implementation.
	 */
	formatPermissionRetainedAnnouncement( name: string ): string;
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
 * Native address input event from the manual site field.
 * @since 0.1.0 Initial implementation.
 */
export interface OnboardingSiteInputEvent extends Event {
	readonly currentTarget: HTMLInputElement;
}

/**
 * Native removal click whose current target is the selected site's action.
 * @since 0.1.0 Initial implementation.
 */
export interface OnboardingSiteRemovalClickEvent extends MouseEvent {
	readonly currentTarget: HTMLButtonElement;
}

/**
 * Name of the composed event emitted when the user finishes onboarding.
 * @since 0.1.0 Initial implementation.
 */
export const OnboardingSitesFinishEventName = 'tocus-onboarding-sites-finish';
