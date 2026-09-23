import {
	InterruptionNavigationReplacementRequestSchema,
} from '../../../protection-runtime/types/runtime-message';
import { readInterruptionNavigationDestination } from '../../../../shared/utils/interruption-navigation-destination';
import { InterruptionDocumentPath } from '../../../../shared/utils/interruption-document-url';
import type { InterruptionNavigationReplacementOptions } from './types';

/**
 * Reports whether a destination is a complete literal HTTP or HTTPS URL.
 * @param candidate - Untrusted replacement destination.
 * @return Whether the destination may be assigned to the interruption document.
 * @since 1.0.0 Initial implementation.
 */
function isHttpDestination( candidate: string ): boolean {
	if ( ! candidate.startsWith( 'http://' ) && ! candidate.startsWith( 'https://' ) ) {
		return false;
	}

	try {
		const parsed = new URL( candidate );

		return parsed.protocol === 'http:' || parsed.protocol === 'https:';
	} catch {
		return false;
	}
}

/**
 * Registers the earliest interruption-page listener that can replace an authorized release in place.
 * @param options - Current document and extension runtime boundaries.
 * @since 1.0.0 Initial implementation.
 */
export function registerInterruptionNavigationReplacement(
	options: InterruptionNavigationReplacementOptions,
): void {
	const currentUrl = options.runtime.getURL( InterruptionDocumentPath.CURRENT );

	options.runtime.onMessage.addListener( ( input, sender, sendResponse ) => {
		const request = InterruptionNavigationReplacementRequestSchema.safeParse( input );

		if ( ! request.success || sender.id !== options.runtime.id || sender.tab !== undefined ) {
			return undefined;
		}

		const sourceUrl = options.location.href;
		const isReplacementDocument = sourceUrl === currentUrl ||
			readInterruptionNavigationDestination( sourceUrl, currentUrl ) !== null;

		if (
			! isReplacementDocument ||
			request.data.sourceUrl !== sourceUrl ||
			! isHttpDestination( request.data.url )
		) {
			return undefined;
		}

		sendResponse( { replaced: true } );
		options.location.replace( request.data.url );

		return undefined;
	} );
}

export * from './types';
