import { type PlaybackSiteRule } from './types';

/**
 * Native video control boundaries for Disney+.
 * @since 0.1.0 Initial implementation.
 */
export const DISNEY_PLUS_PLAYBACK_RULES = [
	{ domains: [ 'disneyplus.com' ] },
] as const satisfies readonly PlaybackSiteRule[];
