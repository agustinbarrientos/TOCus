import {
	Palette,
	PauseMode,
	ThemeMode,
	type Palette as PaletteValue,
	type PauseMode as PauseModeValue,
	type PreferencesDocument,
	type ThemeMode as ThemeModeValue,
} from '../../../../domains/preferences/types';

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
 * Localizable label and supporting text for one appearance choice.
 * @since 0.1.0 Initial implementation.
 */
export interface AppearanceOptionCopy {
	label: string;
	description: string;
}

/**
 * Localizable messages rendered by the Appearance settings screen.
 * @since 0.1.0 Initial implementation.
 */
export interface AppearanceScreenCopy {
	eyebrow: string;
	title: string;
	introduction: string;
	formLabel: string;
	themeLegend: string;
	themeOptions: Readonly<Record<ThemeModeValue, Readonly<AppearanceOptionCopy>>>;
	paletteLegend: string;
	paletteHelp: string;
	paletteLabels: Readonly<Record<PaletteValue, string>>;
	pauseModeLegend: string;
	pauseModeOptions: Readonly<Record<PauseModeValue, Readonly<AppearanceOptionCopy>>>;
	accessibilityLegend: string;
	reducedMotionLabel: string;
	reducedMotionDescription: string;
	loading: string;
	malformedDataTitle: string;
	malformedDataDescription: string;
	loadErrorTitle: string;
	loadErrorDescription: string;
	restoreDefaults: string;
	restoreDefaultsError: string;
	retry: string;
	saveError: string;
	savedAnnouncement: string;
}

/**
 * Default English messages rendered by the Appearance settings screen.
 * @since 0.1.0 Initial implementation.
 */
export const DefaultAppearanceScreenCopy: Readonly<AppearanceScreenCopy> = Object.freeze( {
	eyebrow: 'Personalization',
	title: 'Appearance',
	introduction: 'Choose the colors and pause style that feel right for you.',
	formLabel: 'Appearance and accessibility preferences',
	themeLegend: 'Theme',
	themeOptions: Object.freeze( {
		[ ThemeMode.SYSTEM ]: Object.freeze( {
			label: 'System',
			description: 'Follow your device appearance.',
		} ),
		[ ThemeMode.LIGHT ]: Object.freeze( {
			label: 'Light',
			description: 'Use a light appearance.',
		} ),
		[ ThemeMode.DARK ]: Object.freeze( {
			label: 'Dark',
			description: 'Use a dark appearance.',
		} ),
	} ),
	paletteLegend: 'Color palette',
	paletteHelp: 'The selected palette colors the complete pause experience.',
	paletteLabels: Object.freeze( {
		[ Palette.BROWN ]: 'Brown',
		[ Palette.GREEN ]: 'Green',
		[ Palette.BLUE ]: 'Blue',
		[ Palette.PURPLE ]: 'Purple',
		[ Palette.PINK ]: 'Pink',
		[ Palette.ORANGE ]: 'Orange',
	} ),
	pauseModeLegend: 'Pause style',
	pauseModeOptions: Object.freeze( {
		[ PauseMode.BREATHING ]: Object.freeze( {
			label: 'Breathing',
			description: 'A soft sphere guides your breathing.',
		} ),
		[ PauseMode.QUIET ]: Object.freeze( {
			label: 'Quiet pause',
			description: 'A still pause with no breathing cue.',
		} ),
	} ),
	accessibilityLegend: 'Accessibility',
	reducedMotionLabel: 'Reduce motion',
	reducedMotionDescription: 'Keep the pause still and remove movement.',
	loading: 'Loading appearance settings...',
	malformedDataTitle: 'Appearance settings need your attention',
	malformedDataDescription: 'Your local appearance data is not valid, so it was not replaced.',
	loadErrorTitle: 'Appearance settings could not load',
	loadErrorDescription: 'TOCus could not load local appearance settings. Nothing was changed.',
	restoreDefaults: 'Restore defaults',
	restoreDefaultsError: 'TOCus could not restore the default appearance settings. Nothing was changed.',
	retry: 'Try again',
	saveError: 'Your appearance could not be saved. Your choice is still shown here.',
	savedAnnouncement: 'Appearance saved.',
} );
