import { OnboardingSiteSuggestionId, type OnboardingSiteSuggestion } from './types';

/**
 * Fixed local site suggestions shown during onboarding in approved product order.
 * @since 0.1.0 Initial implementation.
 */
export const OnboardingSiteSuggestions: readonly Readonly<OnboardingSiteSuggestion>[] = Object.freeze( [
	Object.freeze( {
		id: OnboardingSiteSuggestionId.YOUTUBE,
		displayName: 'YouTube',
		siteInput: 'www.youtube.com',
		ruleHost: 'youtube.com',
		iconUrl: new URL( '../../assets/site-icons/site-youtube.svg', import.meta.url ).href,
	} ),
	Object.freeze( {
		id: OnboardingSiteSuggestionId.REDDIT,
		displayName: 'Reddit',
		siteInput: 'www.reddit.com',
		ruleHost: 'reddit.com',
		iconUrl: new URL( '../../assets/site-icons/site-reddit.svg', import.meta.url ).href,
	} ),
	Object.freeze( {
		id: OnboardingSiteSuggestionId.X,
		displayName: 'X',
		siteInput: 'x.com',
		ruleHost: 'x.com',
		iconUrl: new URL( '../../assets/site-icons/site-x.svg', import.meta.url ).href,
	} ),
	Object.freeze( {
		id: OnboardingSiteSuggestionId.INSTAGRAM,
		displayName: 'Instagram',
		siteInput: 'www.instagram.com',
		ruleHost: 'instagram.com',
		iconUrl: new URL( '../../assets/site-icons/site-instagram.svg', import.meta.url ).href,
	} ),
	Object.freeze( {
		id: OnboardingSiteSuggestionId.FACEBOOK,
		displayName: 'Facebook',
		siteInput: 'www.facebook.com',
		ruleHost: 'facebook.com',
		iconUrl: new URL( '../../assets/site-icons/site-facebook.svg', import.meta.url ).href,
	} ),
	Object.freeze( {
		id: OnboardingSiteSuggestionId.TIKTOK,
		displayName: 'TikTok',
		siteInput: 'www.tiktok.com',
		ruleHost: 'tiktok.com',
		iconUrl: new URL( '../../assets/site-icons/site-tiktok.svg', import.meta.url ).href,
	} ),
	Object.freeze( {
		id: OnboardingSiteSuggestionId.NETFLIX,
		displayName: 'Netflix',
		siteInput: 'www.netflix.com',
		ruleHost: 'netflix.com',
		iconUrl: new URL( '../../assets/site-icons/site-netflix.svg', import.meta.url ).href,
	} ),
	Object.freeze( {
		id: OnboardingSiteSuggestionId.TWITCH,
		displayName: 'Twitch',
		siteInput: 'www.twitch.tv',
		ruleHost: 'twitch.tv',
		iconUrl: new URL( '../../assets/site-icons/site-twitch.svg', import.meta.url ).href,
	} ),
	Object.freeze( {
		id: OnboardingSiteSuggestionId.DISCORD,
		displayName: 'Discord',
		siteInput: 'discord.com',
		ruleHost: 'discord.com',
		iconUrl: new URL( '../../assets/site-icons/site-discord.svg', import.meta.url ).href,
	} ),
	Object.freeze( {
		id: OnboardingSiteSuggestionId.WHATSAPP,
		displayName: 'WhatsApp',
		siteInput: 'web.whatsapp.com',
		ruleHost: 'whatsapp.com',
		iconUrl: new URL( '../../assets/site-icons/site-whatsapp.svg', import.meta.url ).href,
	} ),
	Object.freeze( {
		id: OnboardingSiteSuggestionId.PINTEREST,
		displayName: 'Pinterest',
		siteInput: 'www.pinterest.com',
		ruleHost: 'pinterest.com',
		iconUrl: new URL( '../../assets/site-icons/site-pinterest.svg', import.meta.url ).href,
	} ),
	Object.freeze( {
		id: OnboardingSiteSuggestionId.LINKEDIN,
		displayName: 'LinkedIn',
		siteInput: 'www.linkedin.com',
		ruleHost: 'linkedin.com',
		iconUrl: new URL( '../../assets/site-icons/site-linkedin.svg', import.meta.url ).href,
	} ),
	Object.freeze( {
		id: OnboardingSiteSuggestionId.SPOTIFY,
		displayName: 'Spotify',
		siteInput: 'open.spotify.com',
		ruleHost: 'spotify.com',
		iconUrl: new URL( '../../assets/site-icons/site-spotify.svg', import.meta.url ).href,
	} ),
	Object.freeze( {
		id: OnboardingSiteSuggestionId.CHESS,
		displayName: 'Chess.com',
		siteInput: 'www.chess.com',
		ruleHost: 'chess.com',
		iconUrl: new URL( '../../assets/site-icons/site-chess.svg', import.meta.url ).href,
	} ),
	Object.freeze( {
		id: OnboardingSiteSuggestionId.THREADS,
		displayName: 'Threads',
		siteInput: 'www.threads.com',
		ruleHost: 'threads.com',
		iconUrl: new URL( '../../assets/site-icons/site-threads.svg', import.meta.url ).href,
	} ),
] );

export * from './types';
