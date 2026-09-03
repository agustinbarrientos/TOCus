import '@tocus/theme/index.scss';
import { browser, type Browser } from 'wxt/browser';
import {
	ProtectionConfigurationStorageKey,
	createProtectionConfigurationEditor,
	createProtectionConfigurationStorageService,
	type ProtectionConfigurationEditResult,
	type ProtectionConfigurationMutation,
} from '../../domains/protection/services';
import { ComponentSettingsShell } from '../../features/settings/components/shell';
import { ComponentProtectedSitesScreen } from '../../features/protected-sites/components/screen';
import { createSiteFaviconProvider } from '../../features/protected-sites/services/site-favicon-provider';
import { createSitePermissionManager } from '../../features/protected-sites/services/site-permission-manager';
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

const settingsShellCandidate = document.querySelector( 'tocus-f-settings-shell' );

if ( ! ( settingsShellCandidate instanceof ComponentSettingsShell ) ) {
	throw new TypeError( 'Expected the options page to contain the settings shell.' );
}

const settingsShell = settingsShellCandidate;

/**
 * Refreshes the visible Protected Sites access state after a relevant browser grant changes.
 * @param change - Named and origin permissions added to or removed from the extension.
 * @since 0.1.0 Initial implementation.
 */
function handlePermissionChanged( change: Browser.permissions.Permissions ): void {
	const changedHostAccess = ( change.origins?.length ?? 0 ) > 0;
	const changedNavigationAccess = change.permissions?.includes( 'webNavigation' ) ?? false;

	if ( ! changedHostAccess && ! changedNavigationAccess ) {
		return;
	}

	const protectedSitesScreen = settingsShell.shadowRoot?.querySelector(
		'tocus-f-protected-sites-screen',
	);

	if ( protectedSitesScreen instanceof ComponentProtectedSitesScreen ) {
		void protectedSitesScreen.refreshAccessState();
	}
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
settingsShell.permissionManager = createSitePermissionManager( {
	permissions: browser.permissions,
} );
settingsShell.platform = import.meta.env.SAFARI
	? 'safari'
	: import.meta.env.FIREFOX
		? 'firefox'
		: 'chrome';

browser.permissions.onAdded.addListener( handlePermissionChanged );
browser.permissions.onRemoved.addListener( handlePermissionChanged );
