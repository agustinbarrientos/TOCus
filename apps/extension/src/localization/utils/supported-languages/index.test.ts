import { describe, expect, it } from 'vitest';
import { Language } from '../../../domains/preferences/types';
import { SupportedLanguages } from './index';

describe( 'SupportedLanguages', () => {
	it( 'lists every approved language in stable preference order', () => {
		expect( SupportedLanguages ).toEqual( [
			Language.ENGLISH,
			Language.SPANISH_TU,
			Language.SPANISH_VOS,
			Language.PORTUGUESE_BRAZIL,
			Language.PORTUGUESE_PORTUGAL,
			Language.ITALIAN,
			Language.FRENCH,
			Language.GERMAN,
			Language.JAPANESE,
			Language.RUSSIAN,
		] );
	} );
} );
