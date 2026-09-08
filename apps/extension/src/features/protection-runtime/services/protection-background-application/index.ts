import { createPreferencesStorageService } from '../../../../domains/preferences/services';
import { createLocalDataReset } from '../../../../domains/local-data/services/local-data-reset';
import { createBrowserProtectionConfigurationEditor } from '../../../../domains/protection/services/browser-protection-configuration-editor';
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
import {
	createProtectedSiteEnrollmentService,
	type ProtectedSiteEnrollmentResult,
} from '../../../protected-sites/services/protected-site-enrollment';
import { createLocalDataResetController } from '../../../settings/services/local-data-reset-controller';
import { revokeWebsiteAccess } from '../../../settings/services/revoke-website-access';
import { createStatisticsRuntime } from '../../../statistics/services/statistics-runtime';
import { createLocalizedToolbarCopy } from '../../../../localization/utils/create-localized-toolbar-copy';
import { createPopupBackgroundController } from '../../../popup/services/popup-background-controller';
import { createPopupEnrollmentController } from '../../../popup/services/popup-enrollment-controller';
import { createBrowserProtectionAdapter } from '../browser-protection-adapter';
import { createBrowserProtectionRuntime } from '../browser-protection-runtime';
import { createProtectionBackgroundController } from '../protection-background-controller';
import { createToolbarLanguageController } from '../toolbar-language-controller';
import { createTabAudioController } from '../tab-audio-controller';
import type { ProtectionBackgroundApplicationOptions, ProtectionBackgroundTabAudioChange } from './types';
import { InterruptionDocumentPath } from '../../../../shared/utils/interruption-document-url';

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
	if ( import.meta.env.CHROME ) {
		/**
		 * Creates one generation-scoped enrollment before synchronously requesting website access.
		 * @param siteInput - Website selected through the popup.
		 * @param independent - Whether the website receives separate timing.
		 * @return Consent-aware persistence result.
		 * @since 0.1.0 Initial implementation.
		 */
		function addWebsite( siteInput: unknown, independent: boolean ): Promise<ProtectedSiteEnrollmentResult> {
			const protection = createBrowserProtectionConfigurationEditor( {
				area: options.browser.storage.local,
				cryptography: crypto,
				locks: navigator.locks,
			} );
			const enrollment = createProtectedSiteEnrollmentService( {
				editor: protection.editor,
				permissionManager,
			} );
			return enrollment.add( siteInput, independent );
		}

		createPopupEnrollmentController( {
			enrollment: { add: addWebsite },
			popupPageUrl: options.browser.runtime.getURL( '/popup.html' ),
			runtime: options.browser.runtime,
		} ).start();
	}
	const tabAudio = createTabAudioController( {
		runtimeId: options.browser.runtime.id,
		tabs: options.browser.tabs,
		storage: options.browser.storage.session,
	} );

	/**
	 * Observes native mute changes before ordinary tab reconciliation can restore audio.
	 * @param tabId - Browser tab whose state changed.
	 * @param change - Browser-reported properties that changed.
	 * @since 0.1.0 Initial implementation.
	 */
	function observeTabAudio( tabId: number, change: ProtectionBackgroundTabAudioChange ): void {
		if ( change.mutedInfo !== undefined ) {
			void tabAudio.observeMuteChange( tabId, change.mutedInfo );
		}
	}

	options.browser.tabs.onUpdated.addListener( observeTabAudio );
	const browserAdapter = createBrowserProtectionAdapter( options.browser, tabAudio );
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

	const interruptionPageUrl = options.browser.runtime.getURL( InterruptionDocumentPath.CURRENT );
	const runtime = createBrowserProtectionRuntime( {
		browser: browserAdapter,
		configurationStorage,
		coordinator,
		filterConfiguration,
		interruptionPageUrl,
		initiallySuspended: true,
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

	/**
	 * Removes website grants and optional live-navigation access through the browser.
	 * @return Whether browser access was fully revoked.
	 * @since 0.1.0 Initial implementation.
	 */
	function revokeAccess(): Promise<boolean> {
		return revokeWebsiteAccess( options.browser.permissions );
	}

	/**
	 * Stops runtime authorities before removing their durable state.
	 * @return Completion of runtime suspension.
	 * @since 0.1.0 Initial implementation.
	 */
	function suspendProtection(): Promise<void> {
		return runtime.suspendForDataReset();
	}

	/**
	 * Restarts runtime authorities before reconciling current browser capabilities.
	 * @return Completion of clean runtime startup.
	 * @since 0.1.0 Initial implementation.
	 */
	async function resumeProtection(): Promise<void> {
		await runtime.resumeAfterDataReset();
		await protectionController.refresh();
	}

	/**
	 * Opens the packaged onboarding page after a complete local reset.
	 * @return Completion of browser tab creation.
	 * @since 0.1.0 Initial implementation.
	 */
	async function openOnboarding(): Promise<void> {
		await options.browser.tabs.create( {
			url: options.browser.runtime.getURL( '/onboarding.html' ),
		} );
	}

	const reset = createLocalDataReset( {
		localArea: options.browser.storage.local,
		sessionArea: options.browser.storage.session,
		locks: navigator.locks,
		createGeneration: createStableId,
		suspend: suspendProtection,
		revokeAccess,
	} );
	const resetController = createLocalDataResetController( {
		optionsPageUrl: options.browser.runtime.getURL( '/options.html' ),
		localArea: options.browser.storage.local,
		onMessage: options.browser.runtime.onMessage,
		reset,
		resume: resumeProtection,
		openOnboarding,
	} );

	protectionController.start();
	popupController.start();
	toolbarLanguageController.start( refreshToolbarBadge );
	resetController.start();
}

export * from './types';
