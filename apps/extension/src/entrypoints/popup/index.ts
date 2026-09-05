import '@tocus/theme/index.scss';
import { browser } from 'wxt/browser';
import { createPreferencesStorageService } from '../../domains/preferences/services/preferences-storage';
import { resolveLanguage } from '../../domains/preferences/utils';
import { createBrowserProtectionConfigurationEditor } from '../../domains/protection/services/browser-protection-configuration-editor';
import { createPreferencesController } from '../../features/preferences/services/preferences-controller';
import { createProtectedSiteEnrollmentService } from '../../features/protected-sites/services/protected-site-enrollment';
import { createSiteFaviconProvider } from '../../features/protected-sites/services/site-favicon-provider';
import { createSitePermissionManager } from '../../features/protected-sites/services/site-permission-manager';
import { ComponentPopupShell } from '../../features/popup/components/shell';
import { createCurrentTabReader } from '../../features/popup/services/current-tab-reader';
import { bootstrapPopupPage } from '../../features/popup/services/popup-page';
import { createPopupStatusClient } from '../../features/popup/services/popup-status-client';
import {
	createEnglishLocalizationBundle,
	loadLocalizationBundle,
} from '../../localization';
import './styles.scss';

const popupShell = document.querySelector( 'tocus-f-popup-shell' );

if ( ! ( popupShell instanceof ComponentPopupShell ) ) {
	throw new TypeError( 'Expected the popup page to contain the popup shell.' );
}

const preferencesStorage = createPreferencesStorageService( {
	area: browser.storage.local,
} );
const preferencesController = createPreferencesController( {
	appearanceTarget: document.documentElement,
	browserLanguage: resolveLanguage( browser.i18n.getUILanguage() ),
	storage: preferencesStorage,
	storageChanges: browser.storage.onChanged,
	systemMotionPreference: window.matchMedia( '(prefers-reduced-motion: reduce)' ),
} );
const protection = createBrowserProtectionConfigurationEditor( {
	area: browser.storage.local,
	cryptography: crypto,
	locks: navigator.locks,
} );
const enrollment = createProtectedSiteEnrollmentService( {
	editor: protection.editor,
	permissionManager: createSitePermissionManager( { permissions: browser.permissions } ),
} );

void bootstrapPopupPage( {
	currentTabReader: createCurrentTabReader( { tabs: browser.tabs } ),
	document,
	enrollment,
	fallbackLocalization: createEnglishLocalizationBundle(),
	faviconProvider: createSiteFaviconProvider( {
		extensionRootUrl: browser.runtime.getURL( '/' ),
		supportsCachedFavicons: import.meta.env.CHROME,
	} ),
	loadLocalization: loadLocalizationBundle,
	now: Date.now,
	pageWindow: window,
	preferencesController,
	settingsPageUrl: browser.runtime.getURL( '/options.html#protected-sites' ),
	shell: popupShell,
	statisticsPageUrl: browser.runtime.getURL( '/options.html#statistics' ),
	statusClient: createPopupStatusClient( { runtime: browser.runtime } ),
} );
