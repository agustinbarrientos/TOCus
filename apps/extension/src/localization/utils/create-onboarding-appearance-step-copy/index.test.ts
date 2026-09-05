import { describe, expect, it } from 'vitest';
import { createTestI18n } from '../../__fixtures__';
import { createOnboardingAppearanceStepCopy } from './index';

describe( 'createOnboardingAppearanceStepCopy', () => {
	it( 'creates onboarding theme, palette, and preview copy without pause settings', () => {
		const copy = createOnboardingAppearanceStepCopy( createTestI18n() );

		expect( copy.themeOptions.system.label ).toBe( 'System' );
		expect( copy.themeOptions.light.description ).toBe( 'Use a light appearance.' );
		expect( copy.themeOptions.dark.label ).toBe( 'Dark' );
		expect( copy.paletteLabels.brown ).toBe( 'Brown' );
		expect( copy.previewTitle ).toBe( 'This is what you\'ll see' );
		expect( copy ).not.toHaveProperty( 'pauseModeLegend' );
		expect( copy ).not.toHaveProperty( 'pauseModeOptions' );
	} );
} );
