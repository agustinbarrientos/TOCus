import type { PlaybackSiteRule } from './types';

/**
 * Native video control boundaries for Twitch streams, recordings, and clips.
 * @since 0.1.0 Initial implementation.
 */
export const TWITCH_PLAYBACK_RULES = [
	{ domains: [ 'twitch.tv' ] },
] as const satisfies readonly PlaybackSiteRule[];
