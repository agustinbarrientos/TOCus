import type { OnboardingPageShell } from '../../../../apps/extension/src/features/onboarding/services/onboarding-page/types';
import type { Language } from '../../../../apps/extension/src/domains/preferences/types';

/**
 * Original onboarding capture states, all rendered through the production controller.
 * @since 1.0.0
 */
export const OnboardingVisualScenario = {
	LANGUAGE: 'language',
	APPEARANCE: 'appearance',
	SITES: 'sites',
	RECOVERY: 'recovery',
	COMPLETED_LANGUAGE: 'completed-language',
} as const;

/**
 * A named original onboarding state.
 * @since 1.0.0
 */
export type OnboardingVisualScenario = typeof OnboardingVisualScenario[ keyof typeof OnboardingVisualScenario ];

declare global {
	/** Test-only control boundary, never bundled into the extension entrypoints. */
	interface Window {
		onboardingOriginal: OnboardingPageShell;
		/** Calls the mounted production controller without going through its disabled button. */
		finishOriginalOnboarding: () => Promise<void>;
		/** Applies the archived locale-copy and unfocused native-input changes in one browser turn. */
		prepareOriginalSitesInput: ( language: Language, address: string ) => Promise<void>;
	}
}
