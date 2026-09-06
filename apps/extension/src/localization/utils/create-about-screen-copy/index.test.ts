import { setupI18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { describe, expect, it } from 'vitest';
import { createTestI18n } from '../../__fixtures__';
import { createAboutScreenCopy } from './index';

describe( 'createAboutScreenCopy', () => {
	it( 'provides English source copy and formats the supplied version', () => {
		const copy = createAboutScreenCopy( createTestI18n() );

		expect( copy.eyebrow ).toBe( 'About' );
		expect( copy.formatVersion( '2.3.4' ) ).toBe( 'Version 2.3.4' );
		expect( Object.isFrozen( copy ) ).toBe( true );
	} );

	it( 'uses the supplied Lingui instance for translated labels', () => {
		const sourceCode = msg`Source code`;
		const creator = msg`Developed by ${ { name: 'Agustin Barrientos' } }`;
		const i18n = setupI18n( { locale: 'de', messages: { de: {
			[ sourceCode.id ]: 'Quellcode',
			[ creator.id ]: 'Von {name} entwickelt',
		} } } );

		expect( createAboutScreenCopy( i18n ).sourceCode ).toBe( 'Quellcode' );
		expect( createAboutScreenCopy( i18n ).creator ).toBe( 'Von Agustin Barrientos entwickelt' );
	} );
} );
