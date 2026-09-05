import { type Language } from '../../../../domains/preferences/types';
import { type OnboardingAppearanceStepCopy } from '../appearance-step/types';
import { type OnboardingLanguageStepCopy } from '../language-step/types';
import { type OnboardingSitesStepCopy } from '../sites-step/types';

/**
 * Stable steps shown by onboarding in approved product order.
 * @since 0.1.0 Initial implementation.
 */
export const OnboardingStep = {
	LANGUAGE: 'language',
	APPEARANCE: 'appearance',
	SITES: 'sites',
} as const;

/**
 * Current onboarding step.
 * @since 0.1.0 Initial implementation.
 */
export type OnboardingStep = typeof OnboardingStep[ keyof typeof OnboardingStep ];

/**
 * Waits for one exact onboarding language to become the applied localization.
 * @since 0.1.0 Initial implementation.
 */
export type OnboardingLanguageSynchronizer = (
	language: Language,
) => Promise<boolean>;

/**
 * Complete localizable messages rendered by onboarding and its three steps.
 * @since 0.1.0 Initial implementation.
 */
export interface OnboardingShellCopy {
	introduction: string;
	privacyTitle: string;
	privacyDescription: string;
	nonClinicalNote: string;
	completionTitle: string;
	completionDescription: string;
	openSettingsLabel: string;
	startupErrorTitle: string;
	startupErrorDescription: string;
	retryLabel: string;
	progressLabel: string;
	stepNames: Readonly<Record<OnboardingStep, string>>;
	preferenceSaveError: string;
	settingsNote: string;
	language: Readonly<OnboardingLanguageStepCopy>;
	appearance: Readonly<OnboardingAppearanceStepCopy>;
	sites: Readonly<OnboardingSitesStepCopy>;
	/**
	 * Formats accessible progress for the current onboarding step.
	 * @param currentStep - One-based current step.
	 * @param totalSteps - Total number of onboarding steps.
	 * @param stepName - Localized current-step name.
	 * @return Localized onboarding progress.
	 * @since 0.1.0 Initial implementation.
	 */
	formatStepProgress( currentStep: number, totalSteps: number, stepName: string ): string;
}

/**
 * Name of the composed event emitted after all onboarding steps finish.
 * @since 0.1.0 Initial implementation.
 */
export const OnboardingCompleteEventName = 'tocus-onboarding-complete';

/**
 * Name of the composed event emitted from the completion fallback Settings action.
 * @since 0.1.0 Initial implementation.
 */
export const OnboardingOpenSettingsEventName = 'tocus-onboarding-open-settings';

/**
 * Name of the composed event emitted from the startup-recovery Retry action.
 * @since 0.1.0 Initial implementation.
 */
export const OnboardingRetryEventName = 'tocus-onboarding-retry';
