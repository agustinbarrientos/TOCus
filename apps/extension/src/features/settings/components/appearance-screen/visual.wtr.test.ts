import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import { assert, fixture, html } from '@open-wc/testing';
import { emulateMedia, setViewport } from '@web/test-runner-commands';
import { visualDiff } from '@web/test-runner-visual-regression';
import {
	DefaultPreferencesDocument,
	Palette,
	PauseMode,
	ThemeMode,
	type PreferencesDocument,
} from '../../../../domains/preferences/types';
import { type PreferencesEditor } from '../../../../domains/preferences/services/preferences-editor';
import './index';
import { type ComponentAppearanceScreen } from './index';

/**
 * In-memory preferences persistence used by deterministic Appearance screenshots.
 * @since 0.1.0 Initial implementation.
 */
class MemoryAppearanceVisualEditor implements PreferencesEditor {
	/**
	 * Creates storage with one complete preferences document.
	 * @param preferences - Preferences returned by local reads.
	 * @since 0.1.0 Initial implementation.
	 */
	constructor( private readonly preferences: PreferencesDocument ) {}

	/**
	 * Loads the configured preferences document.
	 * @return Complete visual-fixture preferences.
	 * @since 0.1.0 Initial implementation.
	 */
	load(): Promise<PreferencesDocument> {
		return Promise.resolve( this.preferences );
	}

	/**
	 * Returns the fixed visual preferences for an unused update.
	 * @return Complete visual-fixture preferences.
	 * @since 0.1.0 Initial implementation.
	 */
	update(): Promise<PreferencesDocument> {
		return Promise.resolve( this.preferences );
	}

	/**
	 * Returns default preferences for an unused recovery action.
	 * @return Complete default preferences.
	 * @since 0.1.0 Initial implementation.
	 */
	restoreDefaults(): Promise<PreferencesDocument> {
		return Promise.resolve( DefaultPreferencesDocument );
	}
}

/**
 * Renders a ready Appearance screen with deterministic local preferences.
 * @param preferences - Preferences shown by the screen.
 * @param width - Explicit component width.
 * @return Connected and ready Appearance screen.
 * @since 0.1.0 Initial implementation.
 */
async function renderAppearanceScreen(
	preferences: PreferencesDocument,
	width: string,
): Promise<ComponentAppearanceScreen> {
	const editor = new MemoryAppearanceVisualEditor( preferences );
	const element = await fixture<ComponentAppearanceScreen>( html`
		<tocus-f-appearance-screen
			.copy=${ TestEnglishLocalizationBundle.appearance }
			style=${ `width: ${ width };` }
			.editor=${ editor }
		></tocus-f-appearance-screen>
	` );

	await new Promise<void>( ( resolve ) => {
		setTimeout( resolve, 0 );
	} );
	await element.updateComplete;

	return element;
}

/**
 * Configures the root and browser media for one explicit visual appearance.
 * @param theme - Explicit light or dark theme.
 * @param palette - Selected full-scene palette.
 * @return Promise resolved after deterministic media emulation is applied.
 * @since 0.1.0 Initial implementation.
 */
async function configureAppearance( theme: ThemeMode, palette: Palette ): Promise<void> {
	document.documentElement.setAttribute( 'data-tocus-theme', theme );
	document.documentElement.setAttribute( 'data-tocus-palette', palette );
	await emulateMedia( {
		colorScheme: theme === ThemeMode.DARK ? 'dark' : 'light',
		forcedColors: 'none',
		reducedMotion: 'reduce',
	} );
}

describe( 'tocus-f-appearance-screen visual', () => {
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

	it( 'matches the default brown choices in the light appearance', async () => {
		await setViewport( { height: 1_200, width: 1_280 } );
		await configureAppearance( ThemeMode.LIGHT, Palette.BROWN );
		const element = await renderAppearanceScreen(
			{ ...DefaultPreferencesDocument },
			'52rem',
		);

		await visualDiff( element, 'appearance-screen-brown-light' );
	} );

	it( 'matches Quiet pause and reduced motion in the dark purple appearance', async () => {
		await setViewport( { height: 1_200, width: 1_280 } );
		await configureAppearance( ThemeMode.DARK, Palette.PURPLE );
		const element = await renderAppearanceScreen( {
			...DefaultPreferencesDocument,
			theme: ThemeMode.DARK,
			palette: Palette.PURPLE,
			pauseMode: PauseMode.QUIET,
			reducedMotion: true,
		}, '52rem' );

		await visualDiff( element, 'appearance-screen-purple-dark' );
	} );

	it( 'matches the narrow green appearance without clipping choices', async () => {
		await setViewport( { height: 1_400, width: 420 } );
		await configureAppearance( ThemeMode.LIGHT, Palette.GREEN );
		const element = await renderAppearanceScreen( {
			...DefaultPreferencesDocument,
			theme: ThemeMode.LIGHT,
			palette: Palette.GREEN,
		}, '100%' );

		await visualDiff( element, 'appearance-screen-green-narrow' );
	} );
} );
