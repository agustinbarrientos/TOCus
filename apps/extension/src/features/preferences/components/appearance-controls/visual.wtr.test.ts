import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import { assert, fixture, html } from '@open-wc/testing';
import { emulateMedia, setViewport } from '@web/test-runner-commands';
import { visualDiff } from '@web/test-runner-visual-regression';
import {
	Palette,
	ThemeMode,
	type Palette as PaletteValue,
	type ThemeMode as ThemeModeValue,
} from '../../../../domains/preferences/types';
import './index';
import { type ComponentAppearanceControls } from './index';

/**
 * Renders deterministic shared appearance controls.
 * @param theme - Selected appearance mode.
 * @param palette - Selected full-scene palette.
 * @param width - Explicit component width.
 * @return Connected shared appearance controls.
 * @since 0.1.0 Initial implementation.
 */
async function renderControls(
	theme: ThemeModeValue,
	palette: PaletteValue,
	width: string,
): Promise<ComponentAppearanceControls> {
	const element = await fixture<ComponentAppearanceControls>( html`
		<tocus-f-appearance-controls
			style=${ `width: ${ width };` }
			.copy=${ TestEnglishLocalizationBundle.appearance }
			.theme=${ theme }
			.palette=${ palette }
		></tocus-f-appearance-controls>
	` );

	await element.updateComplete;

	return element;
}

/**
 * Configures deterministic theme attributes and browser media.
 * @param theme - Explicit light or dark theme.
 * @param palette - Selected full-scene palette.
 * @return Promise resolved after media emulation settles.
 * @since 0.1.0 Initial implementation.
 */
async function configureAppearance(
	theme: typeof ThemeMode.LIGHT | typeof ThemeMode.DARK,
	palette: PaletteValue,
): Promise<void> {
	document.documentElement.setAttribute( 'data-tocus-theme', theme );
	document.documentElement.setAttribute( 'data-tocus-palette', palette );
	await emulateMedia( {
		colorScheme: theme,
		forcedColors: 'none',
		reducedMotion: 'reduce',
	} );
}

describe( 'tocus-f-appearance-controls visual', () => {
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

	it( 'matches the light brown appearance controls', async () => {
		await setViewport( { height: 900, width: 1_280 } );
		await configureAppearance( ThemeMode.LIGHT, Palette.BROWN );
		const element = await renderControls( ThemeMode.LIGHT, Palette.BROWN, '46rem' );

		await visualDiff( element, 'appearance-controls-brown-light' );
	} );

	it( 'matches the narrow dark purple appearance controls', async () => {
		await setViewport( { height: 900, width: 420 } );
		await configureAppearance( ThemeMode.DARK, Palette.PURPLE );
		const element = await renderControls( ThemeMode.SYSTEM, Palette.PURPLE, '100%' );

		await visualDiff( element, 'appearance-controls-purple-dark-narrow' );
	} );
} );
