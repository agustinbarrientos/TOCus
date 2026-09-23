import { ExtensionBuildBrowser } from '../build-browser/types';
import type { ExtensionReviewLinks } from './types';

/**
 * Published store review URLs. An unpublished listing keeps its invitation hidden.
 * @since 0.1.0
 */
export const ExtensionStoreReviewLinks: ExtensionReviewLinks = {
	[ ExtensionBuildBrowser.CHROME ]: null,
	[ ExtensionBuildBrowser.EDGE ]: null,
	[ ExtensionBuildBrowser.FIREFOX ]: null,
	[ ExtensionBuildBrowser.SAFARI ]: null,
};
