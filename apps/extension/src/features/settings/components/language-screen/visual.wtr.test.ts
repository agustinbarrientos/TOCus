import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import { assert, fixture, html } from '@open-wc/testing';
import { emulateMedia, setViewport } from '@web/test-runner-commands';
import { visualDiff } from '@web/test-runner-visual-regression';
import {
	DefaultPreferencesDocument,
	Language,
	Palette,
	ThemeMode,
	type PreferencesDocument,
} from '../../../../domains/preferences/types';
import { type PreferencesEditor } from '../../../../domains/preferences/services/preferences-editor';
import './index';
import { type ComponentLanguageScreen } from './index';
import {
	type LanguageScreenCopy,
} from './types';

/**
 * Formats the extended German browser-language helper used by the narrow visual fixture.
 * @param languageName - Native name of the detected browser language.
 * @return Extended German automatic-language explanation.
 * @since 0.1.0 Initial implementation.
 */
function formatLongGermanBrowserLanguageDescription( languageName: string ): string {
	return `Ihr Browser verwendet derzeit automatisch ${ languageName } f\u00fcr alle Hinweise und Einstellungen.`;
}

/**
 * Extended German messages used to verify translated-copy wrapping at a narrow width.
 * @since 0.1.0 Initial implementation.
 */
const LONG_GERMAN_LANGUAGE_COPY: Readonly<LanguageScreenCopy> = Object.freeze( {
	eyebrow: 'Personalisierung',
	title: 'Sprache',
	introduction: 'W\u00e4hlen Sie die Sprache, die TOCus in der gesamten Browser-Erweiterung f\u00fcr alle Hinweise und Einstellungen verwendet.',
	formLabel: 'Spracheinstellung',
	languageLabel: 'Sprache der TOCus-Benutzeroberfl\u00e4che',
	languageLabels: TestEnglishLocalizationBundle.languageScreen.languageLabels,
	browserLanguageOption: 'Spracheinstellungen des Browsers automatisch verwenden',
	explicitLanguageDescription: 'TOCus verwendet diese Sprache weiter, bis Sie in den Einstellungen eine andere ausw\u00e4hlen.',
	loading: 'Spracheinstellungen werden geladen...',
	malformedDataTitle: 'Die Personalisierungseinstellungen ben\u00f6tigen Ihre Aufmerksamkeit',
	malformedDataDescription: 'Die lokalen Personalisierungsdaten sind ung\u00fcltig. Beim Wiederherstellen werden Darstellung, Pause, Bewegung und Sprache zur\u00fcckgesetzt.',
	loadErrorTitle: 'Die Spracheinstellungen konnten nicht geladen werden',
	loadErrorDescription: 'TOCus konnte die lokale Spracheinstellung nicht laden. Es wurde nichts ge\u00e4ndert.',
	retry: 'Erneut versuchen',
	restoreDefaults: 'Personalisierungsstandards wiederherstellen',
	restoreDefaultsError: 'TOCus konnte Ihre Personalisierungsstandards nicht wiederherstellen. Es wurde nichts ge\u00e4ndert.',
	saveError: 'Ihre Sprache konnte nicht gespeichert werden. TOCus verwendet wieder die vorherige Sprache.',
	savedAnnouncement: 'Sprache gespeichert.',
	restoredAnnouncement: 'Personalisierungsstandards wiederhergestellt.',
	formatBrowserLanguageDescription: formatLongGermanBrowserLanguageDescription,
} );

/**
 * In-memory preferences persistence used by deterministic Language screenshots.
 * @since 0.1.0 Initial implementation.
 */
class MemoryLanguageVisualEditor implements PreferencesEditor {
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
	 * Returns default preferences for the unused recovery action.
	 * @return Complete default preferences.
	 * @since 0.1.0 Initial implementation.
	 */
	restoreDefaults(): Promise<PreferencesDocument> {
		return Promise.resolve( DefaultPreferencesDocument );
	}
}

/**
 * Renders a ready Language screen with deterministic local preferences and copy.
 * @param preferences - Preferences shown by the screen.
 * @param width - Explicit component width.
 * @param browserLanguage - Effective language derived from browser preferences.
 * @param copy - Localized messages shown by the screen.
 * @return Connected and ready Language screen.
 * @since 0.1.0 Initial implementation.
 */
async function renderLanguageScreen(
	preferences: PreferencesDocument,
	width: string,
	browserLanguage: Language,
	copy: Readonly<LanguageScreenCopy> = TestEnglishLocalizationBundle.languageScreen,
): Promise<ComponentLanguageScreen> {
	const editor = new MemoryLanguageVisualEditor( preferences );
	const element = await fixture<ComponentLanguageScreen>( html`
		<tocus-f-language-screen
			style=${ `width: ${ width };` }
			.editor=${ editor }
			.browserLanguage=${ browserLanguage }
			.copy=${ copy }
		></tocus-f-language-screen>
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

describe( 'tocus-f-language-screen visual', () => {
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

	it( 'matches the browser-following choice in the light brown appearance', async () => {
		await setViewport( { height: 900, width: 1_280 } );
		await configureAppearance( ThemeMode.LIGHT, Palette.BROWN );
		const element = await renderLanguageScreen(
			{ ...DefaultPreferencesDocument },
			'44rem',
			Language.ENGLISH,
		);

		await visualDiff( element, 'language-screen-brown-light' );
	} );

	it( 'matches the Japanese choice in the dark purple appearance', async () => {
		await setViewport( { height: 900, width: 1_280 } );
		await configureAppearance( ThemeMode.DARK, Palette.PURPLE );
		const element = await renderLanguageScreen( {
			...DefaultPreferencesDocument,
			language: Language.JAPANESE,
		}, '44rem', Language.ENGLISH );

		await visualDiff( element, 'language-screen-purple-dark' );
	} );

	it( 'wraps extended German copy in the narrow green appearance', async () => {
		await setViewport( { height: 1_000, width: 420 } );
		await configureAppearance( ThemeMode.LIGHT, Palette.GREEN );
		const element = await renderLanguageScreen( {
			...DefaultPreferencesDocument,
			language: Language.GERMAN,
		}, '100%', Language.GERMAN, LONG_GERMAN_LANGUAGE_COPY );

		await visualDiff( element, 'language-screen-german-narrow' );
	} );
} );
