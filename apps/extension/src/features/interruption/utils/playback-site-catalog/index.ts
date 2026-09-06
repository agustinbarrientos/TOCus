import { DISNEY_PLUS_PLAYBACK_RULES } from './disney-plus';
import { HBO_MAX_PLAYBACK_RULES } from './hbo-max';
import { NETFLIX_PLAYBACK_RULES } from './netflix';
import { PRIME_VIDEO_PLAYBACK_RULES } from './prime-video';
import { TWITCH_PLAYBACK_RULES } from './twitch';
import { type PlaybackSiteRule } from './types';
import { YOUTUBE_PLAYBACK_RULES } from './youtube';

/**
 * Local native-video rules, with each streaming service defined in its own module.
 * @since 0.1.0 Initial implementation.
 */
const PLAYBACK_SITE_RULES: readonly PlaybackSiteRule[] = [
	...YOUTUBE_PLAYBACK_RULES,
	...NETFLIX_PLAYBACK_RULES,
	...TWITCH_PLAYBACK_RULES,
	...HBO_MAX_PLAYBACK_RULES,
	...PRIME_VIDEO_PLAYBACK_RULES,
	...DISNEY_PLUS_PLAYBACK_RULES,
];

/**
 * Checks exact domain and path boundaries before controlling a page's native videos.
 * @param url - Current document URL.
 * @return Whether native playback may be held on this document.
 * @since 0.1.0 Initial implementation.
 */
export function isPlaybackSite( url: URL ): boolean {
	return ( url.protocol === 'https:' || url.protocol === 'http:' ) &&
		PLAYBACK_SITE_RULES.some( ( rule ) =>
			rule.domains.some( ( domain ) => url.hostname === domain || url.hostname.endsWith( `.${ domain }` ) ) &&
			( rule.pathPrefixes === undefined || rule.pathPrefixes.some( ( prefix ) =>
				url.pathname === prefix || url.pathname.startsWith( `${ prefix }/` ),
			) ),
		);
}
