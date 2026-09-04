import '@tocus/theme/index.scss';
import { browser, type Browser } from 'wxt/browser';
import {
	ProtectionConfigurationStorageKey,
	createProtectionConfigurationEditor,
	createProtectionConfigurationStorageService,
	type ProtectionConfigurationEditResult,
	type ProtectionConfigurationMutation,
} from '../../domains/protection/services';
import {
	PreferencesStorageKey,
	createPreferencesEditor,
	createPreferencesStorageService,
	type PreferencesMutation,
} from '../../domains/preferences/services';
import { createPreferencesController } from '../../features/preferences/services/preferences-controller';
import { ComponentSettingsShell } from '../../features/settings/components/shell';
import { ComponentProtectedSitesScreen } from '../../features/protected-sites/components/screen';
import { createSiteFaviconProvider } from '../../features/protected-sites/services/site-favicon-provider';
import { createSitePermissionManager } from '../../features/protected-sites/services/site-permission-manager';
import { createStatisticsClient } from '../../features/statistics/services/statistics-client';
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
 * Creates one collision-resistant local measurement revision.
 * @return Stable measurement revision.
 * @since 0.1.0 Initial implementation.
 */
function createMeasurementRevision(): string {
	return `revision_${ crypto.randomUUID() }`;
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

/**
 * Runs one preferences mutation under the extension origin's shared storage lock.
 * @template Result Mutation result returned after coordination.
 * @param mutation - Deferred preferences mutation.
 * @return Exact mutation result after exclusive cross-tab coordination.
 * @since 0.1.0 Initial implementation.
 */
function coordinatePreferencesMutation<Result>(
	mutation: PreferencesMutation<Result>,
): Promise<Result> {
	return navigator.locks.request( PreferencesStorageKey.PREFERENCES, mutation );
}

/**
 * Settings-shell candidate mounted by the options document.
 * @since 0.1.0 Initial implementation.
 */
const settingsShellCandidate = document.querySelector( 'tocus-f-settings-shell' );

if ( ! ( settingsShellCandidate instanceof ComponentSettingsShell ) ) {
	throw new TypeError( 'Expected the options page to contain the settings shell.' );
}

/**
 * Validated settings shell receiving every options-page dependency.
 * @since 0.1.0 Initial implementation.
 */
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

/**
 * Local protection-configuration persistence used by options controls.
 * @since 0.1.0 Initial implementation.
 */
const protectionStorage = createProtectionConfigurationStorageService( {
	area: browser.storage.local,
} );

/**
 * Local preference persistence used by options controls.
 * @since 0.1.0 Initial implementation.
 */
const preferencesStorage = createPreferencesStorageService( {
	area: browser.storage.local,
} );

/**
 * Coordinated preference editor exposed to settings components.
 * @since 0.1.0 Initial implementation.
 */
const preferencesEditor = createPreferencesEditor( {
	coordinateMutation: coordinatePreferencesMutation,
	storage: preferencesStorage,
} );

/**
 * Live preference projection applied to the options document.
 * @since 0.1.0 Initial implementation.
 */
const preferencesController = createPreferencesController( {
	appearanceTarget: document.documentElement,
	storage: preferencesStorage,
	storageChanges: browser.storage.onChanged,
	systemMotionPreference: window.matchMedia( '(prefers-reduced-motion: reduce)' ),
} );

settingsShell.editor = createProtectionConfigurationEditor( {
	storage: protectionStorage,
	createIndependentScopeId,
	createMeasurementRevision,
	coordinateMutation: coordinateProtectionConfigurationMutation,
} );
settingsShell.faviconProvider = createSiteFaviconProvider( {
	supportsCachedFavicons: import.meta.env.CHROME,
	extensionRootUrl: browser.runtime.getURL( '/' ),
} );
settingsShell.permissionManager = createSitePermissionManager( {
	permissions: browser.permissions,
} );
settingsShell.preferencesEditor = preferencesEditor;
settingsShell.preferencesPreview = preferencesController;
settingsShell.preferencesSource = preferencesController;

/**
 * Local statistics client used by the settings statistics screen.
 * @since 0.1.0 Initial implementation.
 */
const statisticsClient = createStatisticsClient( {
	runtime: browser.runtime,
	storageChanges: browser.storage.onChanged,
} );
settingsShell.statisticsSource = statisticsClient;
settingsShell.platform = import.meta.env.SAFARI
	? 'safari'
	: import.meta.env.FIREFOX
		? 'firefox'
		: 'chrome';

/**
 * Applies persisted preferences before revealing the settings document.
 * @return Promise resolved after the initial preference projection.
 * @since 0.1.0 Initial implementation.
 */
async function startPreferences(): Promise<void> {
	await preferencesController.start();
	document.documentElement.style.removeProperty( 'color-scheme' );
	document.documentElement.style.removeProperty( 'background' );
	document.documentElement.style.removeProperty( 'visibility' );
}

void startPreferences();

browser.permissions.onAdded.addListener( handlePermissionChanged );
browser.permissions.onRemoved.addListener( handlePermissionChanged );
