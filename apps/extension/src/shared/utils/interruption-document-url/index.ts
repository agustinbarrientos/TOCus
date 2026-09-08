import { InterruptionDocumentPath } from './types';

/**
 * Identifies current pause documents and still-open legacy tabs without broadening sender trust.
 * @param candidate - Exact browser-reported document URL, if available.
 * @param currentUrl - Trusted packaged URL used for new interruptions.
 * @return Whether the URL is the current document or its exact legacy sibling.
 * @since 0.1.0 Initial implementation.
 */
export function isInterruptionDocumentUrl( candidate: string | undefined, currentUrl: string ): boolean {
	if ( candidate === currentUrl ) {
		return true;
	}

	if ( ! currentUrl.endsWith( InterruptionDocumentPath.CURRENT ) ) {
		return false;
	}

	try {
		// Extension URL origins may be opaque; compare the entire trusted sibling URL instead.
		return candidate === new URL( InterruptionDocumentPath.LEGACY, currentUrl ).href;
	} catch {
		return false;
	}
}

export { InterruptionDocumentPath } from './types';
