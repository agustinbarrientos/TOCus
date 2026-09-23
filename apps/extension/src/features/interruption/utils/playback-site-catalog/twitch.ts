import type { PlaybackSiteRule } from './types';

/**
 * Native video control boundaries for Twitch streams, recordings, and clips.
 * @since 1.0.0 Initial implementation.
 */
export const TWITCH_PLAYBACK_RULES = [
	{ domains: [ 'twitch.tv' ] },
] as const satisfies readonly PlaybackSiteRule[];
