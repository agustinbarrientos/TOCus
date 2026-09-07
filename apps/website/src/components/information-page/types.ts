/**
 * Canonical publication documents rendered outside the translated product routes.
 * @since 0.1.0 Initial implementation.
 */
export const InformationDocument = {
	PRIVACY: 'privacy',
	SUPPORT: 'support',
} as const;

/**
 * Publication document derived from the runtime catalog.
 * @since 0.1.0 Initial implementation.
 */
export type InformationDocument = typeof InformationDocument[keyof typeof InformationDocument];

/**
 * Stable local routes shared by the information-page navigation.
 * @since 0.1.0 Initial implementation.
 */
export const InformationRoute = {
	HOME: '/',
	PRIVACY: '/privacy/',
	SUPPORT: '/support/',
} as const;

/**
 * External destinations used by the canonical publication documents.
 * @since 0.1.0 Initial implementation.
 */
export const InformationExternalUrl = {
	CHROME_LIMITED_USE: 'https://developer.chrome.com/docs/webstore/program-policies/user-data-faq',
	ISSUES: 'https://github.com/agustinbarrientos/TOCus/issues/new/choose',
} as const;

/**
 * Public title and description used in generated document metadata.
 * @since 0.1.0 Initial implementation.
 */
export interface InformationPageMetadata {
	/** Browser-tab title. */
	title: string;
	/** Search and link-preview summary. */
	description: string;
}

/**
 * Metadata indexed by its canonical information document.
 * @since 0.1.0 Initial implementation.
 */
export const InformationPageMetadata = {
	[ InformationDocument.PRIVACY ]: {
		title: 'TOCus privacy',
		description: 'How TOCus handles extension-local data, permissions, deletion, and ordinary website requests.',
	},
	[ InformationDocument.SUPPORT ]: {
		title: 'TOCus support',
		description: 'Setup and troubleshooting guidance, public issue reporting, and current security-reporting status.',
	},
} as const satisfies Record<InformationDocument, InformationPageMetadata>;

/**
 * Information-page selection supplied by its canonical Astro route.
 * @since 0.1.0 Initial implementation.
 */
export interface InformationPageProperties {
	/** Canonical document to render. */
	document: InformationDocument;
}
