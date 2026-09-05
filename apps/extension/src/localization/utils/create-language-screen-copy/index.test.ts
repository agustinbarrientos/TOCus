import { describe, expect, it } from 'vitest';
import { Language } from '../../../domains/preferences/types';
import { createTestI18n } from '../../__fixtures__';
import { createLanguageScreenCopy } from './index';

describe( 'createLanguageScreenCopy', () => {
	it( 'creates language settings copy and its dynamic description', () => {
		const copy = createLanguageScreenCopy( createTestI18n() );

		expect( copy.title ).toBe( 'Language' );
		expect( copy.formatBrowserLanguageDescription( 'English' ) ).toBe( 'Your browser currently selects English.' );
	} );

	it( 'creates every language option label through the localized copy contract', () => {
		const copy = createLanguageScreenCopy( createTestI18n() );

		expect( copy.languageLabels ).toEqual( {
			[ Language.ENGLISH ]: 'English',
			[ Language.SPANISH_TU ]: 'Espa\u00f1ol (t\u00fa)',
			[ Language.SPANISH_VOS ]: 'Espa\u00f1ol (vos)',
			[ Language.PORTUGUESE_BRAZIL ]: 'Portugu\u00eas (Brasil)',
			[ Language.PORTUGUESE_PORTUGAL ]: 'Portugu\u00eas (Portugal)',
			[ Language.ITALIAN ]: 'Italiano',
			[ Language.FRENCH ]: 'Fran\u00e7ais',
			[ Language.GERMAN ]: 'Deutsch',
			[ Language.JAPANESE ]: '\u65e5\u672c\u8a9e',
			[ Language.RUSSIAN ]: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439',
		} );
	} );
} );
