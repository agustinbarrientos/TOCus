import { Language, Palette, ThemeMode } from '../../../../domains/preferences/types';

/**
 * Literal English accessible palette names expected by production browser tests.
 * @since 0.1.0
 */
export const BrowserPaletteLabels = {
	[ Palette.BROWN ]: 'Brown',
	[ Palette.GREEN ]: 'Green',
	[ Palette.BLUE ]: 'Blue',
	[ Palette.PURPLE ]: 'Purple',
	[ Palette.PINK ]: 'Pink',
	[ Palette.ORANGE ]: 'Orange',
} as const;

/**
 * Literal English accessible theme names expected by production browser tests.
 * @since 0.1.0
 */
export const BrowserThemeLabels = {
	[ ThemeMode.SYSTEM ]: 'System',
	[ ThemeMode.LIGHT ]: 'Light',
	[ ThemeMode.DARK ]: 'Dark',
} as const;

/**
 * Literal autonyms expected for every language in the native preference selector.
 * @since 0.1.0
 */
export const BrowserLanguageLabels = {
	[ Language.ENGLISH ]: 'English',
	[ Language.SPANISH_TU ]: 'Espa\u00f1ol (t\u00fa)',
	[ Language.SPANISH_VOS ]: 'Espa\u00f1ol (vos)',
	[ Language.PORTUGUESE_BRAZIL ]: 'Portugu\u00eas (Brasil)',
	[ Language.PORTUGUESE_PORTUGAL ]: 'Portugu\u00eas (Portugal)',
	[ Language.ITALIAN ]: 'Italiano',
	[ Language.FRENCH ]: 'Fran\u00e7ais',
	[ Language.GERMAN ]: 'Deutsch',
	[ Language.JAPANESE ]: '\u65e5\u672c\u8a9e',
	[ Language.RUSSIAN ]: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439',
} as const;
