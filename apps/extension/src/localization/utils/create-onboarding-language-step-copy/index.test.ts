import { describe, expect, it } from 'vitest';
import { createTestI18n } from '../../__fixtures__';
import { createOnboardingLanguageStepCopy } from './index';

describe( 'createOnboardingLanguageStepCopy', () => {
	it( 'creates onboarding language copy and regional choices', () => {
		const copy = createOnboardingLanguageStepCopy( createTestI18n() );

		expect( copy.title ).toBe( 'Choose your language' );
		expect( copy.spanishTuLabel ).toBeTruthy();
		expect( copy.portugueseBrazilLabel ).toBe( 'Brasil' );
	} );
} );
