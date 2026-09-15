import youtubeIcon from '@tocus/theme/site-icons/site-youtube.svg?url&no-inline';
import redditIcon from '@tocus/theme/site-icons/site-reddit.svg?url&no-inline';
import xIcon from '@tocus/theme/site-icons/site-x.svg?url&no-inline';
import instagramIcon from '@tocus/theme/site-icons/site-instagram.svg?url&no-inline';
import facebookIcon from '@tocus/theme/site-icons/site-facebook.svg?url&no-inline';
import tiktokIcon from '@tocus/theme/site-icons/site-tiktok.svg?url&no-inline';
import netflixIcon from '@tocus/theme/site-icons/site-netflix.svg?url&no-inline';
import twitchIcon from '@tocus/theme/site-icons/site-twitch.svg?url&no-inline';
import discordIcon from '@tocus/theme/site-icons/site-discord.svg?url&no-inline';
import whatsappIcon from '@tocus/theme/site-icons/site-whatsapp.svg?url&no-inline';
import pinterestIcon from '@tocus/theme/site-icons/site-pinterest.svg?url&no-inline';
import linkedinIcon from '@tocus/theme/site-icons/site-linkedin.svg?url&no-inline';
import spotifyIcon from '@tocus/theme/site-icons/site-spotify.svg?url&no-inline';
import chessIcon from '@tocus/theme/site-icons/site-chess.svg?url&no-inline';
import threadsIcon from '@tocus/theme/site-icons/site-threads.svg?url&no-inline';
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
		iconUrl: youtubeIcon,
	} ),
	Object.freeze( {
		id: OnboardingSiteSuggestionId.REDDIT,
		displayName: 'Reddit',
		siteInput: 'www.reddit.com',
		ruleHost: 'reddit.com',
		iconUrl: redditIcon,
	} ),
	Object.freeze( {
		id: OnboardingSiteSuggestionId.X,
		displayName: 'X',
		siteInput: 'x.com',
		ruleHost: 'x.com',
		iconUrl: xIcon,
	} ),
	Object.freeze( {
		id: OnboardingSiteSuggestionId.INSTAGRAM,
		displayName: 'Instagram',
		siteInput: 'www.instagram.com',
		ruleHost: 'instagram.com',
		iconUrl: instagramIcon,
	} ),
	Object.freeze( {
		id: OnboardingSiteSuggestionId.FACEBOOK,
		displayName: 'Facebook',
		siteInput: 'www.facebook.com',
		ruleHost: 'facebook.com',
		iconUrl: facebookIcon,
	} ),
	Object.freeze( {
		id: OnboardingSiteSuggestionId.TIKTOK,
		displayName: 'TikTok',
		siteInput: 'www.tiktok.com',
		ruleHost: 'tiktok.com',
		iconUrl: tiktokIcon,
	} ),
	Object.freeze( {
		id: OnboardingSiteSuggestionId.NETFLIX,
		displayName: 'Netflix',
		siteInput: 'www.netflix.com',
		ruleHost: 'netflix.com',
		iconUrl: netflixIcon,
	} ),
	Object.freeze( {
		id: OnboardingSiteSuggestionId.TWITCH,
		displayName: 'Twitch',
		siteInput: 'www.twitch.tv',
		ruleHost: 'twitch.tv',
		iconUrl: twitchIcon,
	} ),
	Object.freeze( {
		id: OnboardingSiteSuggestionId.DISCORD,
		displayName: 'Discord',
		siteInput: 'discord.com',
		ruleHost: 'discord.com',
		iconUrl: discordIcon,
	} ),
	Object.freeze( {
		id: OnboardingSiteSuggestionId.WHATSAPP,
		displayName: 'WhatsApp',
		siteInput: 'web.whatsapp.com',
		ruleHost: 'whatsapp.com',
		iconUrl: whatsappIcon,
	} ),
	Object.freeze( {
		id: OnboardingSiteSuggestionId.PINTEREST,
		displayName: 'Pinterest',
		siteInput: 'www.pinterest.com',
		ruleHost: 'pinterest.com',
		iconUrl: pinterestIcon,
	} ),
	Object.freeze( {
		id: OnboardingSiteSuggestionId.LINKEDIN,
		displayName: 'LinkedIn',
		siteInput: 'www.linkedin.com',
		ruleHost: 'linkedin.com',
		iconUrl: linkedinIcon,
	} ),
	Object.freeze( {
		id: OnboardingSiteSuggestionId.SPOTIFY,
		displayName: 'Spotify',
		siteInput: 'open.spotify.com',
		ruleHost: 'spotify.com',
		iconUrl: spotifyIcon,
	} ),
	Object.freeze( {
		id: OnboardingSiteSuggestionId.CHESS,
		displayName: 'Chess.com',
		siteInput: 'www.chess.com',
		ruleHost: 'chess.com',
		iconUrl: chessIcon,
	} ),
	Object.freeze( {
		id: OnboardingSiteSuggestionId.THREADS,
		displayName: 'Threads',
		siteInput: 'www.threads.com',
		ruleHost: 'threads.com',
		iconUrl: threadsIcon,
	} ),
] );

export * from './types';
