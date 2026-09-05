import { type ExtensionTabContextRuntime, type ExtensionTabContextTab } from './types';

/**
 * Reports whether a queried tab has the identity required for a redacted URL lookup.
 * @param tab - Fresh browser tab observation.
 * @return Whether live extension context metadata may supply its missing URL.
 * @since 0.1.0 Initial implementation.
 */
function needsExtensionContext( tab: ExtensionTabContextTab ): boolean {
	return tab.url === undefined && tab.pendingUrl === undefined &&
		tab.id !== undefined && Number.isSafeInteger( tab.id ) && tab.id >= 0 &&
		typeof tab.incognito === 'boolean';
}

/**
 * Enriches redacted tab URLs with exact live interruption-document identities from the extension runtime.
 * @param tabs - Fresh queried tabs whose explicit URLs retain precedence.
 * @param runtime - Optional extension document lookup supported by the browser.
 * @return Queried tabs with verified interruption URLs, or the original tabs when lookup is unavailable.
 * @since 0.1.0 Initial implementation.
 */
export async function enrichExtensionTabUrls<T extends ExtensionTabContextTab>(
	tabs: ReadonlyArray<T>,
	runtime: ExtensionTabContextRuntime | undefined,
): Promise<ReadonlyArray<T>> {
	if ( runtime?.getContexts === undefined || ! tabs.some( needsExtensionContext ) ) {
		return tabs;
	}

	try {
		const interruptionPageUrl = runtime.getURL( '/interruption.html' );
		const contexts = await runtime.getContexts( { contextTypes: [ 'TAB' ] } );

		return tabs.map( ( tab ) => {
			if ( ! needsExtensionContext( tab ) ) {
				return tab;
			}

			const hasInterruptionContext = contexts.some( ( context ) =>
				context.contextType === 'TAB' && context.frameId === 0 &&
				context.tabId === tab.id && context.incognito === tab.incognito &&
				context.documentUrl === interruptionPageUrl,
			);

			return hasInterruptionContext ? { ...tab, url: interruptionPageUrl } : tab;
		} );
	} catch {
		return tabs;
	}
}

export * from './types';
