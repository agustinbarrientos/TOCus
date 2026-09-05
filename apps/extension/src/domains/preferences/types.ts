import { z } from 'zod';

/**
 * Languages available throughout TOCus.
 * @since 0.1.0 Initial implementation.
 */
export const Language = {
	ENGLISH: 'en',
	SPANISH_TU: 'es-tu',
	SPANISH_VOS: 'es-vos',
	PORTUGUESE_BRAZIL: 'pt-BR',
	PORTUGUESE_PORTUGAL: 'pt-PT',
	ITALIAN: 'it',
	FRENCH: 'fr',
	GERMAN: 'de',
	JAPANESE: 'ja',
	RUSSIAN: 'ru',
} as const;

/**
 * Validates a supported TOCus language.
 * @since 0.1.0 Initial implementation.
 */
export const LanguageSchema = z.enum( Language );

/**
 * Supported TOCus language.
 * @since 0.1.0 Initial implementation.
 */
export type Language = z.infer<typeof LanguageSchema>;

/**
 * Theme modes available throughout TOCus.
 * @since 0.1.0 Initial implementation.
 */
export const ThemeMode = {
	SYSTEM: 'system',
	LIGHT: 'light',
	DARK: 'dark',
} as const;

/**
 * Validates a supported theme mode.
 * @since 0.1.0 Initial implementation.
 */
export const ThemeModeSchema = z.enum( ThemeMode );

/**
 * User-selected theme mode.
 * @since 0.1.0 Initial implementation.
 */
export type ThemeMode = z.infer<typeof ThemeModeSchema>;

/**
 * Curated color palettes available throughout TOCus.
 * @since 0.1.0 Initial implementation.
 */
export const Palette = {
	BROWN: 'brown',
	GREEN: 'green',
	BLUE: 'blue',
	PURPLE: 'purple',
	PINK: 'pink',
	ORANGE: 'orange',
} as const;

/**
 * Validates a supported color palette.
 * @since 0.1.0 Initial implementation.
 */
export const PaletteSchema = z.enum( Palette );

/**
 * User-selected color palette.
 * @since 0.1.0 Initial implementation.
 */
export type Palette = z.infer<typeof PaletteSchema>;

/**
 * Pause presentation modes available during a protected-site wait.
 * @since 0.1.0 Initial implementation.
 */
export const PauseMode = {
	BREATHING: 'breathing',
	QUIET: 'quiet',
} as const;

/**
 * Validates a supported pause presentation mode.
 * @since 0.1.0 Initial implementation.
 */
export const PauseModeSchema = z.enum( PauseMode );

/**
 * User-selected pause presentation mode.
 * @since 0.1.0 Initial implementation.
 */
export type PauseMode = z.infer<typeof PauseModeSchema>;

/**
 * Current local preferences document version.
 * @since 0.1.0 Initial implementation.
 */
export const PreferencesDocumentVersion = 2;

/**
 * Validates the current local preferences document version.
 * @since 0.1.0 Initial implementation.
 */
const PreferencesDocumentVersionSchema = z.number().int().nonnegative().refine(
	( value ) => value === PreferencesDocumentVersion,
	{ message: 'Preferences document version is not supported.' },
);

/**
 * Validates all locally persisted user preferences.
 * @since 0.1.0 Initial implementation.
 */
export const PreferencesDocumentSchema = z.object( {
	schemaVersion: PreferencesDocumentVersionSchema,
	theme: ThemeModeSchema,
	palette: PaletteSchema,
	pauseMode: PauseModeSchema,
	reducedMotion: z.boolean(),
	language: LanguageSchema.nullable(),
} ).strict();

/**
 * Complete locally persisted user preferences.
 * @since 0.1.0 Initial implementation.
 */
export type PreferencesDocument = z.infer<typeof PreferencesDocumentSchema>;

/**
 * Safe preferences used before the user makes an explicit choice.
 * @since 0.1.0 Initial implementation.
 */
export const DefaultPreferencesDocument: Readonly<PreferencesDocument> = Object.freeze(
	PreferencesDocumentSchema.parse( {
		schemaVersion: PreferencesDocumentVersion,
		theme: ThemeMode.SYSTEM,
		palette: Palette.BROWN,
		pauseMode: PauseMode.BREATHING,
		reducedMotion: false,
		language: null,
	} ),
);
