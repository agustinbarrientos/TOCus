import type { LocalizedHomePageProperties, WebsiteLanguage } from '../../localization';
import type { PrivacyCatalog } from '../../localization/privacy/types';

/**
 * Contact and external destinations used by the canonical publication documents.
 * @since 1.0.0 Initial implementation.
 */
export const InformationExternalUrl = {
	CHROME_LIMITED_USE: 'https://developer.chrome.com/docs/webstore/program-policies/user-data-faq',
	GOOGLE_DATA_USE: 'https://policies.google.com/technologies/partner-sites',
} as const;

/**
 * Language supplied by each static privacy route.
 * @since 1.0.0 Initial implementation.
 */
export interface InformationPageProperties {
	/** Selected language, defaulting to the English canonical route. */
	language?: WebsiteLanguage;
}

/**
 * Fully localized privacy document and its shared website navigation.
 * @since 1.0.0
 */
export interface LocalizedInformationPageProperties extends LocalizedHomePageProperties {
	privacyCatalog: Readonly<PrivacyCatalog>;
}

/**
 * Complete translated prose rendered by the Privacy Policy.
 * @since 1.0.0
 */
export interface PrivacyContentProperties {
	catalog: Readonly<PrivacyCatalog>;
}
