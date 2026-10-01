import { WebsiteLink } from '../../components/site-links/types';
import { DownloadStores } from '../../config/downloads';
import { getWebsiteLocalizations } from '../../localization';
import type { WebsiteLocalization } from '../../localization/types';
import type { PersonNode, StructuredData } from './types';

/**
 * The author, matching the Person node on the author's own website.
 * Keep the photo and the profiles in sync with it.
 */
const Author: Readonly<PersonNode> = Object.freeze( {
	'@type': 'Person',
	'@id': 'https://agustinbarrientos.com/#person',
	name: 'Agustin Barrientos',
	url: 'https://agustinbarrientos.com/',
	image: 'https://agustinbarrientos.com/_astro/avatar.C8wEfXcb.webp',
	sameAs: [
		'https://www.linkedin.com/in/barrientosagustin',
		'https://www.youtube.com/@agustin.barrientos',
		'https://daily.dev/agustinbarrientos',
		'https://profiles.wordpress.org/arglab/',
		'https://github.com/agustinbarrientos',
	],
} );

/**
 * Describes the website and the extension for search engines, in the page's language.
 * @param localization - Current website language and copy.
 * @param site - Website origin.
 * @return JSON-LD for the home page head.
 */
export function createStructuredData( localization: Readonly<WebsiteLocalization>, site: URL ): StructuredData {
	const { catalog, language } = localization;
	const home = new URL( '/', site ).href;
	return {
		'@context': 'https://schema.org',
		'@graph': [
			{ '@type': 'WebSite', '@id': `${ home }#website`, name: 'TOCus', url: home },
			{
				'@type': 'SoftwareApplication',
				'@id': `${ home }#app`,
				name: 'TOCus',
				description: catalog.description,
				url: home,
				applicationCategory: 'BrowserApplication',
				image: [
					new URL( '/favicon.svg', site ).href,
					new URL( `/images/og/${ language.toLowerCase() }.png`, site ).href,
				],
				author: { ...Author, sameAs: [ ...Author.sameAs ] },
				sameAs: [ WebsiteLink.SOURCE ],
				releaseNotes: `${ WebsiteLink.SOURCE }/releases`,
				featureList: [
					catalog.scheduleDescription,
					catalog.sitesDescription,
					catalog.mediaDescription,
					catalog.statisticsDescription,
				],
				offers: { '@type': 'Offer', price: 0 },
				isAccessibleForFree: true,
				datePublished: '2026-09-29',
				license: `${ WebsiteLink.SOURCE }/blob/main/LICENSE`,
				inLanguage: getWebsiteLocalizations().map( ( { languageTag } ) => languageTag ),
				installUrl: Object.values( DownloadStores )
					.flatMap( ( { href } ) => ( href === null ? [] : [ href ] ) ),
			},
		],
	};
}
