import type { Plugin } from 'vite';

/**
 * Fixes Zod's supported jitless setting at build time so its code generator can be removed.
 * Runtime configuration skips execution but leaves Function constructors in submitted bundles.
 * @return Build transform scoped to Zod's interpreter and capability probe.
 * @since 1.0.0 CSP-safe extension validation.
 */
export function createInterpretedValidationPlugin(): Plugin {
	return {
		name: 'tocus-interpreted-validation',
		enforce: 'pre',
		/**
		 * Makes interpreter selection constant before the bundler removes unused code.
		 * @param source - Published dependency source.
		 * @param id - Resolved dependency filename.
		 * @return Source with static interpreter selection, or no change for other modules.
		 */
		transform( source, id ) {
			if ( ! /[/\\]zod[/\\]v4[/\\]core[/\\](?:schemas|util)\.js$/u.test( id ) ) {
				return;
			}
			return {
				code: source.replace( /\b(?:core\.)?globalConfig\.jitless\b/gu, 'true' ),
				map: null,
			};
		},
	};
}
