import { type PreferencesStorageService } from '../../../../domains/preferences/services/preferences-storage';
import {
	type Language,
	type PauseMode,
	type PreferencesDocument,
} from '../../../../domains/preferences/types';

/**
 * Receives an accepted initial or later preferences projection, or a malformed-data marker.
 * @since 0.1.0 Initial implementation.
 */
export type PreferencesChangeListener = ( preferences: PreferencesDocument | null ) => void;

/**
 * Receives one effective browser-derived or explicitly selected language.
 * @since 0.1.0 Initial implementation.
 */
export type PreferencesLanguageChangeListener = ( language: Language ) => void;

/**
 * One browser storage-key change delivered to preference observers.
 * @since 0.1.0 Initial implementation.
 */
export interface PreferencesStorageChange {
	readonly newValue?: unknown;
}

/**
 * Browser storage changes indexed by storage key.
 * @since 0.1.0 Initial implementation.
 */
export type PreferencesStorageChanges = Readonly<Record<string, PreferencesStorageChange>>;

/**
 * Listener for browser storage-area changes.
 * @since 0.1.0 Initial implementation.
 */
export type PreferencesStorageChangeListener = (
	changes: PreferencesStorageChanges,
	areaName: string,
) => void;

/**
 * Browser storage-change source used to synchronize extension contexts.
 * @since 0.1.0 Initial implementation.
 */
export interface PreferencesStorageChangeSource {
	/**
	 * Begins delivering storage changes to one listener.
	 * @param listener - Preferences storage listener.
	 * @since 0.1.0 Initial implementation.
	 */
	addListener( listener: PreferencesStorageChangeListener ): void;

	/**
	 * Stops delivering storage changes to one listener.
	 * @param listener - Preferences storage listener.
	 * @since 0.1.0 Initial implementation.
	 */
	removeListener( listener: PreferencesStorageChangeListener ): void;
}

/**
 * Element-like target that receives appearance and language attributes.
 * @since 0.1.0 Initial implementation.
 */
export interface PreferencesAppearanceTarget {
	/**
	 * Sets one projected preference attribute.
	 * @param name - Projected attribute name.
	 * @param value - Projected attribute value.
	 * @since 0.1.0 Initial implementation.
	 */
	setAttribute( name: string, value: string ): void;
}

/**
 * Interruption presentation that receives the selected pause mode.
 * @since 0.1.0 Initial implementation.
 */
export interface PreferencesPresentation {
	/** User-selected breathing or Quiet pause mode. */
	mode: PauseMode;
}

/**
 * Operating-system reduced-motion preference observed by the controller.
 * @since 0.1.0 Initial implementation.
 */
export interface PreferencesSystemMotionPreference {
	/** Whether the operating system currently requests reduced motion. */
	readonly matches: boolean;

	/**
	 * Begins observing operating-system motion changes.
	 * @param type - Native change event name.
	 * @param listener - Motion change listener.
	 * @since 0.1.0 Initial implementation.
	 */
	addEventListener( type: 'change', listener: EventListenerOrEventListenerObject ): void;

	/**
	 * Stops observing operating-system motion changes.
	 * @param type - Native change event name.
	 * @param listener - Motion change listener.
	 * @since 0.1.0 Initial implementation.
	 */
	removeEventListener( type: 'change', listener: EventListenerOrEventListenerObject ): void;
}

/**
 * Dependencies used to project persisted preferences into one extension context.
 * @since 0.1.0 Initial implementation.
 */
export interface PreferencesControllerOptions {
	appearanceTarget: PreferencesAppearanceTarget;
	/** Browser-derived language used while the user has no explicit selection. */
	browserLanguage: Language;
	presentation?: PreferencesPresentation;
	storage: PreferencesStorageService;
	storageChanges: PreferencesStorageChangeSource;
	systemMotionPreference: PreferencesSystemMotionPreference;
}

/**
 * Live preference projection with effective language and reduced-motion sources.
 * @since 0.1.0 Initial implementation.
 */
export interface PreferencesController {
	/** Whether either the user or operating system currently requests reduced motion. */
	readonly matches: boolean;

	/** Browser-derived or explicitly selected language currently projected by this context. */
	readonly language: Language;

	/**
	 * Projects one in-memory preference preview without persisting it.
	 * @param preferences - Complete preferences to preview.
	 * @since 0.1.0 Initial implementation.
	 */
	apply( preferences: PreferencesDocument ): void;

	/**
	 * Begins observing the accepted initial read and later preferences projections.
	 * @param listener - Preferences projection listener.
	 * @since 0.1.0 Initial implementation.
	 */
	addPreferencesChangeListener( listener: PreferencesChangeListener ): void;

	/**
	 * Begins observing effective language changes.
	 * @param listener - Effective language listener.
	 * @since 0.1.0 Initial implementation.
	 */
	addLanguageChangeListener( listener: PreferencesLanguageChangeListener ): void;

	/**
	 * Begins observing effective reduced-motion changes.
	 * @param type - Effective motion change event name.
	 * @param listener - Effective motion change listener.
	 * @since 0.1.0 Initial implementation.
	 */
	addEventListener( type: 'change', listener: EventListenerOrEventListenerObject ): void;

	/**
	 * Stops observing effective reduced-motion changes.
	 * @param type - Effective motion change event name.
	 * @param listener - Effective motion change listener.
	 * @since 0.1.0 Initial implementation.
	 */
	removeEventListener( type: 'change', listener: EventListenerOrEventListenerObject ): void;

	/**
	 * Stops observing accepted initial and later preferences projections.
	 * @param listener - Preferences projection listener.
	 * @since 0.1.0 Initial implementation.
	 */
	removePreferencesChangeListener( listener: PreferencesChangeListener ): void;

	/**
	 * Stops observing effective language changes.
	 * @param listener - Effective language listener.
	 * @since 0.1.0 Initial implementation.
	 */
	removeLanguageChangeListener( listener: PreferencesLanguageChangeListener ): void;

	/**
	 * Loads and begins observing preferences.
	 * @return Promise resolved after the initial local read settles.
	 * @since 0.1.0 Initial implementation.
	 */
	start(): Promise<void>;

	/**
	 * Stops every preference observer owned by this context.
	 * @since 0.1.0 Initial implementation.
	 */
	stop(): void;
}
