import { PopupCurrentTabContextSchema, type PopupCurrentTabContext } from '../../types/current-tab-context';
import {
	type CurrentTabReader,
	type CurrentTabReaderBrowser,
} from './types';

/**
 * Creates a minimal active-tab reader for the current popup invocation.
 * @param browser - Browser tab query available through activeTab.
 * @return Ephemeral current-tab reader.
 * @since 0.1.0 Initial implementation.
 */
export function createCurrentTabReader( browser: CurrentTabReaderBrowser ): CurrentTabReader {
	return {
		/**
		 * Reads and validates only the active tab's identifier, privacy state, and URL.
		 * @return Current tab context or null when the browser omits required metadata.
		 * @since 0.1.0 Initial implementation.
		 */
		async read(): Promise<PopupCurrentTabContext | null> {
			try {
				const tab = ( await browser.tabs.query( { active: true, currentWindow: true } ) )[ 0 ];

				if ( tab === undefined ) {
					return null;
				}

				const result = PopupCurrentTabContextSchema.safeParse( {
					id: tab.id,
					incognito: tab.incognito,
					url: tab.pendingUrl ?? tab.url,
				} );

				return result.success ? result.data : null;
			} catch {
				return null;
			}
		},
	};
}

export * from './types';
