import type { Language, Palette, ThemeMode } from '../../../apps/extension/src/domains/preferences/types';

/**
 * Named, product-valid appearance covered by the screenshot matrix.
 * @since 0.1.0
 */
export interface VisualAppearance {
	name: string;
	theme: ThemeMode;
	palette: Palette;
}

/**
 * Regional onboarding selection exercised through the real language controls.
 * @since 0.1.0
 */
export interface VisualLanguage {
	name: string;
	language: Language;
	familyLabel: string;
	variantLabel: string;
}
