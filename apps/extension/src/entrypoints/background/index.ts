import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import {
	createProtectionConfigurationStorageService,
	createProtectionCoordinator,
	createProtectionStorageService,
} from '../../domains/protection';
import {
	createStatisticsSessionStorageService,
	createStatisticsStorageService,
} from '../../domains/statistics';
import { createBrowserProtectionAdapter } from '../../features/protection-runtime/services/browser-protection-adapter';
import { createBrowserProtectionRuntime } from '../../features/protection-runtime/services/browser-protection-runtime';
import { createProtectionBackgroundController } from '../../features/protection-runtime/services/protection-background-controller';
import { createSitePermissionManager } from '../../features/protected-sites/services/site-permission-manager';
import { createStatisticsRuntime } from '../../features/statistics/services/statistics-runtime';

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
 * Creates protection services and synchronously registers browser event listeners.
 * @since 0.1.0 Initial implementation.
 */
function startProtectionBackground(): void {
	const interruptionPageUrl = browser.runtime.getURL( '/interruption.html' );
	const optionsPageUrl = browser.runtime.getURL( '/options.html' );
	const storage = createProtectionStorageService( {
		durableArea: browser.storage.local,
		sessionArea: browser.storage.session,
		createSnapshotId: crypto.randomUUID.bind( crypto ),
	} );
	const coordinator = createProtectionCoordinator( {
		storage,
		createProtectionFactBatchId: crypto.randomUUID.bind( crypto ),
		createSessionContinuityId: crypto.randomUUID.bind( crypto ),
	} );
	const configurationStorage = createProtectionConfigurationStorageService( {
		area: browser.storage.local,
	} );
	const permissionManager = createSitePermissionManager( {
		permissions: browser.permissions,
	} );
	const browserAdapter = createBrowserProtectionAdapter( browser );
	const statisticsStorage = createStatisticsStorageService( {
		area: browser.storage.local,
		createGenerationId: crypto.randomUUID.bind( crypto ),
	} );
	const statisticsSessionStorage = createStatisticsSessionStorageService( {
		area: browser.storage.session,
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
	} );
	const controller = createProtectionBackgroundController( {
		browser,
		interruptionPageUrl,
		optionsPageUrl,
		runtime,
	} );

	controller.start();
}

/**
 * Starts browser-backed protection-state restoration for each background runtime.
 * @since 0.1.0 Initial implementation.
 */
export default defineBackground( {
	persistent: false,
	main: startProtectionBackground,
} );
