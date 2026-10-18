import { setupI18n } from '@lingui/core';
import { describe, expect, it } from 'vitest';
import { Language } from '../../../domains/preferences/types';
import { getLanguageTag } from '../../../domains/preferences/utils/resolve-language';
import { createTestI18n } from '../../__fixtures__';
import { loadLocalizationMessages } from '../../services/load-localization-messages';
import { createFocusLinksScreenCopy } from './index';


describe( 'createFocusLinksScreenCopy', () => {
	it( 'keeps optional shortcuts concise and reuses website controls', () => {
		const copy = createFocusLinksScreenCopy( createTestI18n() );
		expect( copy.title ).toBe( 'Focus links' );
		expect( copy.description ).toBe( 'Optionally, add up to three website shortcuts to your breathing screen.' );
		expect( copy.descriptionDetail ).toBe( 'Use them to quickly visit sites you\'d rather spend time on.' );
		expect( copy ).not.toHaveProperty( 'privacyDescription' );
		expect( copy.emptyMessage ).toBe( 'No websites yet' );
		expect( copy.addLink ).toBe( 'Add site' );
		expect( copy.cancel ).toBe( 'Cancel' );
		expect( copy.done ).toBe( 'Done' );
		expect( copy.invalidLabel ).toContain( '1 to 64 characters' );
		expect( copy.invalidUrl ).toContain( 'http://' );
		expect( copy.malformedDataDescription ).toContain( 'focus links' );
		expect( Object.isFrozen( copy ) ).toBe( true );
	} );

	it.each( Object.values( Language ) )( 'localizes every link control and recovery message in %s', async ( language ) => {
		const messages = await loadLocalizationMessages( language );
		const tag = getLanguageTag( language );
		const copy = createFocusLinksScreenCopy( setupI18n( { locale: tag, messages: { [ tag ]: messages } } ) );
		const english = createFocusLinksScreenCopy( createTestI18n() );
		for ( const key of Object.keys( copy ) as ( keyof typeof copy )[] ) {
			expect( copy[ key ], `${ language }: ${ key }` ).toBeTruthy();
			if ( language !== Language.ENGLISH ) {
				expect( copy[ key ], `${ language }: ${ key }` ).not.toBe( english[ key ] );
			}
		}
	} );
} );
