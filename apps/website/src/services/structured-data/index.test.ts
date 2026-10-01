import { describe, expect, it } from 'vitest';
import { DownloadStores, WebsiteBrowser } from '../../config/downloads';
import { WebsiteLanguage, getWebsiteLocalization, getWebsiteLocalizations } from '../../localization';
import { createStructuredData } from '.';

const site = new URL( 'https://tocus.uo.ar' );

describe( 'createStructuredData', () => {
	it( 'names the website TOCus for search engines', () => {
		const [ website ] = createStructuredData( getWebsiteLocalization( WebsiteLanguage.ENGLISH ), site )[ '@graph' ];
		expect( website ).toEqual( {
			'@type': 'WebSite',
			'@id': 'https://tocus.uo.ar/#website',
			name: 'TOCus',
			url: 'https://tocus.uo.ar/',
		} );
	} );

	it( 'describes the same free browser extension on every language', () => {
		for ( const localization of getWebsiteLocalizations() ) {
			const [ , app ] = createStructuredData( localization, site )[ '@graph' ];
			expect( app ).toMatchObject( {
				'@type': 'SoftwareApplication',
				'@id': 'https://tocus.uo.ar/#app',
				name: 'TOCus',
				url: 'https://tocus.uo.ar/',
				applicationCategory: 'BrowserApplication',
				offers: { '@type': 'Offer', price: 0 },
				isAccessibleForFree: true,
			} );
		}
	} );

	it( 'uses the page language for the description, the features, and the preview image', () => {
		const localization = getWebsiteLocalization( WebsiteLanguage.SPANISH_VOS );
		const { catalog } = localization;
		const [ , app ] = createStructuredData( localization, site )[ '@graph' ];
		expect( app.description ).toBe( catalog.description );
		expect( app.featureList ).toEqual( [
			catalog.scheduleDescription,
			catalog.sitesDescription,
			catalog.mediaDescription,
			catalog.statisticsDescription,
		] );
		expect( app.image ).toEqual( [ 'https://tocus.uo.ar/favicon.svg', 'https://tocus.uo.ar/images/og/es-vos.png' ] );
	} );

	it( 'lists every website language, every store listing, and the author', () => {
		const [ , app ] = createStructuredData( getWebsiteLocalization( WebsiteLanguage.ENGLISH ), site )[ '@graph' ];
		expect( app.inLanguage ).toEqual( [ 'en', 'es', 'es-AR', 'pt-BR', 'pt-PT', 'it', 'fr', 'de', 'ja', 'ru' ] );
		expect( app.installUrl ).toEqual( [
			DownloadStores[ WebsiteBrowser.CHROME ].href,
			DownloadStores[ WebsiteBrowser.EDGE ].href,
			DownloadStores[ WebsiteBrowser.FIREFOX ].href,
		] );
		expect( app.author ).toEqual( {
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
		expect( app.sameAs ).toEqual( [ 'https://github.com/agustinbarrientos/TOCus' ] );
	} );
} );
