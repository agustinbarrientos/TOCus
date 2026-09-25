import { ExtensionBuildBrowser } from '../build-browser/types';
import type { ExtensionReviewLinks } from './types';

/**
 * Configured store review URLs. A missing URL keeps its invitation hidden.
 * @since 1.0.0
 */
export const ExtensionStoreReviewLinks: ExtensionReviewLinks = {
	[ ExtensionBuildBrowser.CHROME ]: 'https://chromewebstore.google.com/detail/tocus-pause-before-visiti/gagjpniodbnbjdggjlkliabjffcnnfmh/reviews',
	[ ExtensionBuildBrowser.EDGE ]: 'https://microsoftedge.microsoft.com/addons/detail/ifpmfcopmabjjgggeefgoejnlbjpaehh',
	[ ExtensionBuildBrowser.FIREFOX ]: 'https://addons.mozilla.org/firefox/addon/tocus/reviews/',
	[ ExtensionBuildBrowser.SAFARI ]: null,
};
