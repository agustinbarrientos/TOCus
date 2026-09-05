/**
 * Languages supported by the public website.
 * @since 0.1.0 Initial implementation.
 */
export const WebsiteLanguage = {
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
 * Language supported by the public website.
 * @since 0.1.0 Initial implementation.
 */
export type WebsiteLanguage = typeof WebsiteLanguage[ keyof typeof WebsiteLanguage ];

/**
 * Localized metadata rendered by the website document.
 * @since 0.1.0 Initial implementation.
 */
export interface WebsiteMetadataCatalog {
	description: string;
}

/**
 * Complete translator-authored copy for the current website.
 * @since 0.1.0 Initial implementation.
 */
export interface WebsiteCatalog {
	metadata: WebsiteMetadataCatalog;
	status: string;
	eyebrow: string;
	intro: string;
	description: string;
	sourceLink: string;
	privacy: string;
	languageMenuLabel: string;
	languageLabels: Readonly<Record<WebsiteLanguage, string>>;
}

/**
 * Stable routing metadata for one website language.
 * @since 0.1.0 Initial implementation.
 */
export interface WebsiteLanguageMetadata {
	languageTag: string;
	path: string;
}

/**
 * Complete localized website projection used by static pages.
 * @since 0.1.0 Initial implementation.
 */
export interface WebsiteLocalization extends WebsiteLanguageMetadata {
	language: WebsiteLanguage;
	catalog: Readonly<WebsiteCatalog>;
}

/**
 * Properties consumed by one localized home page.
 * @since 0.1.0 Initial implementation.
 */
export interface LocalizedHomePageProperties {
	localization: Readonly<WebsiteLocalization>;
	localizations: ReadonlyArray<Readonly<WebsiteLocalization>>;
}

/**
 * Properties generated for one non-English static website route.
 * @since 0.1.0 Initial implementation.
 */
export interface LocalizedWebsitePageProperties {
	language: WebsiteLanguage;
}
