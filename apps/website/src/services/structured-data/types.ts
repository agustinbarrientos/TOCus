/**
 * The website's WebSite node, which tells search engines which name to show for it.
 */
export interface WebSiteNode {
	'@type': 'WebSite';
	'@id': string;
	name: string;
	url: string;
}

/**
 * The author, with the same details as the Person node on the author's own website.
 */
export interface PersonNode {
	'@type': 'Person';
	'@id': string;
	name: string;
	url: string;
	image: string;
	sameAs: string[];
}

/**
 * A free offer; Google needs the price to show an app in search results.
 */
export interface OfferNode {
	'@type': 'Offer';
	price: 0;
}

/**
 * The schema.org entry for the extension, with the same `@id` on every page and website that describes it.
 */
export interface SoftwareApplicationNode {
	'@type': 'SoftwareApplication';
	'@id': string;
	name: string;
	description: string;
	url: string;
	applicationCategory: 'BrowserApplication';
	image: string[];
	author: PersonNode;
	sameAs: string[];
	releaseNotes: string;
	featureList: string[];
	offers: OfferNode;
	isAccessibleForFree: true;
	datePublished: string;
	license: string;
	inLanguage: string[];
	installUrl: string[];
}

/**
 * JSON-LD for one localized home page.
 */
export interface StructuredData {
	'@context': 'https://schema.org';
	'@graph': [ WebSiteNode, SoftwareApplicationNode ];
}
