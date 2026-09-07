import { WebsiteLanguage } from './types';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { CatalogType } from '@lingui/cli/api';
import { formatter } from '@lingui/format-po';
import { describe, expect, it } from 'vitest';
import {
	WebsiteLanguages,
	getWebsiteLocalization,
	getWebsiteLocalizations,
} from './index';

/**
 * Canonical Lingui locale filenames used by the website.
 * @since 0.1.0 Initial implementation.
 */
const WebsiteCatalogLocales = Object.freeze( [
	'en',
	'es',
	'es-AR',
	'pt-BR',
	'pt-PT',
	'it',
	'fr',
	'de',
	'ja',
	'ru',
] );

/**
 * Product-story fields consumed directly by the website experience.
 * @since 0.1.0 Initial implementation.
 */
const WebsiteProductStoryFields = Object.freeze( [
	'getExtension',
	'howLink',
	'alsoAvailable',
	'chooseLabel',
	'visitLabel',
	'pauseLabel',
	'continueLabel',
	'browseLabel',
	'visitTitle',
	'visitDescription',
	'browseTitle',
	'browseDescription',
	'timingPause',
	'timingBrowse',
	'exampleTiming',
	'comingSoon',
	'downloadTitle',
	'downloadDescription',
	'downloadFor',
	'freeLabel',
	'mascotAlt',
	'demoLabel',
	'demoSiteSelected',
	'statisticsTitle',
	'statisticsDescription',
	'exampleData',
	'mediaTitle',
	'mediaDescription',
	'sitesTitle',
	'sitesDescription',
	'demoTimeLeft',
	'privacyLink',
	'supportLink',
	'madeBy',
	'creatorStory',
	'privacyShort',
	'privacyAccounts',
	'privacyTracking',
	'privacyCalls',
	'privacyLocal',
	'readPrivacy',
	'sourceShort',
] as const );

/**
 * PO formatter used to inspect translator-authored source files.
 * @since 0.1.0 Initial implementation.
 */
const poFormatter = formatter( {
	foldLength: 0,
	lineNumbers: false,
} );

/**
 * Parses one website PO catalog from its canonical app-root location.
 * @param locale - Lingui locale filename to parse.
 * @return Parsed translator catalog.
 * @since 0.1.0 Initial implementation.
 */
async function readWebsiteCatalog( locale: string ): Promise<CatalogType> {
	const filename = fileURLToPath( new URL( `../../locales/${ locale }.po`, import.meta.url ) );

	return poFormatter.parse( readFileSync( filename, 'utf8' ), {
		filename,
		locale,
		sourceLocale: 'en',
	} );
}

describe( 'website localization', () => {
	it( 'provides one complete catalog for every approved website language', () => {
		const localizations = getWebsiteLocalizations();

		expect( localizations.map( ( localization ) => localization.language ) ).toEqual( [
			WebsiteLanguage.ENGLISH,
			WebsiteLanguage.SPANISH_TU,
			WebsiteLanguage.SPANISH_VOS,
			WebsiteLanguage.PORTUGUESE_BRAZIL,
			WebsiteLanguage.PORTUGUESE_PORTUGAL,
			WebsiteLanguage.ITALIAN,
			WebsiteLanguage.FRENCH,
			WebsiteLanguage.GERMAN,
			WebsiteLanguage.JAPANESE,
			WebsiteLanguage.RUSSIAN,
		] );
		expect( localizations ).toHaveLength( WebsiteLanguages.length );
	} );

	it( 'maps regional variants to distinct static routes and language tags', () => {
		expect( getWebsiteLocalization( WebsiteLanguage.SPANISH_TU ) ).toMatchObject( {
			languageTag: 'es',
			path: '/es/',
		} );
		expect( getWebsiteLocalization( WebsiteLanguage.SPANISH_VOS ) ).toMatchObject( {
			languageTag: 'es-AR',
			path: '/es-ar/',
		} );
		expect( getWebsiteLocalization( WebsiteLanguage.PORTUGUESE_BRAZIL ) ).toMatchObject( {
			languageTag: 'pt-BR',
			path: '/pt-br/',
		} );
		expect( getWebsiteLocalization( WebsiteLanguage.PORTUGUESE_PORTUGAL ) ).toMatchObject( {
			languageTag: 'pt-PT',
			path: '/pt-pt/',
		} );
	} );

	it( 'returns translated metadata and visible copy from the selected catalog', () => {
		const french = getWebsiteLocalization( WebsiteLanguage.FRENCH );

		expect( french.catalog.metadata.description ).toBe(
			'TOCus est une extension de navigateur open source.',
		);
		expect( french.catalog.sourceLink ).toBe( 'Explorer le code source sur GitHub' );
		expect( french.catalog.languageMenuLabel ).toBe( 'Langue du site' );
	} );

	it( 'provides every language-navigation autonym through localized website copy', () => {
		const english = getWebsiteLocalization( WebsiteLanguage.ENGLISH );

		expect( english.catalog.languageLabels ).toEqual( {
			'en': 'English',
			'es-tu': 'Espa\u00f1ol (t\u00fa)',
			'es-vos': 'Espa\u00f1ol (vos)',
			'pt-BR': 'Portugu\u00eas (Brasil)',
			'pt-PT': 'Portugu\u00eas (Portugal)',
			'it': 'Italiano',
			'fr': 'Fran\u00e7ais',
			'de': 'Deutsch',
			'ja': '\u65e5\u672c\u8a9e',
			'ru': '\u0420\u0443\u0441\u0441\u043a\u0438\u0439',
		} );
	} );

	it( 'provides localized product-story actions and status copy for every website language', () => {
		const english = getWebsiteLocalization( WebsiteLanguage.ENGLISH );

		for ( const localization of getWebsiteLocalizations() ) {
			for ( const field of WebsiteProductStoryFields ) {
				const value = localization.catalog[ field ];

				expect( value, `${ localization.language }:${ field }` ).toEqual( expect.any( String ) );
				expect( value.trim(), `${ localization.language }:${ field }` ).not.toBe( '' );
			}

			if ( localization.language !== WebsiteLanguage.ENGLISH ) {
				expect( localization.catalog.visitDescription ).not.toBe( english.catalog.visitDescription );
			}
		}

		expect( getWebsiteLocalization( WebsiteLanguage.SPANISH_TU ).catalog.chooseTitle ).not.toBe(
			getWebsiteLocalization( WebsiteLanguage.SPANISH_VOS ).catalog.chooseTitle,
		);
		expect( getWebsiteLocalization( WebsiteLanguage.PORTUGUESE_BRAZIL ).catalog.chooseTitle ).not.toBe(
			getWebsiteLocalization( WebsiteLanguage.PORTUGUESE_PORTUGAL ).catalog.chooseTitle,
		);
	} );

	it( 'keeps concise claims aligned with local product behavior', () => {
		const { catalog } = getWebsiteLocalization( WebsiteLanguage.ENGLISH );

		expect( catalog.intro.length ).toBeLessThanOrEqual( 32 );
		expect( catalog.description.length ).toBeLessThanOrEqual( 64 );
		expect( catalog.pauseDescription ).toMatch( /\bnot started\b/iu );
		expect( catalog.continueDescription ).toMatch( /\bContinue\b/u );
		expect( catalog.browseDescription ).toMatch( /\bContinue\b/u );
		expect( catalog.statisticsDescription ).not.toMatch( /\b(?:actual|estimated|reclaimed|saved)\b/iu );
		expect( catalog.privacy ).toMatch( /\bwithout an internet connection\b/iu );
		expect( [
			catalog.privacyAccounts,
			catalog.privacyTracking,
			catalog.privacyCalls,
			catalog.privacyLocal,
		] ).toHaveLength( 4 );
		for ( const value of Object.values( catalog ) ) {
			if ( typeof value === 'string' ) {
				expect( value ).not.toMatch( /\bprotect(?:ed|ion)?\b/iu );
			}
		}
	} );

	it( 'explains each step from choosing a website to starting the browsing interval', () => {
		const { catalog } = getWebsiteLocalization( WebsiteLanguage.ENGLISH );
		const chapterLabels = [
			catalog.chooseLabel,
			catalog.visitLabel,
			catalog.pauseLabel,
			catalog.continueLabel,
			catalog.browseLabel,
		];

		expect( chapterLabels ).toHaveLength( 5 );
		expect( new Set( chapterLabels ).size ).toBe( chapterLabels.length );
		expect( catalog.pauseDescription ).toMatch( /\bnot started\b/iu );
		expect( catalog.continueDescription ).toMatch( /\bContinue\b/u );
		expect( catalog.browseDescription ).toMatch( /\bContinue\b/u );
		for ( const field of [ 'seeItInAction', 'demoAppearance', 'demoTiming', 'demoEntered', 'demoReplay', 'demoStart', 'demoSiteTitle', 'demoNextPause' ] ) {
			expect( catalog ).not.toHaveProperty( field );
		}
	} );

	it( 'translates every new feature and demo label without English fallbacks', () => {
		const english = getWebsiteLocalization( WebsiteLanguage.ENGLISH ).catalog;
		const fields = [
			'statisticsTitle', 'statisticsDescription', 'exampleData', 'mediaTitle',
			'mediaDescription', 'sitesTitle', 'sitesDescription', 'demoSiteSelected',
			'demoTimeLeft', 'getExtension', 'howLink', 'alsoAvailable', 'visitTitle',
			'visitDescription', 'pauseDescription', 'continueTitle', 'continueDescription',
			'browseTitle', 'browseDescription', 'chooseLabel', 'visitLabel', 'pauseLabel',
			'continueLabel', 'browseLabel', 'timingPause', 'timingBrowse', 'exampleTiming',
			'privacyAccounts', 'privacyTracking', 'privacyCalls', 'privacyLocal', 'downloadFor',
			'readPrivacy',
		] as const;

		for ( const { language, catalog } of getWebsiteLocalizations() ) {
			for ( const field of fields ) {
				expect( catalog[ field ], `${ language }:${ field }` ).toEqual( expect.any( String ) );
				if ( language !== WebsiteLanguage.ENGLISH ) {
					expect( catalog[ field ], `${ language }:${ field }` ).not.toBe( english[ field ] );
				}
			}
		}
	} );

	it( 'keeps every translated website catalog structurally complete and nonempty', () => {
		const englishKeys = Object.keys( getWebsiteLocalization( WebsiteLanguage.ENGLISH ).catalog ).sort();

		for ( const localization of getWebsiteLocalizations() ) {
			expect( Object.keys( localization.catalog ).sort() ).toEqual( englishKeys );
			for ( const value of Object.values( localization.catalog ) ) {
				if ( typeof value === 'string' ) {
					expect( value.trim() ).not.toBe( '' );
				} else if ( 'description' in value ) {
					expect( value.description.trim() ).not.toBe( '' );
				} else {
					for ( const language of WebsiteLanguages ) {
						expect( value[ language ].trim() ).not.toBe( '' );
					}
				}
			}
		}
	} );

	it( 'keeps every translator-authored PO catalog complete', async () => {
		const englishMessageIds = Object.keys( await readWebsiteCatalog( 'en' ) ).sort();

		for ( const locale of WebsiteCatalogLocales ) {
			const catalog = await readWebsiteCatalog( locale );

			expect( Object.keys( catalog ).sort(), locale ).toEqual( englishMessageIds );
			for ( const [ messageId, entry ] of Object.entries( catalog ) ) {
				expect( entry.translation?.trim(), `${ locale }:${ messageId }` ).not.toBe( '' );
			}
		}
	} );
} );
