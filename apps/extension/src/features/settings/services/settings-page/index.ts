import { createBrowserPreferencesEditor } from '../../../../domains/preferences/services/browser-preferences-editor';
import { type Language } from '../../../../domains/preferences/types';
import { createBrowserProtectionConfigurationEditor } from '../../../../domains/protection/services/browser-protection-configuration-editor';
import {
	createPreferencesController,
	type PreferencesController,
	type PreferencesLanguageChangeListener,
} from '../../../preferences/services/preferences-controller';
import { createSiteFaviconProvider } from '../../../protected-sites/services/site-favicon-provider';
import { createSitePermissionManager } from '../../../protected-sites/services/site-permission-manager';
import { createStatisticsClient } from '../../../statistics/services/statistics-client';
import {
	type ProtectedSitesAccessRefresher,
	type SettingsPageOptions,
	type SettingsPermissionChange,
	type SettingsPermissionChangeListener,
} from './types';

/**
 * Reveals settings after either successful startup or terminal recovery.
 * @param options - Settings page dependencies containing the owned document.
 * @since 0.1.0 Initial implementation.
 */
function revealSettingsPage( options: SettingsPageOptions ): void {
	options.document.documentElement.style.removeProperty( 'color-scheme' );
	options.document.documentElement.style.removeProperty( 'background' );
	options.document.documentElement.style.removeProperty( 'visibility' );
}

/**
 * Starts the complete extension settings page.
 * @param options - Browser, persistence, localization, and presentation dependencies.
 * @return Promise resolved after preferences and localized copy settle and the page is revealed.
 * @since 0.1.0 Initial implementation.
 */
export async function startSettingsPage( options: SettingsPageOptions ): Promise<void> {
	let languageChangeListener: PreferencesLanguageChangeListener | null = null;
	let permissionChangeListener: SettingsPermissionChangeListener | null = null;
	let preferencesController: PreferencesController | null = null;

	try {
		const preferences = createBrowserPreferencesEditor( {
			area: options.storageArea,
			locks: options.locks,
		} );
		const protection = createBrowserProtectionConfigurationEditor( {
			area: options.storageArea,
			cryptography: options.cryptography,
			locks: options.locks,
		} );
		const activePreferencesController = createPreferencesController( {
			appearanceTarget: options.document.documentElement,
			browserLanguage: options.browserLanguage,
			storage: preferences.storage,
			storageChanges: options.storageChanges,
			systemMotionPreference: options.pageWindow.matchMedia( '(prefers-reduced-motion: reduce)' ),
		} );
		const permissionManager = createSitePermissionManager( { permissions: options.permissions } );
		let localizationRevision = 0;

		preferencesController = activePreferencesController;
		options.shell.editor = protection.editor;
		options.shell.faviconProvider = createSiteFaviconProvider( {
			extensionRootUrl: options.extensionRootUrl,
			supportsCachedFavicons: options.supportsCachedFavicons,
		} );
		options.shell.permissionManager = permissionManager;
		options.shell.preferencesEditor = preferences.editor;
		options.shell.preferencesPreview = activePreferencesController;
		options.shell.preferencesSource = activePreferencesController;
		options.shell.browserLanguage = options.browserLanguage;
		options.shell.statisticsSource = createStatisticsClient( {
			runtime: options.runtime,
			storageChanges: options.storageChanges,
		} );
		options.shell.platform = options.platform;

		/**
		 * Reports whether one unknown value can refresh protected-site access state.
		 * @param candidate - Candidate rendered settings destination.
		 * @return Whether the candidate exposes an access refresh operation.
		 * @since 0.1.0 Initial implementation.
		 */
		function isProtectedSitesAccessRefresher(
			candidate: unknown,
		): candidate is ProtectedSitesAccessRefresher {
			return typeof candidate === 'object' &&
				candidate !== null &&
				'refreshAccessState' in candidate &&
				typeof candidate.refreshAccessState === 'function';
		}

		/**
		 * Refreshes visible Protected Sites access after a relevant browser grant changes.
		 * @param change - Named and origin permissions added to or removed from the extension.
		 * @since 0.1.0 Initial implementation.
		 */
		function handlePermissionChanged( change: SettingsPermissionChange ): void {
			const changedHostAccess = ( change.origins?.length ?? 0 ) > 0;
			const changedNavigationAccess = change.permissions?.includes( 'webNavigation' ) ?? false;

			if ( ! changedHostAccess && ! changedNavigationAccess ) {
				return;
			}

			const protectedSitesScreen = options.shell.shadowRoot?.querySelector(
				'tocus-f-protected-sites-screen',
			);

			if ( isProtectedSitesAccessRefresher( protectedSitesScreen ) ) {
				void protectedSitesScreen.refreshAccessState();
			}
		}

		/**
		 * Applies one complete localization snapshot when it remains the latest request.
		 * @param language - Effective selected or browser-derived language.
		 * @return Promise resolved after the latest requested language is projected.
		 * @since 0.1.0 Initial implementation.
		 */
		async function applyLocalization( language: Language ): Promise<void> {
			localizationRevision += 1;
			const requestedRevision = localizationRevision;
			const localization = await options.loadLocalization( language );

			if ( requestedRevision !== localizationRevision ) {
				return;
			}

			options.document.documentElement.setAttribute( 'lang', localization.languageTag );
			options.document.title = localization.document.settingsTitle;
			options.shell.copy = localization.settingsShell;
			options.shell.appearanceCopy = localization.appearance;
			options.shell.languageCopy = localization.languageScreen;
			options.shell.protectedSitesCopy = localization.protectedSites;
			options.shell.protectedSiteItemCopy = localization.protectedSiteItem;
			options.shell.scheduleCopy = localization.schedule;
			options.shell.statisticsCopy = localization.statistics;
			options.shell.timingCopy = localization.timing;
		}

		/**
		 * Applies a live localization request without replacing the last usable copy on failure.
		 * @param language - Newly effective preference language.
		 * @return Promise resolved after the live request settles.
		 * @since 0.1.0 Initial implementation.
		 */
		async function applyLiveLocalization( language: Language ): Promise<void> {
			try {
				await applyLocalization( language );
			} catch {
				return;
			}
		}

		/**
		 * Starts one non-blocking localization projection after a live language change.
		 * @param language - Newly effective preference language.
		 * @since 0.1.0 Initial implementation.
		 */
		function handleLanguageChange( language: Language ): void {
			void applyLiveLocalization( language );
		}

		/**
		 * Waits until the most recently requested localization is projected.
		 * @return Promise resolved when no newer language request is pending.
		 * @since 0.1.0 Initial implementation.
		 */
		async function synchronizeLocalization(): Promise<void> {
			let requestedRevision: number;

			do {
				requestedRevision = localizationRevision + 1;
				await applyLocalization( activePreferencesController.language );
			} while ( requestedRevision !== localizationRevision );
		}

		languageChangeListener = handleLanguageChange;
		permissionChangeListener = handlePermissionChanged;
		activePreferencesController.addLanguageChangeListener( languageChangeListener );
		options.permissions.onAdded.addListener( permissionChangeListener );
		options.permissions.onRemoved.addListener( permissionChangeListener );

		await activePreferencesController.start();
		await synchronizeLocalization();
	} catch ( error ) {
		if ( preferencesController !== null && languageChangeListener !== null ) {
			preferencesController.removeLanguageChangeListener( languageChangeListener );
		}
		if ( permissionChangeListener !== null ) {
			options.permissions.onAdded.removeListener( permissionChangeListener );
			options.permissions.onRemoved.removeListener( permissionChangeListener );
		}
		preferencesController?.stop();
		throw error;
	} finally {
		revealSettingsPage( options );
	}
}

/**
 * Starts settings while containing terminal bootstrap failures.
 * @param options - Browser, persistence, localization, and presentation dependencies.
 * @return Promise resolved after startup succeeds or recovery reveals settings.
 * @since 0.1.0 Initial implementation.
 */
export async function bootstrapSettingsPage( options: SettingsPageOptions ): Promise<void> {
	try {
		await startSettingsPage( options );
	} catch {
		return;
	}
}

export * from './types';
