import type { PlaybackSiteRule } from './types';

/**
 * Native video control boundaries for YouTube.
 * @since 0.1.0 Initial implementation.
 */
export const YOUTUBE_PLAYBACK_RULES = [
	{ domains: [ 'youtube.com' ] },
] as const satisfies readonly PlaybackSiteRule[];
