import { assert, fixture, html } from '@open-wc/testing';
import { emulateMedia, setViewport } from '@web/test-runner-commands';
import { visualDiff } from '@web/test-runner-visual-regression';
import {
	Language,
	Palette,
	ThemeMode,
	type Language as LanguageValue,
	type Palette as PaletteValue,
	type ThemeMode as ThemeModeValue,
} from '../../../../domains/preferences/types';
import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import './index';
import {
	OnboardingLanguageFamily,
	OnboardingLanguageSelectEventName,
	type ComponentOnboardingLanguageStep,
	type OnboardingLanguageEventDetail,
	type OnboardingLanguageFamily as OnboardingLanguageFamilyValue,
	type OnboardingLanguageStepCopy,
} from './index';

/**
 * Expected Spanish projection used to prove that selection does not retain English copy.
 * @since 0.1.0 Initial implementation.
 */
const SpanishLanguageStepCopy: Readonly<OnboardingLanguageStepCopy> = Object.freeze( {
	...TestEnglishLocalizationBundle.onboarding.language,
	title: 'Elige tu idioma',
	introduction: 'TOCus usar\u00e1 este idioma en toda la extensi\u00f3n. Puedes cambiarlo m\u00e1s adelante en Configuraci\u00f3n.',
	languageLegend: 'Idioma',
	spanishVariantLegend: '\u00bfQu\u00e9 variante de espa\u00f1ol quieres que use TOCus?',
	portugueseVariantLegend: '\u00bfQu\u00e9 variante de portugu\u00e9s quieres que use TOCus?',
	continueLabel: 'Continuar',
} );

/**
 * Expected Brazilian Portuguese projection used to prove that selection does not retain English copy.
 * @since 0.1.0 Initial implementation.
 */
const PortugueseLanguageStepCopy: Readonly<OnboardingLanguageStepCopy> = Object.freeze( {
	...TestEnglishLocalizationBundle.onboarding.language,
	title: 'Escolha seu idioma',
	introduction: 'O TOCus usar\u00e1 esse idioma em toda a extens\u00e3o. Voc\u00ea pode alter\u00e1-lo depois nas Configura\u00e7\u00f5es.',
	languageLegend: 'Idioma',
	spanishVariantLegend: 'Qual variante do espanhol o TOCus deve usar?',
	portugueseVariantLegend: 'Qual variante do portugu\u00eas o TOCus deve usar?',
	continueLabel: 'Continuar',
} );

/**
 * Renders a ready Language step at one explicit width.
 * @param language - Exact language selected in the fixture.
 * @param width - Explicit component width.
 * @return Connected and settled Language step.
 * @since 0.1.0 Initial implementation.
 */
async function renderLanguageStep(
	language: LanguageValue,
	width: string,
): Promise<ComponentOnboardingLanguageStep> {
	const element = await fixture<ComponentOnboardingLanguageStep>( html`
		<tocus-f-onboarding-language-step
			style=${ `width: ${ width };` }
			.copy=${ TestEnglishLocalizationBundle.onboarding.language }
			.language=${ language }
		></tocus-f-onboarding-language-step>
	` );

	await element.updateComplete;

	return element;
}

/**
 * Selects one language family through the real onboarding control.
 * @param element - Connected Language-step component.
 * @param family - Language family value exposed by its native radio control.
 * @param expectedLanguage - Exact default language required for the selected family.
 * @param copy - Expected complete localized projection for the exact selection.
 * @return Promise resolved after the localized conditional choices render.
 * @since 0.1.0 Initial implementation.
 */
async function selectLanguageFamily(
	element: ComponentOnboardingLanguageStep,
	family: OnboardingLanguageFamilyValue,
	expectedLanguage: LanguageValue,
	copy: Readonly<OnboardingLanguageStepCopy>,
): Promise<void> {
	const input = element.shadowRoot?.querySelector<HTMLInputElement>( `input[value="${ family }"]` );
	const selection = new Promise<CustomEvent<OnboardingLanguageEventDetail>>( ( resolve ) => {
		element.addEventListener( OnboardingLanguageSelectEventName, ( event ) => {
			if ( event instanceof CustomEvent ) {
				resolve( event );
			}
		}, { once: true } );
	} );

	assert.instanceOf( input, HTMLInputElement );
	input.click();
	const selectedLanguage = ( await selection ).detail.language;

	assert.equal( selectedLanguage, expectedLanguage );
	element.language = selectedLanguage;
	element.copy = copy;
	await element.updateComplete;
}

/**
 * Configures deterministic browser media and inherited theme tokens.
 * @param theme - Explicit light or dark appearance.
 * @param palette - Selected full-scene palette.
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

describe( 'tocus-f-onboarding-language-step visual', () => {
	before( async () => {
		const loadedFonts = await document.fonts.load( '600 2rem "Fredoka Variable"', 'Language' );

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

	it( 'matches the English choice in the light brown appearance', async () => {
		await setViewport( { height: 900, width: 1_280 } );
		await configureAppearance( ThemeMode.LIGHT, Palette.BROWN );
		const element = await renderLanguageStep( Language.ENGLISH, '50rem' );

		await visualDiff( element, 'onboarding-language-step-english-light' );
	} );

	it( 'matches the localized Spanish variant choice in the narrow dark purple appearance', async () => {
		await setViewport( { height: 1_100, width: 420 } );
		await configureAppearance( ThemeMode.DARK, Palette.PURPLE );
		const element = await renderLanguageStep( Language.ENGLISH, '100%' );

		await selectLanguageFamily(
			element,
			OnboardingLanguageFamily.SPANISH,
			Language.SPANISH_TU,
			SpanishLanguageStepCopy,
		);

		await visualDiff( element, 'onboarding-language-step-spanish-tu-dark-narrow' );
	} );

	it( 'matches the localized Portuguese variant choice in the narrow dark purple appearance', async () => {
		await setViewport( { height: 1_100, width: 420 } );
		await configureAppearance( ThemeMode.DARK, Palette.PURPLE );
		const element = await renderLanguageStep( Language.ENGLISH, '100%' );

		await selectLanguageFamily(
			element,
			OnboardingLanguageFamily.PORTUGUESE,
			Language.PORTUGUESE_BRAZIL,
			PortugueseLanguageStepCopy,
		);

		await visualDiff( element, 'onboarding-language-step-portuguese-brazil-dark-narrow' );
	} );
} );
