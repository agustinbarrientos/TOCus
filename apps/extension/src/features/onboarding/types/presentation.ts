import type { RefObject } from 'react';
import type { ProtectedSiteConfiguration } from '../../../domains/protection/types/protected-site-configuration';
import type { OnboardingPageShell } from '../services/onboarding-page/types';
import type { OnboardingShellCopy } from '../components/shell/types';
import type { OnboardingSitesStepCopy } from '../components/sites-step/types';
import type { OnboardingSiteSuggestion } from '../utils/site-suggestion-catalog';
import type { OnboardingController, OnboardingState } from './flow';

/**
 * Immutable page projection and its controller-facing mutable event port.
 * @since 0.1.0
 */
export interface OnboardingViewProps {
	readonly state: Readonly<OnboardingState>;
	readonly port: OnboardingPageShell;
}

/**
 * Shared inputs for the three onboarding step presentations.
 * @since 0.1.0
 */
export interface OnboardingStepProps {
	readonly state: Readonly<OnboardingState>;
	readonly copy: Readonly<OnboardingShellCopy>;
	readonly controller: OnboardingController;
}

/**
 * Heading ownership used for focus restoration after step transitions.
 * @since 0.1.0
 */
export interface OnboardingContentProps extends OnboardingStepProps {
	readonly heading: RefObject<HTMLHeadingElement | null>;
}

/**
 * Localized suggestion and the currently selected matching rule, when present.
 * @since 0.1.0
 */
export interface OnboardingSuggestionProps {
	readonly suggestion: Readonly<OnboardingSiteSuggestion>;
	readonly selected: ProtectedSiteConfiguration | undefined;
	readonly controller: OnboardingController;
}

/**
 * One selected website with its optional bundled icon and localized removal action.
 * @since 0.1.0
 */
export interface OnboardingSiteRowProps {
	readonly site: ProtectedSiteConfiguration;
	readonly suggestion: Readonly<OnboardingSiteSuggestion> | undefined;
	readonly copy: Readonly<OnboardingSitesStepCopy>;
	readonly controller: OnboardingController;
}

/**
 * Authoritative appearance and localized copy for the analytics-free preview.
 * @since 0.1.0
 */
export interface PausePreviewProps {
	readonly state: Readonly<OnboardingState>;
}
