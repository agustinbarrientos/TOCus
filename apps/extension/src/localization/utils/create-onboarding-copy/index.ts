import { type I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import {
	OnboardingStep,
	type OnboardingShellCopy,
} from '../../../features/onboarding/components/shell/types';
import { createOnboardingAppearanceStepCopy } from '../create-onboarding-appearance-step-copy';
import { createOnboardingLanguageStepCopy } from '../create-onboarding-language-step-copy';
import { createOnboardingSitesStepCopy } from '../create-onboarding-sites-step-copy';

/**
 * Creates complete localized first-install onboarding copy.
 * @param i18n - Locale-specific Lingui instance.
 * @return Complete localized onboarding-shell copy.
 * @since 0.1.0 Initial implementation.
 */
export function createOnboardingCopy( i18n: I18n ): Readonly<OnboardingShellCopy> {
	/**
	 * Formats accessible progress for the current onboarding step.
	 * @param currentStep - One-based current step.
	 * @param totalSteps - Total number of onboarding steps.
	 * @param stepName - Localized current-step name.
	 * @return Localized onboarding progress.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatStepProgress(
		currentStep: number,
		totalSteps: number,
		stepName: string,
	): string {
		return i18n._( msg`Step ${ currentStep } of ${ totalSteps }: ${ stepName }` );
	}

	return Object.freeze( {
		introduction: i18n._( msg`Create a gentle pause before the websites you choose.` ),
		privacyTitle: i18n._( msg`Private by design` ),
		privacyDescription: i18n._( msg`Your choices and statistics stay on this device. TOCus never reads your browsing history.` ),
		nonClinicalNote: i18n._( msg`TOCus is a focus aid, not medical treatment.` ),
		completionTitle: i18n._( msg`You're all set` ),
		completionDescription: i18n._( msg`TOCus is ready. You can close this tab or continue in Settings.` ),
		openSettingsLabel: i18n._( msg`Open Settings` ),
		startupErrorTitle: i18n._( msg`TOCus could not finish opening` ),
		startupErrorDescription: i18n._( msg`Try again, or continue in Settings.` ),
		retryLabel: i18n._( msg`Try again` ),
		progressLabel: i18n._( msg`Setup progress` ),
		stepNames: Object.freeze( {
			[ OnboardingStep.LANGUAGE ]: i18n._( msg`Language` ),
			[ OnboardingStep.APPEARANCE ]: i18n._( msg`Appearance` ),
			[ OnboardingStep.SITES ]: i18n._( msg`Websites` ),
		} ),
		preferenceSaveError: i18n._( msg`Your choice could not be saved. Try again.` ),
		settingsNote: i18n._( msg`You can change these choices and fine-tune timing or schedules any time in Settings.` ),
		language: createOnboardingLanguageStepCopy( i18n ),
		appearance: createOnboardingAppearanceStepCopy( i18n ),
		sites: createOnboardingSitesStepCopy( i18n ),
		formatStepProgress,
	} );
}
