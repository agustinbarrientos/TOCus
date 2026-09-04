import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import {
	createPreferencesStorageService,
} from '../../domains/preferences/services';
import {
	PreferencesStorageKey,
	parseStoredPreferences,
} from '../../domains/preferences/services/preferences-storage';
import {
	DefaultPreferencesDocument,
	type Language,
	type PreferencesDocument,
} from '../../domains/preferences/types';
import { resolveLanguage } from '../../domains/preferences/utils';
import {
	createProtectionConfigurationStorageService,
	createProtectionCoordinator,
	createProtectionStorageService,
} from '../../domains/protection';
import {
	createStatisticsSessionStorageService,
	createStatisticsStorageService,
} from '../../domains/statistics';
import { type PreferencesStorageChanges } from '../../features/preferences/services/preferences-controller';
import { createBrowserProtectionAdapter } from '../../features/protection-runtime/services/browser-protection-adapter';
import { createBrowserProtectionRuntime } from '../../features/protection-runtime/services/browser-protection-runtime';
import { createProtectionBackgroundController } from '../../features/protection-runtime/services/protection-background-controller';
import {
	type ToolbarBadgeCopy,
	type ToolbarBadgeCopyResult,
	type ToolbarBadgeDurationUnit,
} from '../../features/protection-runtime/utils/toolbar-badge-projection';
import { createLocalizedToolbarCopy } from '../../localization/utils/create-localized-toolbar-copy';
import { createSitePermissionManager } from '../../features/protected-sites/services/site-permission-manager';
import { createStatisticsRuntime } from '../../features/statistics/services/statistics-runtime';

/**
 * Language-neutral toolbar projection used until the persisted preference is known.
 * @since 0.1.0 Initial implementation.
 */
const PendingToolbarCopyResult: Readonly<ToolbarBadgeCopyResult> = Object.freeze( {
	text: '',
	title: 'TOCus',
} );

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
	const browserLanguage = resolveLanguage( browser.i18n.getUILanguage() );
	const interruptionPageUrl = browser.runtime.getURL( '/interruption.html' );
	const optionsPageUrl = browser.runtime.getURL( '/options.html' );
	const preferencesStorage = createPreferencesStorageService( {
		area: browser.storage.local,
	} );
	let activeLanguage = browserLanguage;
	let activeToolbarCopy: Readonly<ToolbarBadgeCopy> | null = null;
	let preferencesRevision = 0;

	/**
	 * Live toolbar copy that delegates each projection to the active localization bundle.
	 * @since 0.1.0 Initial implementation.
	 */
	const toolbarBadgeCopy: ToolbarBadgeCopy = {
		/**
		 * Returns the localized inactive state from the current language.
		 * @return Localized inactive toolbar projection.
		 * @since 0.1.0 Initial implementation.
		 */
		get inactive(): ToolbarBadgeCopyResult {
			return activeToolbarCopy?.inactive ?? PendingToolbarCopyResult;
		},

		/**
		 * Wraps one active title in the current language without exposing fallback prose.
		 * @param title - Localized active-state title content.
		 * @return Complete localized title, or the language-neutral product name while loading.
		 * @since 0.1.0 Initial implementation.
		 */
		formatActiveTitle( title: string ): string {
			return activeToolbarCopy?.formatActiveTitle( title ) ?? PendingToolbarCopyResult.title;
		},

		/**
		 * Formats one focused-pause countdown in the current language.
		 * @param amount - Rounded duration amount.
		 * @param unit - Semantic compact-badge unit.
		 * @return Localized toolbar projection.
		 * @since 0.1.0 Initial implementation.
		 */
		formatWaiting( amount: number, unit: ToolbarBadgeDurationUnit ): ToolbarBadgeCopyResult {
			return activeToolbarCopy?.formatWaiting( amount, unit ) ?? PendingToolbarCopyResult;
		},

		/**
		 * Formats one visit-window countdown in the current language.
		 * @param amount - Rounded duration amount.
		 * @param unit - Semantic compact-badge unit.
		 * @return Localized toolbar projection.
		 * @since 0.1.0 Initial implementation.
		 */
		formatAllowance( amount: number, unit: ToolbarBadgeDurationUnit ): ToolbarBadgeCopyResult {
			return activeToolbarCopy?.formatAllowance( amount, unit ) ?? PendingToolbarCopyResult;
		},

		/**
		 * Formats one active-scope badge indicator in the current language.
		 * @param activeScopeCount - Complete active scope count.
		 * @return Localized compact indicator, or no badge text while loading.
		 * @since 0.1.0 Initial implementation.
		 */
		formatMultipleIndicator( activeScopeCount: number ): string {
			return activeToolbarCopy?.formatMultipleIndicator( activeScopeCount ) ?? PendingToolbarCopyResult.text;
		},

		/**
		 * Formats a several-scope summary in the current language.
		 * @param activeScopeCount - Complete active scope count.
		 * @param visibleScopeCount - Compact count displayed by the browser.
		 * @return Localized toolbar projection.
		 * @since 0.1.0 Initial implementation.
		 */
		formatMultipleActive(
			activeScopeCount: number,
			visibleScopeCount: string,
		): ToolbarBadgeCopyResult {
			return activeToolbarCopy?.formatMultipleActive(
				activeScopeCount,
				visibleScopeCount,
			) ?? PendingToolbarCopyResult;
		},
	};
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
		toolbarBadgeCopy,
	} );
	const controller = createProtectionBackgroundController( {
		browser,
		interruptionPageUrl,
		optionsPageUrl,
		runtime,
	} );


	/**
	 * Refreshes the current toolbar projection without allowing presentation failure to stop protection.
	 * @return Promise resolved after the refresh attempt settles.
	 * @since 0.1.0 Initial implementation.
	 */
	async function refreshToolbarBadge(): Promise<void> {
		try {
			await runtime.refreshToolbarBadge();
		} catch {
			// Toolbar presentation is non-authoritative and must not interrupt protection.
		}
	}

	/**
	 * Activates one effective language and refreshes the toolbar when it changed.
	 * @param language - Browser-derived or explicitly selected language.
	 * @since 0.1.0 Initial implementation.
	 */
	function applyToolbarLanguage( language: Language ): void {
		if ( activeToolbarCopy !== null && language === activeLanguage ) {
			return;
		}

		activeLanguage = language;
		activeToolbarCopy = createLocalizedToolbarCopy( language );
		void refreshToolbarBadge();
	}

	/**
	 * Resolves the effective language represented by one stored preferences result.
	 * @param preferences - Valid preferences or a malformed-data marker.
	 * @return Explicit preference or browser-derived fallback.
	 * @since 0.1.0 Initial implementation.
	 */
	function getEffectiveLanguage( preferences: PreferencesDocument | null ): Language {
		return preferences?.language ?? browserLanguage;
	}

	/**
	 * Applies one relevant local preferences change to live toolbar copy.
	 * @param changes - Browser storage changes indexed by key.
	 * @param areaName - Browser storage area that changed.
	 * @since 0.1.0 Initial implementation.
	 */
	function handlePreferencesChange(
		changes: PreferencesStorageChanges,
		areaName: string,
	): void {
		if ( areaName !== 'local' ) {
			return;
		}

		for ( const [ storageKey, change ] of Object.entries( changes ) ) {
			if ( storageKey !== PreferencesStorageKey.PREFERENCES ) {
				continue;
			}

			preferencesRevision += 1;
			const preferences = change.newValue === undefined
				? DefaultPreferencesDocument
				: parseStoredPreferences( change.newValue );

			applyToolbarLanguage( getEffectiveLanguage( preferences ) );
			return;
		}
	}

	/**
	 * Loads persisted toolbar language without allowing an older read to replace a newer storage event.
	 * @param initialRevision - Storage revision observed before the read began.
	 * @return Promise resolved after the initial read attempt settles.
	 * @since 0.1.0 Initial implementation.
	 */
	async function loadToolbarLanguage( initialRevision: number ): Promise<void> {
		let preferences: PreferencesDocument | null;

		try {
			preferences = await preferencesStorage.load();
		} catch {
			preferences = null;
		}

		if ( preferencesRevision !== initialRevision ) {
			return;
		}

		applyToolbarLanguage( getEffectiveLanguage( preferences ) );
	}

	browser.storage.onChanged.addListener( handlePreferencesChange );
	controller.start();
	void loadToolbarLanguage( preferencesRevision );
}

/**
 * Starts browser-backed protection-state restoration for each background runtime.
 * @since 0.1.0 Initial implementation.
 */
export default defineBackground( {
	persistent: false,
	main: startProtectionBackground,
} );
