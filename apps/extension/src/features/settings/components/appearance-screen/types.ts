import type {
	PauseMode as PauseModeValue,
	PreferencesDocument,
} from '../../../../domains/preferences/types';
import type {
	AppearanceControlsCopy,
	AppearanceControlsOptionCopy,
} from '../../../preferences/components/appearance-controls/types';

/**
 * Stable loading states rendered by the Appearance settings screen.
 * @since 0.1.0 Initial implementation.
 */
export const AppearanceScreenLoadStatus = {
	FAILED: 'failed',
	LOADING: 'loading',
	MALFORMED: 'malformed',
	READY: 'ready',
} as const;

/**
 * Current loading state rendered by the Appearance settings screen.
 * @since 0.1.0 Initial implementation.
 */
export type AppearanceScreenLoadStatus = typeof AppearanceScreenLoadStatus[
	keyof typeof AppearanceScreenLoadStatus
];

/**
 * Native input change whose current target is one appearance control.
 * @since 0.1.0 Initial implementation.
 */
export interface AppearanceInputEvent extends Event {
	readonly currentTarget: HTMLInputElement;
}

/**
 * Live appearance projection used while preferences are edited.
 * @since 0.1.0 Initial implementation.
 */
export interface PreferencesPreview {
	/**
	 * Projects complete preferences without persisting them.
	 * @param preferences - Preferences selected by the user.
	 * @since 0.1.0 Initial implementation.
	 */
	apply( preferences: PreferencesDocument ): void;
}

/**
 * Receives one validated preferences projection or a malformed-data marker from another local context.
 * @since 0.1.0 Initial implementation.
 */
export type AppearancePreferencesChangeListener = (
	preferences: PreferencesDocument | null,
) => void;

/**
 * Validated preferences projections and malformed-data markers observed by the Appearance screen.
 * @since 0.1.0 Initial implementation.
 */
export interface PreferencesSource {
	/**
	 * Begins observing validated preferences projections and malformed-data markers.
	 * @param listener - Preferences projection listener.
	 * @since 0.1.0 Initial implementation.
	 */
	addPreferencesChangeListener( listener: AppearancePreferencesChangeListener ): void;

	/**
	 * Stops observing validated preferences projections and malformed-data markers.
	 * @param listener - Preferences projection listener.
	 * @since 0.1.0 Initial implementation.
	 */
	removePreferencesChangeListener( listener: AppearancePreferencesChangeListener ): void;
}

/**
 * Localizable messages rendered by the Appearance settings screen.
 * @since 0.1.0 Initial implementation.
 */
export interface AppearanceScreenCopy extends AppearanceControlsCopy {
	/** Settings-page eyebrow. */
	eyebrow: string;
	/** Settings-page heading. */
	title: string;
	/** Settings-page introduction. */
	introduction: string;
	/** Accessible label for the complete Settings form. */
	formLabel: string;
	/** Required supporting palette explanation on the Settings page. */
	paletteHelp: string;
	/** Pause-style section legend. */
	pauseModeLegend: string;
	/** Labels and descriptions for every pause-style choice. */
	pauseModeOptions: Readonly<Record<PauseModeValue, Readonly<AppearanceControlsOptionCopy>>>;
	/** Accessibility section legend. */
	accessibilityLegend: string;
	/** Reduced-motion checkbox label. */
	reducedMotionLabel: string;
	/** Reduced-motion checkbox description. */
	reducedMotionDescription: string;
	/** Loading-state message. */
	loading: string;
	/** Malformed-data recovery heading. */
	malformedDataTitle: string;
	/** Malformed-data recovery explanation. */
	malformedDataDescription: string;
	/** Failed-load heading. */
	loadErrorTitle: string;
	/** Failed-load explanation. */
	loadErrorDescription: string;
	/** Malformed-data recovery action. */
	restoreDefaults: string;
	/** Malformed-data recovery failure. */
	restoreDefaultsError: string;
	/** Failed-load retry action. */
	retry: string;
	/** Preference persistence failure. */
	saveError: string;
	/** Preference persistence success announcement. */
	savedAnnouncement: string;
	/** Malformed-data recovery success announcement. */
	restoredAnnouncement: string;
}
