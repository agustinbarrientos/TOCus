import { type I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { Palette, ThemeMode } from '../../../domains/preferences/types';
import { type OnboardingAppearanceStepCopy } from '../../../features/onboarding/components/appearance-step/types';

/**
 * Creates localized onboarding Appearance-step copy.
 * @param i18n - Locale-specific Lingui instance.
 * @return Complete localized Appearance-step copy.
 * @since 0.1.0 Initial implementation.
 */
export function createOnboardingAppearanceStepCopy( i18n: I18n ): Readonly<OnboardingAppearanceStepCopy> {
	return Object.freeze( {
		title: i18n._( msg`Make TOCus yours` ),
		introduction: i18n._( msg`Choose the appearance and color that feel right for you.` ),
		themeLegend: i18n._( msg`Appearance` ),
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
		paletteLegend: i18n._( msg`Color` ),
		paletteLabels: Object.freeze( {
			[ Palette.BROWN ]: i18n._( msg`Brown` ),
			[ Palette.GREEN ]: i18n._( msg`Green` ),
			[ Palette.BLUE ]: i18n._( msg`Blue` ),
			[ Palette.PURPLE ]: i18n._( msg`Purple` ),
			[ Palette.PINK ]: i18n._( msg`Pink` ),
			[ Palette.ORANGE ]: i18n._( msg`Orange` ),
		} ),
		previewTitle: i18n._( msg`This is what you'll see` ),
		continueLabel: i18n._( msg`Continue` ),
	} );
}
