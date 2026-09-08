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
	eyebrow: string;
	intro: string;
	description: string;
	sourceLink: string;
	privacy: string;
	howTitle: string;
	chooseTitle: string;
	chooseDescription: string;
	chooseLabel: string;
	visitLabel: string;
	pauseLabel: string;
	continueLabel: string;
	browseLabel: string;
	visitTitle: string;
	visitDescription: string;
	pauseTitle: string;
	pauseDescription: string;
	continueTitle: string;
	continueDescription: string;
	browseTitle: string;
	browseDescription: string;
	settingsTitle: string;
	timingTitle: string;
	timingDescription: string;
	timingPause: string;
	timingBrowse: string;
	exampleTiming: string;
	scheduleTitle: string;
	scheduleDescription: string;
	appearanceTitle: string;
	appearanceDescription: string;
	statisticsTitle: string;
	statisticsDescription: string;
	exampleData: string;
	mediaTitle: string;
	mediaDescription: string;
	sitesTitle: string;
	sitesDescription: string;
	privacyTitle: string;
	privacyAccounts: string;
	privacyTracking: string;
	privacyCalls: string;
	privacyLocal: string;
	openSourceTitle: string;
	openSourceDescription: string;
	authorLink: string;
	previewCaption: string;
	previewPhase: string;
	getExtension: string;
	howLink: string;
	alsoAvailable: string;
	comingSoon: string;
	downloadTitle: string;
	downloadDescription: string;
	downloadFor: string;
	readPrivacy: string;
	freeLabel: string;
	mascotAlt: string;
	demoLabel: string;
	demoSiteSelected: string;
	demoTimeLeft: string;
	privacyLink: string;
	supportLink: string;
	madeBy: string;
	creatorStory: string;
	privacyShort: string;
	sourceShort: string;
	skipLink: string;
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
