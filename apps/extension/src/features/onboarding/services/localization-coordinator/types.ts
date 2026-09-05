import { type Language } from '../../../../domains/preferences/types';
import { type LocalizationBundle } from '../../../../localization';

/**
 * Applies one complete onboarding localization snapshot.
 * @since 0.1.0 Initial implementation.
 */
export type OnboardingLocalizationApplicator = (
	localization: Readonly<LocalizationBundle>,
) => void;

/**
 * Loads one complete onboarding localization snapshot.
 * @since 0.1.0 Initial implementation.
 */
export type OnboardingLocalizationLoader = (
	language: Language,
) => Promise<Readonly<LocalizationBundle>>;

/**
 * Dependencies required to coordinate onboarding localization requests.
 * @since 0.1.0 Initial implementation.
 */
export interface OnboardingLocalizationCoordinatorOptions {
	/** Applies the newest complete localization snapshot. */
	apply: OnboardingLocalizationApplicator;
	/** Loads one packaged localization snapshot. */
	load: OnboardingLocalizationLoader;
}

/**
 * Coordinates latest-only onboarding localization and navigation readiness.
 * @since 0.1.0 Initial implementation.
 */
export interface OnboardingLocalizationCoordinator {
	/**
	 * Starts or reuses one localization request.
	 * @param language - Exact language requested by the user or browser.
	 * @return Whether this request remained current and was applied.
	 * @since 0.1.0 Initial implementation.
	 */
	request( language: Language ): Promise<boolean>;
	/**
	 * Waits for one language only when it is still the newest selection.
	 * @param language - Exact language required before navigation.
	 * @return Whether the requested language is now applied.
	 * @since 0.1.0 Initial implementation.
	 */
	synchronize( language: Language ): Promise<boolean>;
}
