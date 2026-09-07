import type { CanonicalHost } from '../../../../domains/protection/types/protected-site-rule';

/**
 * Stable identifier for one site shown in the onboarding suggestion catalog.
 * @since 0.1.0 Initial implementation.
 */
export const OnboardingSiteSuggestionId = {
	CHESS: 'chess',
	DISCORD: 'discord',
	FACEBOOK: 'facebook',
	INSTAGRAM: 'instagram',
	LINKEDIN: 'linkedin',
	NETFLIX: 'netflix',
	PINTEREST: 'pinterest',
	REDDIT: 'reddit',
	SPOTIFY: 'spotify',
	THREADS: 'threads',
	TIKTOK: 'tiktok',
	TWITCH: 'twitch',
	WHATSAPP: 'whatsapp',
	X: 'x',
	YOUTUBE: 'youtube',
} as const;

/**
 * Canonical key of one locally packaged onboarding suggestion.
 * @since 0.1.0
 */
export type OnboardingSiteSuggestionId =
	typeof OnboardingSiteSuggestionId[ keyof typeof OnboardingSiteSuggestionId ];

/**
 * One locally packaged site suggestion available during onboarding.
 * @since 0.1.0 Initial implementation.
 */
export interface OnboardingSiteSuggestion {
	readonly id: OnboardingSiteSuggestionId;
	readonly displayName: string;
	readonly siteInput: string;
	readonly ruleHost: CanonicalHost;
	readonly iconUrl: string;
}
