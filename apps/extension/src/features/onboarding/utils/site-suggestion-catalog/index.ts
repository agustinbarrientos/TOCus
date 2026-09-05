import { type OnboardingSiteSuggestion } from './types';

/**
 * Fixed local site suggestions shown during onboarding in approved product order.
 * @since 0.1.0 Initial implementation.
 */
export const OnboardingSiteSuggestions: readonly Readonly<OnboardingSiteSuggestion>[] = Object.freeze( [
	Object.freeze( {
		id: 'youtube',
		displayName: 'YouTube',
		siteInput: 'www.youtube.com',
		ruleHost: 'youtube.com',
		iconUrl: new URL( '../../assets/site-icons/site-youtube.svg', import.meta.url ).href,
	} ),
	Object.freeze( {
		id: 'reddit',
		displayName: 'Reddit',
		siteInput: 'www.reddit.com',
		ruleHost: 'reddit.com',
		iconUrl: new URL( '../../assets/site-icons/site-reddit.svg', import.meta.url ).href,
	} ),
	Object.freeze( {
		id: 'x',
		displayName: 'X',
		siteInput: 'x.com',
		ruleHost: 'x.com',
		iconUrl: new URL( '../../assets/site-icons/site-x.svg', import.meta.url ).href,
	} ),
	Object.freeze( {
		id: 'instagram',
		displayName: 'Instagram',
		siteInput: 'www.instagram.com',
		ruleHost: 'instagram.com',
		iconUrl: new URL( '../../assets/site-icons/site-instagram.svg', import.meta.url ).href,
	} ),
	Object.freeze( {
		id: 'facebook',
		displayName: 'Facebook',
		siteInput: 'www.facebook.com',
		ruleHost: 'facebook.com',
		iconUrl: new URL( '../../assets/site-icons/site-facebook.svg', import.meta.url ).href,
	} ),
	Object.freeze( {
		id: 'tiktok',
		displayName: 'TikTok',
		siteInput: 'www.tiktok.com',
		ruleHost: 'tiktok.com',
		iconUrl: new URL( '../../assets/site-icons/site-tiktok.svg', import.meta.url ).href,
	} ),
	Object.freeze( {
		id: 'netflix',
		displayName: 'Netflix',
		siteInput: 'www.netflix.com',
		ruleHost: 'netflix.com',
		iconUrl: new URL( '../../assets/site-icons/site-netflix.svg', import.meta.url ).href,
	} ),
	Object.freeze( {
		id: 'twitch',
		displayName: 'Twitch',
		siteInput: 'www.twitch.tv',
		ruleHost: 'twitch.tv',
		iconUrl: new URL( '../../assets/site-icons/site-twitch.svg', import.meta.url ).href,
	} ),
	Object.freeze( {
		id: 'discord',
		displayName: 'Discord',
		siteInput: 'discord.com',
		ruleHost: 'discord.com',
		iconUrl: new URL( '../../assets/site-icons/site-discord.svg', import.meta.url ).href,
	} ),
	Object.freeze( {
		id: 'whatsapp',
		displayName: 'WhatsApp',
		siteInput: 'web.whatsapp.com',
		ruleHost: 'whatsapp.com',
		iconUrl: new URL( '../../assets/site-icons/site-whatsapp.svg', import.meta.url ).href,
	} ),
	Object.freeze( {
		id: 'pinterest',
		displayName: 'Pinterest',
		siteInput: 'www.pinterest.com',
		ruleHost: 'pinterest.com',
		iconUrl: new URL( '../../assets/site-icons/site-pinterest.svg', import.meta.url ).href,
	} ),
	Object.freeze( {
		id: 'linkedin',
		displayName: 'LinkedIn',
		siteInput: 'www.linkedin.com',
		ruleHost: 'linkedin.com',
		iconUrl: new URL( '../../assets/site-icons/site-linkedin.svg', import.meta.url ).href,
	} ),
	Object.freeze( {
		id: 'spotify',
		displayName: 'Spotify',
		siteInput: 'open.spotify.com',
		ruleHost: 'spotify.com',
		iconUrl: new URL( '../../assets/site-icons/site-spotify.svg', import.meta.url ).href,
	} ),
	Object.freeze( {
		id: 'chess',
		displayName: 'Chess.com',
		siteInput: 'www.chess.com',
		ruleHost: 'chess.com',
		iconUrl: new URL( '../../assets/site-icons/site-chess.svg', import.meta.url ).href,
	} ),
	Object.freeze( {
		id: 'threads',
		displayName: 'Threads',
		siteInput: 'www.threads.com',
		ruleHost: 'threads.com',
		iconUrl: new URL( '../../assets/site-icons/site-threads.svg', import.meta.url ).href,
	} ),
] );

export * from './types';
