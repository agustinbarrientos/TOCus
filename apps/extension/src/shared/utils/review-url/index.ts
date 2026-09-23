import type { ExtensionReviewLinks } from './types';

/**
 * Selects the review destination for the extension's actual distribution target.
 * @param browser - Browser target supplied by the extension build.
 * @param links - Published listings for each browser.
 * @return Matching review URL, or null for an unavailable store.
 * @since 1.0.0
 */
export function getExtensionReviewUrl( browser: string, links: ExtensionReviewLinks ): string | null {
	const matchingLink = Object.entries( links ).find( ( [ target ] ) => target === browser );
	return matchingLink?.[ 1 ] ?? null;
}
