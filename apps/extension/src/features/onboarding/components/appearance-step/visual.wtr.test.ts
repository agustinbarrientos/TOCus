import { assert, fixture, html } from '@open-wc/testing';
import { emulateMedia, setViewport } from '@web/test-runner-commands';
import { visualDiff } from '@web/test-runner-visual-regression';
import {
	Palette,
	ThemeMode,
	type Palette as PaletteValue,
	type ThemeMode as ThemeModeValue,
} from '../../../../domains/preferences/types';
import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import './index';
import { type ComponentOnboardingAppearanceStep } from './index';

/**
 * Renders a stable Appearance step for one approved theme and palette.
 * @param theme - Explicit light or dark appearance.
 * @param palette - Selected full-scene palette.
 * @param width - Explicit component width.
 * @return Connected and settled Appearance step.
 * @since 0.1.0 Initial implementation.
 */
async function renderAppearanceStep(
	theme: ThemeModeValue,
	palette: PaletteValue,
	width: string,
): Promise<ComponentOnboardingAppearanceStep> {
	const element = await fixture<ComponentOnboardingAppearanceStep>( html`
		<tocus-f-onboarding-appearance-step
			style=${ `width: ${ width };` }
			.copy=${ TestEnglishLocalizationBundle.onboarding.appearance }
			.theme=${ theme }
			.palette=${ palette }
		></tocus-f-onboarding-appearance-step>
	` );

	await new Promise<void>( ( resolve ) => {
		setTimeout( resolve, 0 );
	} );
	await element.updateComplete;

	return element;
}

/**
 * Configures deterministic browser media for one explicit appearance.
 * @param theme - Explicit light or dark appearance.
 * @param palette - Selected full-scene palette inherited by nested components.
 * @return Promise resolved after browser media emulation settles.
 * @since 0.1.0 Initial implementation.
 */
async function configureAppearance(
	theme: ThemeModeValue,
	palette: PaletteValue,
): Promise<void> {
	document.documentElement.setAttribute( 'data-tocus-theme', theme );
	document.documentElement.setAttribute( 'data-tocus-palette', palette );
	await emulateMedia( {
		colorScheme: theme === ThemeMode.DARK ? 'dark' : 'light',
		forcedColors: 'none',
		reducedMotion: 'reduce',
	} );
}

describe( 'tocus-f-onboarding-appearance-step visual', () => {
	before( async () => {
		const loadedFonts = await document.fonts.load( '600 2rem "Fredoka Variable"', 'Appearance' );

		assert.isAbove( loadedFonts.length, 0 );
	} );

	afterEach( async () => {
		document.documentElement.removeAttribute( 'data-tocus-theme' );
		document.documentElement.removeAttribute( 'data-tocus-palette' );
		await emulateMedia( {
			colorScheme: 'light',
			forcedColors: 'none',
			reducedMotion: 'no-preference',
		} );
	} );

	it( 'matches the light brown appearance choices', async () => {
		await setViewport( { height: 1_100, width: 1_280 } );
		await configureAppearance( ThemeMode.LIGHT, Palette.BROWN );
		const element = await renderAppearanceStep(
			ThemeMode.LIGHT,
			Palette.BROWN,
			'58rem',
		);

		await visualDiff( element, 'onboarding-appearance-step-brown-light' );
	} );

	it( 'matches the narrow dark purple appearance choices', async () => {
		await setViewport( { height: 1_500, width: 420 } );
		await configureAppearance( ThemeMode.DARK, Palette.PURPLE );
		const element = await renderAppearanceStep(
			ThemeMode.DARK,
			Palette.PURPLE,
			'100%',
		);

		await visualDiff( element, 'onboarding-appearance-step-purple-dark-narrow' );
	} );
} );
