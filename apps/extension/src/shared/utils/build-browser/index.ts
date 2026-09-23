import { ExtensionBuildBrowser } from './types';

/**
 * Reports whether a build target uses Chromium extension behavior.
 * @param browser - WXT browser build target.
 * @return Whether the target uses Chromium behavior.
 * @since 1.0.0 Initial implementation.
 */
export function isChromiumBuild( browser: string ): boolean {
	return browser === ExtensionBuildBrowser.CHROME || browser === ExtensionBuildBrowser.EDGE;
}
