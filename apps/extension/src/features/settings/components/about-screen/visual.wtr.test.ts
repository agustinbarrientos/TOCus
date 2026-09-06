import { assert, fixture, html } from '@open-wc/testing';
import { setupI18n } from '@lingui/core';
import { emulateMedia, setViewport } from '@web/test-runner-commands';
import { visualDiff } from '@web/test-runner-visual-regression';
import { messages as germanMessages } from '../../../../../locales/de.po';
import { Palette, ThemeMode } from '../../../../domains/preferences/types';
import { createTestI18n } from '../../../../localization/__fixtures__';
import { createAboutScreenCopy } from '../../../../localization/utils/create-about-screen-copy';
import './index';
import { type ComponentAboutScreen } from './index';
import { type AboutScreenCopy } from './types';

/**
 * English copy used by deterministic About-screen visual tests.
 * @since 0.1.0 Initial implementation.
 */
const ABOUT_COPY = createAboutScreenCopy( createTestI18n() );

/**
 * Configures the selected full-scene appearance and viewport before rendering.
 * @param theme - Explicit light or dark appearance.
 * @param palette - Selected TOCus color palette.
 * @param width - Browser viewport width.
 * @return Promise resolved after media and viewport settings are applied.
 * @since 0.1.0 Initial implementation.
 */
async function configureAppearance( theme: ThemeMode, palette: Palette, width: number ): Promise<void> {
	document.documentElement.setAttribute( 'data-tocus-theme', theme );
	document.documentElement.setAttribute( 'data-tocus-palette', palette );
	await setViewport( { height: 1_000, width } );
	await emulateMedia( {
		colorScheme: theme === ThemeMode.DARK ? 'dark' : 'light',
		forcedColors: 'none',
		reducedMotion: 'reduce',
	} );
}

/**
 * Renders a localized About screen at its available parent width.
 * @param copy - Localized About-screen messages.
 * @return Connected About screen.
 * @since 0.1.0 Initial implementation.
 */
async function renderAboutScreen( copy: Readonly<AboutScreenCopy> = ABOUT_COPY ): Promise<ComponentAboutScreen> {
	return fixture<ComponentAboutScreen>( html`
		<tocus-f-about-screen .copy=${ copy } .version=${ '0.1.0' }></tocus-f-about-screen>
	` );
}

describe( 'tocus-f-about-screen visual', () => {
	before( async () => {
		const loadedFonts = await document.fonts.load( '600 2rem "Fredoka Variable"', 'TOCus' );

		assert.isAbove( loadedFonts.length, 0 );
	} );

	afterEach( async () => {
		document.documentElement.removeAttribute( 'data-tocus-theme' );
		document.documentElement.removeAttribute( 'data-tocus-palette' );
		await setViewport( { height: 600, width: 800 } );
		await emulateMedia( {
			colorScheme: 'light',
			forcedColors: 'none',
			reducedMotion: 'no-preference',
		} );
	} );

	it( 'matches the light brown appearance', async () => {
		await configureAppearance( ThemeMode.LIGHT, Palette.BROWN, 800 );
		const element = await renderAboutScreen();

		await visualDiff( element, 'about-screen-brown-light' );
	} );

	it( 'matches the dark purple appearance', async () => {
		await configureAppearance( ThemeMode.DARK, Palette.PURPLE, 800 );
		const element = await renderAboutScreen();

		await visualDiff( element, 'about-screen-purple-dark' );
	} );

	it( 'wraps extended translated copy at a narrow width', async () => {
		await configureAppearance( ThemeMode.LIGHT, Palette.GREEN, 320 );
		const i18n = setupI18n( { locale: 'de', messages: { de: germanMessages } } );
		const element = await renderAboutScreen( createAboutScreenCopy( i18n ) );

		await visualDiff( element, 'about-screen-german-narrow' );
	} );
} );
