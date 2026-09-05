import {
	type Palette,
	type ThemeMode,
} from '../../../../domains/preferences/types';
import { type AppearanceControlsCopy } from '../../../preferences/components/appearance-controls/types';

/**
 * Complete localizable messages rendered by the onboarding Appearance step.
 * @since 0.1.0 Initial implementation.
 */
export interface OnboardingAppearanceStepCopy extends AppearanceControlsCopy {
	title: string;
	introduction: string;
	previewTitle: string;
	continueLabel: string;
}

/**
 * Exact appearance values selected by one onboarding Appearance-step event.
 * @since 0.1.0 Initial implementation.
 */
export interface OnboardingAppearanceEventDetail {
	theme: ThemeMode;
	palette: Palette;
}

/**
 * Native form submission from the onboarding Appearance step.
 * @since 0.1.0 Initial implementation.
 */
export interface OnboardingAppearanceSubmitEvent extends SubmitEvent {
	readonly currentTarget: HTMLFormElement;
}

/**
 * Name of the composed event emitted after an appearance selection.
 * @since 0.1.0 Initial implementation.
 */
export const OnboardingAppearanceSelectEventName = 'tocus-onboarding-appearance-select';

/**
 * Name of the composed event emitted when appearance choices should be persisted.
 * @since 0.1.0 Initial implementation.
 */
export const OnboardingAppearanceContinueEventName = 'tocus-onboarding-appearance-continue';
