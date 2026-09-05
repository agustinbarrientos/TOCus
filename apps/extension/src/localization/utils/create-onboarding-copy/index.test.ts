import { describe, expect, it } from 'vitest';
import { createTestI18n } from '../../__fixtures__';
import { createOnboardingCopy } from './index';

describe( 'createOnboardingCopy', () => {
	it( 'creates onboarding shell copy and its three step slices', () => {
		const copy = createOnboardingCopy( createTestI18n() );

		expect( 'welcomeLabel' in copy ).toBe( false );
		expect( 'nonClinicalNote' in copy ).toBe( false );
		expect( copy.privacyTitle ).toBe( '100% private' );
		expect( copy.privacyDescription ).toBe( 'TOCus works offline. Your data stays on this device and is never sent to servers.' );
		expect( copy.completionTitle ).toBe( "You're all set" );
		expect( copy.completionDescription ).toBe(
			'TOCus is ready. You can close this tab or continue in Settings.',
		);
		expect( copy.openSettingsLabel ).toBe( 'Open Settings' );
		expect( copy.formatStepProgress( 2, 3, 'Appearance' ) ).toBe( 'Step 2 of 3: Appearance' );
		expect( copy.language.title ).toBe( 'Choose your language' );
		expect( copy.appearance.title ).toBe( 'Make TOCus yours' );
		expect( copy.stepNames.sites ).toBe( 'Websites' );
		expect( copy.sites.title ).toBe( 'Choose websites' );
	} );
} );
