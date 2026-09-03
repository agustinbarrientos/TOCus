import { type PreferencesStorageService } from '../../../../domains/preferences/services/preferences-storage';
import { type PauseMode, type PreferencesDocument } from '../../../../domains/preferences/types';

/**
 * Receives one validated preferences projection or a malformed-data marker.
 * @since 0.1.0 Initial implementation.
 */
export type PreferencesChangeListener = ( preferences: PreferencesDocument | null ) => void;

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
 * Element-like target that receives theme and palette attributes.
 * @since 0.1.0 Initial implementation.
 */
export interface PreferencesAppearanceTarget {
	/**
	 * Sets one appearance attribute.
	 * @param name - Appearance attribute name.
	 * @param value - Persisted preference value.
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
	presentation?: PreferencesPresentation;
	storage: PreferencesStorageService;
	storageChanges: PreferencesStorageChangeSource;
	systemMotionPreference: PreferencesSystemMotionPreference;
}

/**
 * Live preference projection and effective reduced-motion source.
 * @since 0.1.0 Initial implementation.
 */
export interface PreferencesController {
	/** Whether either the user or operating system currently requests reduced motion. */
	readonly matches: boolean;

	/**
	 * Projects one in-memory preference preview without persisting it.
	 * @param preferences - Complete preferences to preview.
	 * @since 0.1.0 Initial implementation.
	 */
	apply( preferences: PreferencesDocument ): void;

	/**
	 * Begins observing validated preferences projections and malformed-data markers.
	 * @param listener - Preferences projection listener.
	 * @since 0.1.0 Initial implementation.
	 */
	addPreferencesChangeListener( listener: PreferencesChangeListener ): void;

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
	 * Stops observing validated preferences projections and malformed-data markers.
	 * @param listener - Preferences projection listener.
	 * @since 0.1.0 Initial implementation.
	 */
	removePreferencesChangeListener( listener: PreferencesChangeListener ): void;

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
