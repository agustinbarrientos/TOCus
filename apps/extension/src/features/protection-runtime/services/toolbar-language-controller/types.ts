import { type PreferencesStorageService } from '../../../../domains/preferences/services/preferences-storage';
import { type Language } from '../../../../domains/preferences/types';
import { type ToolbarBadgeCopy } from '../../utils/toolbar-badge-projection';

/**
 * Creates localized toolbar copy for one effective language.
 * @since 0.1.0 Initial implementation.
 */
export type ToolbarCopyFactory = ( language: Language ) => Readonly<ToolbarBadgeCopy>;

/**
 * Refreshes the browser toolbar with the current runtime projection.
 * @since 0.1.0 Initial implementation.
 */
export type ToolbarBadgeRefresh = () => Promise<void>;

/**
 * One browser storage-key change observed by toolbar localization.
 * @since 0.1.0 Initial implementation.
 */
export interface ToolbarLanguageStorageChange {
	/** Newly stored value, or undefined after the key is removed. */
	readonly newValue?: unknown;
}

/**
 * Browser storage changes indexed by key.
 * @since 0.1.0 Initial implementation.
 */
export type ToolbarLanguageStorageChanges = Readonly<Record<string, ToolbarLanguageStorageChange>>;

/**
 * Listener receiving one browser storage change collection.
 * @since 0.1.0 Initial implementation.
 */
export type ToolbarLanguageStorageChangeListener = (
	changes: ToolbarLanguageStorageChanges,
	areaName: string,
) => void;

/**
 * Browser storage-change source used by toolbar localization.
 * @since 0.1.0 Initial implementation.
 */
export interface ToolbarLanguageStorageChangeSource {
	/**
	 * Begins delivering browser storage changes to one listener.
	 * @param listener - Toolbar language storage listener.
	 * @since 0.1.0 Initial implementation.
	 */
	addListener( listener: ToolbarLanguageStorageChangeListener ): void;
}

/**
 * Dependencies used to synchronize toolbar copy with local language preferences.
 * @since 0.1.0 Initial implementation.
 */
export interface ToolbarLanguageControllerOptions {
	/** Browser-derived language used when no valid explicit selection is stored. */
	browserLanguage: Language;
	/** Factory for synchronous localized toolbar copy. */
	createToolbarCopy: ToolbarCopyFactory;
	/** Local preferences persistence. */
	storage: PreferencesStorageService;
	/** Browser storage changes used to synchronize extension contexts. */
	storageChanges: ToolbarLanguageStorageChangeSource;
}

/**
 * Live toolbar copy and its preference synchronization lifecycle.
 * @since 0.1.0 Initial implementation.
 */
export interface ToolbarLanguageController {
	/** Language-neutral proxy that delegates to localized copy after restoration. */
	readonly copy: ToolbarBadgeCopy;

	/**
	 * Restores language preferences and begins observing storage changes.
	 * @param refreshToolbarBadge - Runtime operation that reprojects the visible toolbar state.
	 * @since 0.1.0 Initial implementation.
	 */
	start( refreshToolbarBadge: ToolbarBadgeRefresh ): void;
}
