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
	getPrivacyCatalog,
	getSupportCatalog,
} from './index';

/**
 * Canonical Lingui locale filenames used by the website.
 * @since 1.0.0 Initial implementation.
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
 * Homepage copy consumed by the static feature and download sections.
 * @since 1.0.0 Initial implementation.
 */
const WebsiteHomepageFields = Object.freeze( [
	'stepOpen', 'stepPause', 'stepContinue', 'stepBrowse',
	'featuresTitle', 'scheduleTitle', 'scheduleDescription',
	'sitesTitle', 'sitesDescription', 'mediaTitle', 'mediaDescription', 'mediaServices',
	'statisticsTitle', 'statisticsDescription',
	'privacyLocal', 'privacy', 'readPrivacy',
	'openSourceTitle', 'openSourceDescription', 'sourceShort',
	'alsoAvailable', 'comingSoon', 'downloadTitle', 'downloadFor',
	'privacyLink', 'madeBy', 'sourceLink',
] as const );

/**
 * PO formatter used to inspect translator-authored source files.
 * @since 1.0.0 Initial implementation.
 */
const poFormatter = formatter( {
	foldLength: 0,
	lineNumbers: false,
} );

/**
 * Parses one website PO catalog from its canonical app-root location.
 * @param locale - Lingui locale filename to parse.
 * @return Parsed translator catalog.
 * @since 1.0.0 Initial implementation.
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
	it( 'provides localized email support copy in every website language', () => {
		const english = getSupportCatalog( WebsiteLanguage.ENGLISH );
		for ( const language of WebsiteLanguages ) {
			const support = getSupportCatalog( language );
			expect( support.title.trim() ).not.toBe( '' );
			expect( support.description.trim() ).not.toBe( '' );
			if ( language !== WebsiteLanguage.ENGLISH ) {
				expect( support.description ).not.toBe( english.description );
			}
		}
	} );

	it( 'provides every public privacy paragraph without English fallbacks', () => {
		const english = getPrivacyCatalog( WebsiteLanguage.ENGLISH );
		for ( const language of WebsiteLanguages ) {
			const privacy = getPrivacyCatalog( language );
			for ( const [ field, value ] of Object.entries( privacy ) ) {
				expect( value.trim(), `${ language }:${ field }` ).not.toBe( '' );
				if ( language !== WebsiteLanguage.ENGLISH ) {
					expect( value, `${ language }:${ field }` ).not.toBe( english[ field as keyof typeof english ] );
				}
			}
		}
	} );

	it( 'keeps em dashes out of every localized website string', () => {
		for ( const localization of getWebsiteLocalizations() ) {
			expect( JSON.stringify( localization ) ).not.toContain( '\u2014' );
		}
	} );

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
		expect( french.catalog.sourceLink ).toBe( 'Code source' );
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

	it( 'provides localized homepage copy for every website language', () => {
		const english = getWebsiteLocalization( WebsiteLanguage.ENGLISH );

		for ( const localization of getWebsiteLocalizations() ) {
			for ( const field of WebsiteHomepageFields ) {
				const value = localization.catalog[ field ];

				expect( value, `${ localization.language }:${ field }` ).toEqual( expect.any( String ) );
				expect( value.trim(), `${ localization.language }:${ field }` ).not.toBe( '' );
			}

			if ( localization.language !== WebsiteLanguage.ENGLISH ) {
				expect( localization.catalog.scheduleDescription ).not.toBe( english.catalog.scheduleDescription );
			}
		}

		expect( getWebsiteLocalization( WebsiteLanguage.SPANISH_TU ).catalog.scheduleDescription ).not.toBe(
			getWebsiteLocalization( WebsiteLanguage.SPANISH_VOS ).catalog.scheduleDescription,
		);
		expect( getWebsiteLocalization( WebsiteLanguage.PORTUGUESE_BRAZIL ).catalog.scheduleDescription ).not.toBe(
			getWebsiteLocalization( WebsiteLanguage.PORTUGUESE_PORTUGAL ).catalog.scheduleDescription,
		);
	} );

	it( 'keeps concise claims aligned with local product behavior', () => {
		const { catalog } = getWebsiteLocalization( WebsiteLanguage.ENGLISH );

		expect( catalog.intro ).toBe( 'Pause before visiting addictive websites' );
		expect( catalog.description.length ).toBeLessThanOrEqual( 64 );
		expect( catalog.statisticsDescription ).not.toMatch( /\b(?:actual|estimated|reclaimed|saved)\b/iu );
		expect( catalog.privacy ).toMatch( /\boffline\b/iu );
		expect( catalog.privacy ).toContain( 'needs no account' );
		expect( catalog.openSourceDescription ).toContain( 'no advertising.' );
		for ( const value of Object.values( catalog ) ) {
			if ( typeof value === 'string' ) {
				expect( value ).not.toMatch( /\bprotect(?:ed|ion)?\b/iu );
			}
		}
	} );

	it( 'describes the four-step browsing flow and removes the retired walkthrough catalog', () => {
		const { catalog } = getWebsiteLocalization( WebsiteLanguage.ENGLISH );

		expect( [ catalog.stepOpen, catalog.stepPause, catalog.stepContinue, catalog.stepBrowse ] ).toEqual( [
			'Open a site', '10s pause', 'Continue', '5m browsing',
		] );
		for ( const field of Object.keys( catalog ) ) {
			expect( field ).not.toMatch( /^(?:demo|story|stats|timing|preview)/u );
		}
		for ( const field of [ 'chooseTitle', 'chooseLabel', 'visitTitle', 'visitLabel', 'browseDescription', 'appearanceDescription' ] ) {
			expect( catalog ).not.toHaveProperty( field );
		}
	} );

	it( 'translates the new feature descriptions without English fallbacks', () => {
		const english = getWebsiteLocalization( WebsiteLanguage.ENGLISH ).catalog;
		const fields = [
			'featuresTitle', 'mediaDescription', 'mediaServices',
			'statisticsDescription', 'privacy',
			'openSourceDescription', 'downloadTitle', 'readPrivacy', 'sourceLink',
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

	it( 'keeps feature headings concise', () => {
		for ( const { language, catalog } of getWebsiteLocalizations() ) {
			for ( const [ field, value ] of Object.entries( catalog ) ) {
				if ( ( field.endsWith( 'Title' ) && field !== 'downloadTitle' ) || field === 'intro' || field === 'privacyLocal' ) {
					expect( value, `${ language }:${ field }` ).not.toMatch( /[.\u3002\uff0e]$/u );
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
