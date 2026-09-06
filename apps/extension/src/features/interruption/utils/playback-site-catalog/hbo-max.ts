import { type PlaybackSiteRule } from './types';

/**
 * Native video control boundaries for HBO Max.
 * @since 0.1.0 Initial implementation.
 */
export const HBO_MAX_PLAYBACK_RULES = [
	{ domains: [ 'hbomax.com', 'max.com' ] },
] as const satisfies readonly PlaybackSiteRule[];
