import type { LocalDataGenerationArea } from '../../../../domains/local-data/services/local-data-generation';

/**
 * Query parameter carrying an already completed reset's local generation.
 * @since 1.0.0
 */
export const OnboardingResetQueryParameter = 'reset';

/**
 * Browser-local boundaries used to consume one reset completion handoff.
 * @since 1.0.0
 */
export interface OnboardingResetCompletionOptions {
	storageArea: LocalDataGenerationArea;
	pageWindow: Pick<Window, 'location' | 'history'>;
}

/**
 * Existing localized messages used by the onboarding completion snackbar.
 * @since 1.0.0
 */
export interface OnboardingNotificationCopy {
	dismissNotification: string;
	resetComplete: string;
}
