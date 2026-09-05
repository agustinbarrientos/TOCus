import { type Language } from '../../../../domains/preferences/types';

/**
 * Stable language families shown before regional or conversational variants.
 * @since 0.1.0 Initial implementation.
 */
export const OnboardingLanguageFamily = {
	ENGLISH: 'en',
	SPANISH: 'es',
	PORTUGUESE: 'pt',
	ITALIAN: 'it',
	FRENCH: 'fr',
	GERMAN: 'de',
	JAPANESE: 'ja',
	RUSSIAN: 'ru',
} as const;

/**
 * Language family shown during onboarding.
 * @since 0.1.0 Initial implementation.
 */
export type OnboardingLanguageFamily = typeof OnboardingLanguageFamily[
	keyof typeof OnboardingLanguageFamily
];

/**
 * Complete localizable messages rendered by the onboarding Language step.
 * @since 0.1.0 Initial implementation.
 */
export interface OnboardingLanguageStepCopy {
	title: string;
	introduction: string;
	languageLegend: string;
	languageLabels: Readonly<Record<OnboardingLanguageFamily, string>>;
	spanishVariantLegend: string;
	spanishTuLabel: string;
	spanishVosLabel: string;
	portugueseVariantLegend: string;
	portugueseBrazilLabel: string;
	portuguesePortugalLabel: string;
	continueLabel: string;
}

/**
 * Exact language selected by one onboarding Language-step event.
 * @since 0.1.0 Initial implementation.
 */
export interface OnboardingLanguageEventDetail {
	language: Language;
}

/**
 * Native input change whose current target is a Language-step radio control.
 * @since 0.1.0 Initial implementation.
 */
export interface OnboardingLanguageInputEvent extends Event {
	readonly currentTarget: HTMLInputElement;
}

/**
 * Native form submission from the onboarding Language step.
 * @since 0.1.0 Initial implementation.
 */
export interface OnboardingLanguageSubmitEvent extends SubmitEvent {
	readonly currentTarget: HTMLFormElement;
}

/**
 * Name of the composed event emitted after an exact language selection.
 * @since 0.1.0 Initial implementation.
 */
export const OnboardingLanguageSelectEventName = 'tocus-onboarding-language-select';

/**
 * Name of the composed event emitted when the selected language should be persisted.
 * @since 0.1.0 Initial implementation.
 */
export const OnboardingLanguageContinueEventName = 'tocus-onboarding-language-continue';
