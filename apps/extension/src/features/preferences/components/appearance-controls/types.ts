import {
	type Palette,
	type ThemeMode,
} from '../../../../domains/preferences/types';

/**
 * Localized label and supporting text for one appearance choice.
 * @since 0.1.0 Initial implementation.
 */
export interface AppearanceControlsOptionCopy {
	/** Visible option label. */
	label: string;
	/** Supporting explanation available to visual and assistive-technology users. */
	description: string;
}

/**
 * Localized copy required by the always-visible appearance controls.
 * @since 0.1.0 Initial implementation.
 */
export interface AppearanceControlsCopy {
	/** Theme-section legend. */
	themeLegend: string;
	/** Labels and descriptions for every theme choice. */
	themeOptions: Readonly<Record<ThemeMode, Readonly<AppearanceControlsOptionCopy>>>;
	/** Palette-section legend. */
	paletteLegend: string;
	/** Optional supporting palette explanation. */
	paletteHelp?: string;
	/** Accessible labels for every palette choice. */
	paletteLabels: Readonly<Record<Palette, string>>;
}

/**
 * Controlled theme value selected by the user.
 * @since 0.1.0 Initial implementation.
 */
export interface AppearanceControlsThemeUpdate {
	/** Selected theme mode. */
	theme: ThemeMode;
}

/**
 * Controlled palette value selected by the user.
 * @since 0.1.0 Initial implementation.
 */
export interface AppearanceControlsPaletteUpdate {
	/** Selected full-scene palette. */
	palette: Palette;
}

/**
 * One controlled appearance value selected by the user.
 * @since 0.1.0 Initial implementation.
 */
export type AppearanceControlsUpdate =
	| Readonly<AppearanceControlsThemeUpdate>
	| Readonly<AppearanceControlsPaletteUpdate>;

/**
 * Detail emitted after one controlled appearance value changes.
 * @since 0.1.0 Initial implementation.
 */
export interface AppearanceControlsChangeDetail {
	/** Exact partial preference update selected by the user. */
	update: AppearanceControlsUpdate;
}

/**
 * Native input event emitted by one appearance control.
 * @since 0.1.0 Initial implementation.
 */
export interface AppearanceControlsInputEvent extends Event {
	/** Native input that owns the changed value. */
	readonly currentTarget: HTMLInputElement;
}

/**
 * Name of the composed event emitted after one appearance value changes.
 * @since 0.1.0 Initial implementation.
 */
export const AppearanceControlsChangeEventName = 'tocus-appearance-controls-change';
