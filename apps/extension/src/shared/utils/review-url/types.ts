import type { ExtensionBuildBrowser } from '../build-browser/types';

/**
 * Published review destinations, with null for stores not yet available.
 * @since 0.1.0
 */
export type ExtensionReviewLinks = Readonly<Record<
	typeof ExtensionBuildBrowser[ keyof typeof ExtensionBuildBrowser ], string | null
>>;
