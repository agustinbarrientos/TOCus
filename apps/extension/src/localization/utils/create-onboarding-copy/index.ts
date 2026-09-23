import type { I18n } from '@lingui/core';
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
 * @since 1.0.0 Initial implementation.
 */
export function createOnboardingCopy( i18n: I18n ): Readonly<OnboardingShellCopy> {
	/**
	 * Formats accessible progress for the current onboarding step.
	 * @param currentStep - One-based current step.
	 * @param totalSteps - Total number of onboarding steps.
	 * @param stepName - Localized current-step name.
	 * @return Localized onboarding progress.
	 * @since 1.0.0 Initial implementation.
	 */
	function formatStepProgress(
		currentStep: number,
		totalSteps: number,
		stepName: string,
	): string {
		return i18n._( msg`Step ${ currentStep } of ${ totalSteps }: ${ stepName }` );
	}

	return Object.freeze( {
		introduction: i18n._( msg`Pause before visiting addictive websites` ),
		privacyTitle: i18n._( msg`100% private` ),
		privacyDescription: i18n._( msg`TOCus works without internet. Your data stays on this device and is never sent to other computers.` ),
		completionTitle: i18n._( msg`You're all set` ),
		completionDescription: i18n._( msg`TOCus is ready. You can close this tab or continue in Settings.` ),
		openSettingsLabel: i18n._( msg`Open Settings` ),
		startupErrorTitle: i18n._( msg`TOCus couldn't finish opening` ),
		startupErrorDescription: i18n._( msg`Try again, or continue in Settings.` ),
		retryLabel: i18n._( msg`Try again` ),
		progressLabel: i18n._( msg`Setup progress` ),
		stepNames: Object.freeze( {
			[ OnboardingStep.LANGUAGE ]: i18n._( msg`Language` ),
			[ OnboardingStep.APPEARANCE ]: i18n._( msg`Appearance` ),
			[ OnboardingStep.SITES ]: i18n._( msg`Websites` ),
		} ),
		preferenceSaveError: i18n._( msg`Your choice couldn't be saved. Try again.` ),
		language: createOnboardingLanguageStepCopy( i18n ),
		appearance: createOnboardingAppearanceStepCopy( i18n ),
		sites: createOnboardingSitesStepCopy( i18n ),
		formatStepProgress,
	} );
}
