import type { PlaybackSiteRule } from './types';

/**
 * Native video control boundaries for Netflix.
 * @since 1.0.0 Initial implementation.
 */
export const NETFLIX_PLAYBACK_RULES = [
	{ domains: [ 'netflix.com' ] },
] as const satisfies readonly PlaybackSiteRule[];
