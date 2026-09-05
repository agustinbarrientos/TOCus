import { createPreferencesStorageService } from '../../../../domains/preferences/services';
import { resolveLanguage } from '../../../../domains/preferences/utils';
import {
	createProtectionConfigurationStorageService,
	createProtectionCoordinator,
	createProtectionStorageService,
} from '../../../../domains/protection';
import {
	createStatisticsSessionStorageService,
	createStatisticsStorageService,
} from '../../../../domains/statistics';
import { registerOnboardingOpenOnInstall } from '../../../onboarding/services/open-on-install';
import { createSitePermissionManager } from '../../../protected-sites/services/site-permission-manager';
import { createStatisticsRuntime } from '../../../statistics/services/statistics-runtime';
import { createLocalizedToolbarCopy } from '../../../../localization/utils/create-localized-toolbar-copy';
import { createPopupBackgroundController } from '../../../popup/services/popup-background-controller';
import { createBrowserProtectionAdapter } from '../browser-protection-adapter';
import { createBrowserProtectionRuntime } from '../browser-protection-runtime';
import { createProtectionBackgroundController } from '../protection-background-controller';
import { createToolbarLanguageController } from '../toolbar-language-controller';
import { type ProtectionBackgroundApplicationOptions } from './types';

/**
 * Creates one collision-resistant runtime identifier fragment.
 * @return Fresh browser-local identifier fragment.
 * @since 0.1.0 Initial implementation.
 */
function createStableId(): string {
	return crypto.randomUUID();
}

/**
 * Returns the current wall-clock epoch time.
 * @return Current epoch milliseconds.
 * @since 0.1.0 Initial implementation.
 */
function getCurrentTime(): number {
	return Date.now();
}

/**
 * Returns the browser's current IANA time zone.
 * @return Current IANA time-zone identifier.
 * @since 0.1.0 Initial implementation.
 */
function getTimeZone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Constructs browser-backed protection services and starts their synchronous controllers.
 * @param options - Browser APIs used by the background application.
 * @since 0.1.0 Initial implementation.
 */
export function startProtectionBackgroundApplication(
	options: ProtectionBackgroundApplicationOptions,
): void {
	registerOnboardingOpenOnInstall( { browser: options.browser } );
	const preferencesStorage = createPreferencesStorageService( {
		area: options.browser.storage.local,
	} );
	const toolbarLanguageController = createToolbarLanguageController( {
		browserLanguage: resolveLanguage( options.browser.i18n.getUILanguage() ),
		createToolbarCopy: createLocalizedToolbarCopy,
		storage: preferencesStorage,
		storageChanges: options.browser.storage.onChanged,
	} );
	const storage = createProtectionStorageService( {
		durableArea: options.browser.storage.local,
		sessionArea: options.browser.storage.session,
		createSnapshotId: createStableId,
	} );
	const coordinator = createProtectionCoordinator( {
		storage,
		createProtectionFactBatchId: createStableId,
		createSessionContinuityId: createStableId,
	} );
	const configurationStorage = createProtectionConfigurationStorageService( {
		area: options.browser.storage.local,
	} );
	const permissionManager = createSitePermissionManager( {
		permissions: options.browser.permissions,
	} );
	const browserAdapter = createBrowserProtectionAdapter( options.browser );
	const statisticsStorage = createStatisticsStorageService( {
		area: options.browser.storage.local,
		createGenerationId: createStableId,
	} );
	const statisticsSessionStorage = createStatisticsSessionStorageService( {
		area: options.browser.storage.session,
		createFocusEpochId: createStableId,
	} );
	const statisticsRuntime = createStatisticsRuntime( {
		coordinator,
		createGenerationId: createStableId,
		sessionStorage: statisticsSessionStorage,
		storage: statisticsStorage,
	} );

	/**
	 * Filters runtime configuration without detaching the permission-manager method.
	 * @param configuration - Validated persisted protection configuration.
	 * @return Valid permission-aware runtime configuration.
	 * @since 0.1.0 Initial implementation.
	 */
	function filterConfiguration(
		configuration: Parameters<typeof permissionManager.filterConfiguration>[ 0 ],
	): ReturnType<typeof permissionManager.filterConfiguration> {
		return permissionManager.filterConfiguration( configuration );
	}

	const interruptionPageUrl = options.browser.runtime.getURL( '/interruption.html' );
	const runtime = createBrowserProtectionRuntime( {
		browser: browserAdapter,
		configurationStorage,
		coordinator,
		filterConfiguration,
		interruptionPageUrl,
		createStableId,
		getTimeZone,
		now: getCurrentTime,
		statisticsRuntime,
		toolbarBadgeCopy: toolbarLanguageController.copy,
	} );
	const protectionController = createProtectionBackgroundController( {
		browser: options.browser,
		interruptionPageUrl,
		optionsPageUrl: options.browser.runtime.getURL( '/options.html' ),
		runtime,
	} );

	/**
	 * Refreshes capability-aware protection through its owning controller.
	 * @return Promise resolved after protection reconciliation settles.
	 * @since 0.1.0 Initial implementation.
	 */
	function refreshProtection(): Promise<void> {
		return protectionController.refresh();
	}

	/**
	 * Waits for initial protection-capability detection to settle.
	 * @return Promise resolved after the capability barrier settles.
	 * @since 0.1.0 Initial implementation.
	 */
	function waitForProtectionReady(): Promise<void> {
		return protectionController.waitUntilReady();
	}

	const popupController = createPopupBackgroundController( {
		browser: options.browser,
		configurationStorage,
		getTimeZone,
		interruptionPageUrl,
		now: getCurrentTime,
		popupPageUrl: options.browser.runtime.getURL( '/popup.html' ),
		refreshProtection,
		runtime,
		waitForProtectionReady,
	} );

	/**
	 * Reprojects the toolbar through the active browser protection runtime.
	 * @return Promise resolved after the toolbar update settles.
	 * @since 0.1.0 Initial implementation.
	 */
	function refreshToolbarBadge(): Promise<void> {
		return runtime.refreshToolbarBadge();
	}

	protectionController.start();
	popupController.start();
	toolbarLanguageController.start( refreshToolbarBadge );
}

export * from './types';
