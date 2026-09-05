import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type CatalogType } from '@lingui/cli/api';
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
			'en',
			'es-tu',
			'es-vos',
			'pt-BR',
			'pt-PT',
			'it',
			'fr',
			'de',
			'ja',
			'ru',
		] );
		expect( localizations ).toHaveLength( WebsiteLanguages.length );
	} );

	it( 'maps regional variants to distinct static routes and language tags', () => {
		expect( getWebsiteLocalization( 'es-tu' ) ).toMatchObject( {
			languageTag: 'es',
			path: '/es/',
		} );
		expect( getWebsiteLocalization( 'es-vos' ) ).toMatchObject( {
			languageTag: 'es-AR',
			path: '/es-ar/',
		} );
		expect( getWebsiteLocalization( 'pt-BR' ) ).toMatchObject( {
			languageTag: 'pt-BR',
			path: '/pt-br/',
		} );
		expect( getWebsiteLocalization( 'pt-PT' ) ).toMatchObject( {
			languageTag: 'pt-PT',
			path: '/pt-pt/',
		} );
	} );

	it( 'returns translated metadata and visible copy from the selected catalog', () => {
		const french = getWebsiteLocalization( 'fr' );

		expect( french.catalog.metadata.description ).toBe(
			'TOCus est une extension de navigateur open source en cours de d\u00e9veloppement.',
		);
		expect( french.catalog.sourceLink ).toBe( 'Explorer le code source sur GitHub' );
		expect( french.catalog.languageMenuLabel ).toBe( 'Langue du site' );
	} );

	it( 'provides every language-navigation autonym through localized website copy', () => {
		const english = getWebsiteLocalization( 'en' );

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

	it( 'keeps every translated website catalog structurally complete and nonempty', () => {
		const englishKeys = Object.keys( getWebsiteLocalization( 'en' ).catalog ).sort();

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
