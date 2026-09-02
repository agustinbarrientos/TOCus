import '@tocus/theme/index.scss';
import { browser } from 'wxt/browser';
import {
	ProtectionConfigurationStorageKey,
	createProtectionConfigurationEditor,
	createProtectionConfigurationStorageService,
	type ProtectionConfigurationEditResult,
	type ProtectionConfigurationMutation,
} from '../../domains/protection/services';
import { ComponentSettingsShell } from '../../features/settings/components/shell';
import { createSiteFaviconProvider } from '../../features/protected-sites/services/site-favicon-provider';
import './styles.scss';

/**
 * Creates one collision-resistant local scope identifier for an independent site.
 * @return Stable independent protection scope identifier.
 * @since 0.1.0 Initial implementation.
 */
function createIndependentScopeId(): string {
	return `scope_${ crypto.randomUUID() }`;
}

/**
 * Runs one configuration mutation under the extension origin's shared storage lock.
 * @param mutation - Deferred protected-site configuration mutation.
 * @return Exact mutation result after exclusive cross-tab coordination.
 * @since 0.1.0 Initial implementation.
 */
function coordinateProtectionConfigurationMutation(
	mutation: ProtectionConfigurationMutation,
): Promise<ProtectionConfigurationEditResult> {
	return navigator.locks.request( ProtectionConfigurationStorageKey.CONFIGURATION, mutation );
}

const settingsShell = document.querySelector( 'tocus-f-settings-shell' );

if ( ! ( settingsShell instanceof ComponentSettingsShell ) ) {
	throw new TypeError( 'Expected the options page to contain the settings shell.' );
}

const storage = createProtectionConfigurationStorageService( {
	area: browser.storage.local,
} );

settingsShell.editor = createProtectionConfigurationEditor( {
	storage,
	createIndependentScopeId,
	coordinateMutation: coordinateProtectionConfigurationMutation,
} );
settingsShell.faviconProvider = createSiteFaviconProvider( {
	supportsCachedFavicons: import.meta.env.CHROME,
	extensionRootUrl: browser.runtime.getURL( '/' ),
} );
settingsShell.platform = import.meta.env.SAFARI
	? 'safari'
	: import.meta.env.FIREFOX
		? 'firefox'
		: 'chrome';
