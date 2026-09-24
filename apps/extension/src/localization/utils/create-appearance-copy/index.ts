import type { I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { Palette, PauseMode, ThemeMode } from '../../../domains/preferences/types';
import type { AppearanceScreenCopy } from '../../../features/settings/components/appearance-screen/types';

/**
 * Creates localized Appearance-screen copy.
 * @param i18n - Locale-specific Lingui instance.
 * @return Complete localized Appearance-screen copy.
 * @since 1.0.0 Initial implementation.
 */
export function createAppearanceCopy( i18n: I18n ): Readonly<AppearanceScreenCopy> {
	return Object.freeze( {
		title: i18n._( msg`Appearance` ),
		formLabel: i18n._( msg`Appearance preferences` ),
		themeLegend: i18n._( msg`Theme` ),
		themeOptions: Object.freeze( {
			[ ThemeMode.SYSTEM ]: Object.freeze( {
				label: i18n._( msg`System` ),
				description: i18n._( msg`Follow your device appearance.` ),
			} ),
			[ ThemeMode.LIGHT ]: Object.freeze( {
				label: i18n._( msg`Light` ),
				description: i18n._( msg`Use a light appearance.` ),
			} ),
			[ ThemeMode.DARK ]: Object.freeze( {
				label: i18n._( msg`Dark` ),
				description: i18n._( msg`Use a dark appearance.` ),
			} ),
		} ),
		paletteLegend: i18n._( msg`Color palette` ),
		paletteLabels: Object.freeze( {
			[ Palette.BROWN ]: i18n._( msg`Brown` ),
			[ Palette.GREEN ]: i18n._( msg`Green` ),
			[ Palette.BLUE ]: i18n._( msg`Blue` ),
			[ Palette.PURPLE ]: i18n._( msg`Purple` ),
			[ Palette.PINK ]: i18n._( msg`Pink` ),
			[ Palette.ORANGE ]: i18n._( msg`Orange` ),
		} ),
		pauseModeLegend: i18n._( msg`Pause style` ),
		pauseModeOptions: Object.freeze( {
			[ PauseMode.BREATHING ]: Object.freeze( {
				label: i18n._( msg`Breathing` ),
				description: i18n._( msg`A soft sphere guides your breathing.` ),
			} ),
			[ PauseMode.QUIET ]: Object.freeze( {
				label: i18n._( msg`Pause` ),
				description: i18n._( msg`A still pause with no breathing cue.` ),
			} ),
		} ),
		loading: i18n._( msg`Loading appearance settings...` ),
		malformedDataTitle: i18n._( msg`Personalization settings need your attention` ),
		malformedDataDescription: i18n._(
			msg`Your local personalization data isn't valid. Restoring defaults will reset appearance, pause, and language preferences.`,
		),
		loadErrorTitle: i18n._( msg`Appearance settings couldn't load` ),
		loadErrorDescription: i18n._( msg`TOCus couldn't load local appearance settings. Nothing was changed.` ),
		restoreDefaults: i18n._( msg`Restore personalization defaults` ),
		restoreDefaultsError: i18n._( msg`TOCus couldn't restore your personalization defaults. Nothing was changed.` ),
		retry: i18n._( msg`Try again` ),
		saveError: i18n._( msg`Your appearance couldn't be saved. Your choice is still shown here.` ),
		save: i18n._( msg`Save` ),
		saving: i18n._( msg`Saving...` ),
		discard: i18n._( msg`Discard` ),
		restoredAnnouncement: i18n._( msg`Personalization defaults restored.` ),
	} );
}
