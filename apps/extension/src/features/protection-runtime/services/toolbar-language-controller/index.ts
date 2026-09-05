import {
	DefaultPreferencesDocument,
	type Language,
	type PreferencesDocument,
} from '../../../../domains/preferences/types';
import {
	PreferencesStorageKey,
	parseStoredPreferences,
} from '../../../../domains/preferences/services/preferences-storage';
import {
	type ToolbarBadgeCopy,
	type ToolbarBadgeCopyResult,
	type ToolbarBadgeDurationUnit,
} from '../../utils/toolbar-badge-projection';
import {
	type ToolbarBadgeRefresh,
	type ToolbarLanguageController,
	type ToolbarLanguageControllerOptions,
	type ToolbarLanguageStorageChanges,
} from './types';

/**
 * Language-neutral toolbar projection used while local preferences are loading.
 * @since 0.1.0 Initial implementation.
 */
const PENDING_TOOLBAR_COPY_RESULT: Readonly<ToolbarBadgeCopyResult> = Object.freeze( {
	text: '',
	title: 'TOCus',
} );

/**
 * Creates live toolbar copy synchronized with local language preferences.
 * @param options - Preferences, storage observation, and localized-copy dependencies.
 * @return Toolbar copy proxy and its synchronization lifecycle.
 * @since 0.1.0 Initial implementation.
 */
export function createToolbarLanguageController(
	options: ToolbarLanguageControllerOptions,
): ToolbarLanguageController {
	let activeLanguage = options.browserLanguage;
	let activeToolbarCopy: ToolbarBadgeCopy | null = null;
	let preferencesRevision = 0;

	/**
	 * Toolbar copy proxy that resolves every projection against the active language.
	 * @since 0.1.0 Initial implementation.
	 */
	const copy: ToolbarBadgeCopy = {
		/**
		 * Returns localized inactive copy or the language-neutral loading projection.
		 * @return Current inactive toolbar projection.
		 * @since 0.1.0 Initial implementation.
		 */
		get inactive(): ToolbarBadgeCopyResult {
			return activeToolbarCopy?.inactive ?? PENDING_TOOLBAR_COPY_RESULT;
		},

		/**
		 * Formats one active title in the current language.
		 * @param title - Localized active-state title content.
		 * @return Localized title or the language-neutral product name while loading.
		 * @since 0.1.0 Initial implementation.
		 */
		formatActiveTitle( title: string ): string {
			return activeToolbarCopy?.formatActiveTitle( title ) ?? PENDING_TOOLBAR_COPY_RESULT.title;
		},

		/**
		 * Formats one focused-pause countdown in the current language.
		 * @param amount - Rounded duration amount.
		 * @param unit - Semantic compact-badge unit.
		 * @return Localized toolbar projection or the loading projection.
		 * @since 0.1.0 Initial implementation.
		 */
		formatWaiting( amount: number, unit: ToolbarBadgeDurationUnit ): ToolbarBadgeCopyResult {
			return activeToolbarCopy?.formatWaiting( amount, unit ) ?? PENDING_TOOLBAR_COPY_RESULT;
		},

		/**
		 * Formats one visit-window countdown in the current language.
		 * @param amount - Rounded duration amount.
		 * @param unit - Semantic compact-badge unit.
		 * @return Localized toolbar projection or the loading projection.
		 * @since 0.1.0 Initial implementation.
		 */
		formatAllowance( amount: number, unit: ToolbarBadgeDurationUnit ): ToolbarBadgeCopyResult {
			return activeToolbarCopy?.formatAllowance( amount, unit ) ?? PENDING_TOOLBAR_COPY_RESULT;
		},

		/**
		 * Formats one active-scope indicator in the current language.
		 * @param activeScopeCount - Complete active scope count.
		 * @return Localized compact indicator or empty loading text.
		 * @since 0.1.0 Initial implementation.
		 */
		formatMultipleIndicator( activeScopeCount: number ): string {
			return activeToolbarCopy?.formatMultipleIndicator( activeScopeCount ) ?? PENDING_TOOLBAR_COPY_RESULT.text;
		},

		/**
		 * Formats one several-scope summary in the current language.
		 * @param activeScopeCount - Complete active scope count.
		 * @param visibleScopeCount - Compact count displayed by the browser.
		 * @return Localized toolbar projection or the loading projection.
		 * @since 0.1.0 Initial implementation.
		 */
		formatMultipleActive(
			activeScopeCount: number,
			visibleScopeCount: string,
		): ToolbarBadgeCopyResult {
			return activeToolbarCopy?.formatMultipleActive(
				activeScopeCount,
				visibleScopeCount,
			) ?? PENDING_TOOLBAR_COPY_RESULT;
		},
	};

	/**
	 * Refreshes toolbar presentation without letting presentation failures escape.
	 * @param refreshToolbarBadge - Runtime toolbar refresh operation.
	 * @return Promise resolved after the refresh attempt settles.
	 * @since 0.1.0 Initial implementation.
	 */
	async function refreshSafely( refreshToolbarBadge: ToolbarBadgeRefresh ): Promise<void> {
		try {
			await refreshToolbarBadge();
		} catch {
			return;
		}
	}

	/**
	 * Activates one effective language and refreshes presentation when it changes.
	 * @param language - Browser-derived or explicitly selected language.
	 * @param refreshToolbarBadge - Runtime toolbar refresh operation.
	 * @since 0.1.0 Initial implementation.
	 */
	function applyLanguage(
		language: Language,
		refreshToolbarBadge: ToolbarBadgeRefresh,
	): void {
		if ( activeToolbarCopy !== null && language === activeLanguage ) {
			return;
		}

		activeLanguage = language;
		activeToolbarCopy = options.createToolbarCopy( language );
		void refreshSafely( refreshToolbarBadge );
	}

	/**
	 * Resolves the effective language represented by one stored preferences result.
	 * @param preferences - Valid preferences or a malformed-data marker.
	 * @return Explicit preference or browser-derived fallback.
	 * @since 0.1.0 Initial implementation.
	 */
	function getEffectiveLanguage( preferences: PreferencesDocument | null ): Language {
		return preferences?.language ?? options.browserLanguage;
	}

	/**
	 * Loads persisted language without allowing an older read to replace a newer event.
	 * @param initialRevision - Storage revision observed before the read began.
	 * @param refreshToolbarBadge - Runtime toolbar refresh operation.
	 * @return Promise resolved after the initial read attempt settles.
	 * @since 0.1.0 Initial implementation.
	 */
	async function loadLanguage(
		initialRevision: number,
		refreshToolbarBadge: ToolbarBadgeRefresh,
	): Promise<void> {
		let preferences: PreferencesDocument | null;

		try {
			preferences = await options.storage.load();
		} catch {
			preferences = null;
		}

		if ( preferencesRevision !== initialRevision ) {
			return;
		}

		applyLanguage( getEffectiveLanguage( preferences ), refreshToolbarBadge );
	}

	/**
	 * Restores language preferences and begins observing storage changes.
	 * @param refreshToolbarBadge - Runtime toolbar refresh operation.
	 * @since 0.1.0 Initial implementation.
	 */
	function start( refreshToolbarBadge: ToolbarBadgeRefresh ): void {
		/**
		 * Applies one relevant local preferences change to live toolbar copy.
		 * @param changes - Browser storage changes indexed by key.
		 * @param areaName - Browser storage area that changed.
		 * @since 0.1.0 Initial implementation.
		 */
		function handlePreferencesChange(
			changes: ToolbarLanguageStorageChanges,
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

				applyLanguage( getEffectiveLanguage( preferences ), refreshToolbarBadge );
				return;
			}
		}

		options.storageChanges.addListener( handlePreferencesChange );
		void loadLanguage( preferencesRevision, refreshToolbarBadge );
	}

	return { copy, start };
}

export * from './types';
