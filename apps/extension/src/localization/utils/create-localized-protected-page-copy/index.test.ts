import { describe, expect, it } from 'vitest';
import { Language } from '../../../domains/preferences/types';
import { createLocalizedProtectedPageCopy } from './index';

describe( 'createLocalizedProtectedPageCopy', () => {
	it( 'creates protected-page copy synchronously from only its local catalog slices', () => {
		const copy = createLocalizedProtectedPageCopy( Language.JAPANESE );

		expect( copy.languageTag ).toBe( 'ja' );
		expect( copy.interruption.takeAMoment ).toBe( '\u5c11\u3057\u7acb\u3061\u6b62\u307e\u308b' );
		expect( copy.protectedPageLayer.dialogLabel ).toBe( '\u0054\u004f\u0043\u0075\u0073 \u306e\u4e00\u6642\u505c\u6b62' );
		expect( copy.wellbeing.neutral ).toBe( '\u3053\u308c\u306f\u3042\u306a\u305f\u306e\u305f\u3081\u3060\u3051\u306e\u6642\u9593\u3067\u3059\u3002' );
	} );
} );
