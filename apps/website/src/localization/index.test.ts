import { describe, expect, it } from 'vitest';
import {
	WebsiteLanguages,
	getWebsiteLocalization,
	getWebsiteLocalizations,
} from './index';

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

	it( 'keeps every translated website catalog structurally complete and nonempty', () => {
		const englishKeys = Object.keys( getWebsiteLocalization( 'en' ).catalog ).sort();

		for ( const localization of getWebsiteLocalizations() ) {
			expect( Object.keys( localization.catalog ).sort() ).toEqual( englishKeys );
			for ( const value of Object.values( localization.catalog ) ) {
				if ( typeof value === 'string' ) {
					expect( value.trim() ).not.toBe( '' );
				} else {
					expect( value.description.trim() ).not.toBe( '' );
				}
			}
		}
	} );
} );
