import type { LocalizedHomePageProperties, WebsiteLanguage } from '../../localization';
import type { PrivacyCatalog } from '../../localization/privacy/types';
import type { SupportCatalog } from '../../localization/support/types';

/**
 * Public documents that share the website's navigation and reading layout.
 * @since 1.0.0
 */
export const InformationDocument = {
	PRIVACY: 'privacy',
	SUPPORT: 'support',
} as const;

/**
 * Contact and external destinations used by the canonical publication documents.
 * @since 1.0.0 Initial implementation.
 */
export const InformationExternalUrl = {
	CHROME_LIMITED_USE: 'https://developer.chrome.com/docs/webstore/program-policies/user-data-faq',
	GOOGLE_DATA_USE: 'https://policies.google.com/technologies/partner-sites',
	SUPPORT_EMAIL: 'mailto:hi@agustinbarrientos.com',
} as const;

/**
 * Document and language supplied by each static information route.
 * @since 1.0.0 Initial implementation.
 */
export interface InformationPageProperties {
	/** Selected language, defaulting to the English canonical route. */
	language?: WebsiteLanguage;
	/** Public document, defaulting to the Privacy Policy. */
	document?: typeof InformationDocument[keyof typeof InformationDocument];
}

/**
 * Privacy document and its translated prose.
 * @since 1.0.0
 */
export interface PrivacyDocumentProperties {
	document: typeof InformationDocument.PRIVACY;
	privacyCatalog: Readonly<PrivacyCatalog>;
}

/**
 * Support document and its translated contact introduction.
 * @since 1.0.0
 */
export interface SupportDocumentProperties {
	document: typeof InformationDocument.SUPPORT;
	supportCatalog: Readonly<SupportCatalog>;
}

/**
 * Fully localized public document and its shared website navigation.
 * @since 1.0.0
 */
export type LocalizedInformationPageProperties = LocalizedHomePageProperties & (
	PrivacyDocumentProperties | SupportDocumentProperties
);

/**
 * Complete translated prose rendered by the Privacy Policy.
 * @since 1.0.0
 */
export interface PrivacyContentProperties {
	catalog: Readonly<PrivacyCatalog>;
}
