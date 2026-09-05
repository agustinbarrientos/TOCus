import { assert, fixture, html } from '@open-wc/testing';
import { emulateMedia, setViewport } from '@web/test-runner-commands';
import { visualDiff } from '@web/test-runner-visual-regression';
import {
	DefaultPreferencesDocument,
	Language,
	Palette,
	PreferencesDocumentSchema,
	ThemeMode,
	type Language as LanguageValue,
	type Palette as PaletteValue,
	type ThemeMode as ThemeModeValue,
} from '../../../../domains/preferences/types';
import { PreferencesUpdateSchema } from '../../../../domains/preferences/services/preferences-editor';
import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import { OnboardingSiteSuggestions } from '../../utils/site-suggestion-catalog';
import './index';
import { type ComponentOnboardingShell } from './index';

/**
 * Renders the initial onboarding page for one explicit appearance.
 * @param theme - Explicit light or dark appearance.
 * @param palette - Selected full-scene palette.
 * @param language - Exact language selected in the first step.
 * @return Connected and settled onboarding shell.
 * @since 0.1.0 Initial implementation.
 */
async function renderOnboardingShell(
	theme: ThemeModeValue,
	palette: PaletteValue,
	language: LanguageValue,
): Promise<ComponentOnboardingShell> {
	const element = await fixture<ComponentOnboardingShell>( html`
		<tocus-f-onboarding-shell
			data-tocus-theme=${ theme }
			style="width: 100%;"
			.copy=${ TestEnglishLocalizationBundle.onboarding }
			.interruptionCopy=${ TestEnglishLocalizationBundle.interruption }
			.editor=${ null }
			.enrollment=${ null }
			.language=${ language }
			.theme=${ theme }
			.palette=${ palette }
			.protectedRuleHosts=${ [] }
			.reducedMotion=${ true }
			.suggestions=${ OnboardingSiteSuggestions }
		></tocus-f-onboarding-shell>
	` );

	await element.updateComplete;

	return element;
}

/**
 * Advances one visual fixture through the public Language-step contract.
 * @param element - Onboarding shell to advance to Appearance.
 * @return Promise resolved after Appearance and its preview render.
 * @since 0.1.0 Initial implementation.
 */
async function showAppearanceStep( element: ComponentOnboardingShell ): Promise<void> {
	element.editor = {
		/**
		 * Loads deterministic visual-test preferences.
		 * @return Default preferences.
		 * @since 0.1.0 Initial implementation.
		 */
		load: () => Promise.resolve( DefaultPreferencesDocument ),
		/**
		 * Restores deterministic visual-test preferences.
		 * @return Default preferences.
		 * @since 0.1.0 Initial implementation.
		 */
		restoreDefaults: () => Promise.resolve( DefaultPreferencesDocument ),
		/**
		 * Applies one validated preference update for visual navigation.
		 * @param input - Unknown partial preference update.
		 * @return Complete updated preferences.
		 * @since 0.1.0 Initial implementation.
		 */
		update: ( input: unknown ) => Promise.resolve( PreferencesDocumentSchema.parse( {
			...DefaultPreferencesDocument,
			...PreferencesUpdateSchema.parse( input ),
		} ) ),
	};
	element.synchronizeLanguage = () => Promise.resolve( true );
	await element.updateComplete;
	const languageStep = element.shadowRoot?.querySelector( 'tocus-f-onboarding-language-step' );

	assert.instanceOf( languageStep, HTMLElement );
	languageStep.dispatchEvent( new CustomEvent( 'tocus-onboarding-language-continue', {
		bubbles: true,
		composed: true,
		detail: { language: element.language },
	} ) );
	await new Promise<void>( ( resolve ) => {
		setTimeout( resolve, 0 );
	} );
	await element.updateComplete;
}

/**
 * Configures deterministic browser media and inherited theme tokens.
 * @param theme - Explicit light or dark appearance.
 * @param palette - Selected full-scene palette.
 * @param systemColorScheme - Operating-system appearance used by browser chrome.
 * @return Promise resolved after browser media emulation settles.
 * @since 0.1.0 Initial implementation.
 */
async function configureAppearance(
	theme: ThemeModeValue,
	palette: PaletteValue,
	systemColorScheme: 'dark' | 'light',
): Promise<void> {
	document.documentElement.setAttribute( 'data-tocus-theme', theme );
	document.documentElement.setAttribute( 'data-tocus-palette', palette );
	await emulateMedia( {
		colorScheme: systemColorScheme,
		forcedColors: 'none',
		reducedMotion: 'reduce',
	} );
}

describe( 'tocus-f-onboarding-shell visual', () => {
	before( async () => {
		const loadedFonts = await document.fonts.load( '600 2rem "Fredoka Variable"', 'TOCus' );

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

	it( 'matches the initial page in the light brown appearance', async () => {
		await setViewport( { height: 1_000, width: 1_440 } );
		await configureAppearance( ThemeMode.LIGHT, Palette.BROWN, 'light' );
		const element = await renderOnboardingShell(
			ThemeMode.LIGHT,
			Palette.BROWN,
			Language.ENGLISH,
		);

		await visualDiff( element, 'onboarding-shell-brown-light' );
	} );

	it( 'matches the initial page in the narrow dark purple appearance', async () => {
		await setViewport( { height: 1_400, width: 420 } );
		await configureAppearance( ThemeMode.DARK, Palette.PURPLE, 'dark' );
		const element = await renderOnboardingShell(
			ThemeMode.DARK,
			Palette.PURPLE,
			Language.ENGLISH,
		);

		await visualDiff( element, 'onboarding-shell-purple-dark-narrow' );
	} );

	it( 'matches startup recovery in the dark brown appearance', async () => {
		await setViewport( { height: 1_000, width: 1_440 } );
		await configureAppearance( ThemeMode.DARK, Palette.BROWN, 'dark' );
		const element = await renderOnboardingShell(
			ThemeMode.DARK,
			Palette.BROWN,
			Language.ENGLISH,
		);

		element.startupUnavailable = true;
		await element.updateComplete;

		await visualDiff( element, 'onboarding-shell-recovery-brown-dark' );
	} );

	it( 'matches light Appearance with dark-system browser chrome around the preview', async () => {
		await setViewport( { height: 1_000, width: 1_440 } );
		await configureAppearance( ThemeMode.LIGHT, Palette.BROWN, 'dark' );
		const element = await renderOnboardingShell(
			ThemeMode.LIGHT,
			Palette.BROWN,
			Language.ENGLISH,
		);

		await showAppearanceStep( element );

		await visualDiff( element, 'onboarding-shell-appearance-brown-light' );
	} );

	it( 'keeps dark Appearance and its light-system preview chrome clear at narrow width', async () => {
		await setViewport( { height: 1_600, width: 420 } );
		await configureAppearance( ThemeMode.DARK, Palette.PURPLE, 'light' );
		const element = await renderOnboardingShell(
			ThemeMode.DARK,
			Palette.PURPLE,
			Language.ENGLISH,
		);

		await showAppearanceStep( element );

		await visualDiff( element, 'onboarding-shell-appearance-purple-dark-narrow' );
	} );
} );
