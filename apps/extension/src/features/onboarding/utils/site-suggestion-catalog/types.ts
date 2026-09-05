import { type CanonicalHost } from '../../../../domains/protection/types/protected-site-rule';

/**
 * Stable identifier for one site shown in the onboarding suggestion catalog.
 * @since 0.1.0 Initial implementation.
 */
export type OnboardingSiteSuggestionId =
	'chess' |
	'discord' |
	'facebook' |
	'instagram' |
	'linkedin' |
	'netflix' |
	'pinterest' |
	'reddit' |
	'spotify' |
	'threads' |
	'tiktok' |
	'twitch' |
	'whatsapp' |
	'x' |
	'youtube';

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
