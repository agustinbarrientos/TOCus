import type { PlaybackSiteRule } from './types';

/**
 * Native video control boundaries for Prime Video, excluding Amazon retail pages.
 * @since 0.1.0 Initial implementation.
 */
export const PRIME_VIDEO_PLAYBACK_RULES = [
	{ domains: [ 'primevideo.com' ] },
	{
		domains: [
			'amazon.com',
			'amazon.co.uk',
			'amazon.de',
			'amazon.co.jp',
			'amazon.ca',
			'amazon.in',
			'amazon.com.mx',
		],
		pathPrefixes: [ '/gp/video' ],
	},
] as const satisfies readonly PlaybackSiteRule[];
