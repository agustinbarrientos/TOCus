import { assert, expect, fixture, html } from '@open-wc/testing';
import { emulateMedia, setViewport } from '@web/test-runner-commands';
import {
	DefaultPreferencesDocument,
	Language,
	Palette,
	PreferencesDocumentSchema,
	ThemeMode,
	type PreferencesDocument,
} from '../../../../domains/preferences/types';
import {
	PreferencesUpdateSchema,
	type PreferencesEditor,
} from '../../../../domains/preferences/services/preferences-editor';
import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import {
	InterruptionScreenMode,
	InterruptionScreenState,
	type ComponentInterruptionScreen,
} from '../../../interruption/components/screen';
import { OnboardingSiteSuggestions } from '../../utils/site-suggestion-catalog';
import {
	ComponentOnboardingShell,
	OnboardingCompleteEventName,
	OnboardingOpenSettingsEventName,
	OnboardingRetryEventName,
} from './index';
import {
	type OnboardingLanguageSynchronizer,
	type OnboardingShellCopy,
} from './types';

/**
 * Formats deterministic test progress copy.
 * @param currentStep - One-based current step.
 * @param totalSteps - Total onboarding steps.
 * @param stepName - Localized current-step name.
 * @return English progress label.
 * @since 0.1.0 Initial implementation.
 */
function formatStepProgress( currentStep: number, totalSteps: number, stepName: string ): string {
	return `Step ${ currentStep.toString() } of ${ totalSteps.toString() }: ${ stepName }`;
}

/**
 * Formats one site action in shell tests.
 * @param siteName - Visible site name.
 * @return English site action.
 * @since 0.1.0 Initial implementation.
 */
function formatAddSuggestionLabel( siteName: string ): string {
	return `Protect ${ siteName }`;
}

/**
 * Formats one pending site action in shell tests.
 * @param siteName - Visible site name.
 * @return English pending site action.
 * @since 0.1.0 Initial implementation.
 */
function formatAddingSuggestionLabel( siteName: string ): string {
	return `Adding ${ siteName }`;
}

/**
 * Formats one selected-site status in shell tests.
 * @param siteName - Visible site name.
 * @return English selected-site status.
 * @since 0.1.0 Initial implementation.
 */
function formatAddedSuggestionLabel( siteName: string ): string {
	return `${ siteName } protected`;
}

/**
 * Formats one successful site announcement in shell tests.
 * @param siteName - Visible site name.
 * @return English success announcement.
 * @since 0.1.0 Initial implementation.
 */
function formatAddedAnnouncement( siteName: string ): string {
	return `${ siteName } is now protected.`;
}

/**
 * Complete English copy used by onboarding-shell tests.
 * @since 0.1.0 Initial implementation.
 */
const TEST_COPY: Readonly<OnboardingShellCopy> = {
	introduction: 'Create a gentle pause before the websites you choose.',
	privacyTitle: 'Private by design',
	privacyDescription: 'Your choices and statistics stay on this device. TOCus never reads your browsing history.',
	progressLabel: 'Setup progress',
	stepNames: {
		language: 'Language',
		appearance: 'Appearance',
		sites: 'Websites',
	},
	formatStepProgress,
	preferenceSaveError: 'Your choice could not be saved. Try again.',
	settingsNote: 'Change language and appearance, then fine-tune timing and schedules, any time in Settings.',
	completionTitle: "You're all set",
	completionDescription: 'TOCus is ready. You can close this tab or continue in Settings.',
	openSettingsLabel: 'Open Settings',
	startupErrorTitle: 'TOCus could not finish opening',
	startupErrorDescription: 'Try again, or continue in Settings.',
	retryLabel: 'Try again',
	language: {
		title: 'Choose your language',
		introduction: 'You can change this later in Settings.',
		languageLegend: 'Language',
		languageLabels: {
			en: 'English',
			es: 'Espa\u00f1ol',
			pt: 'Portugu\u00eas',
			it: 'Italiano',
			fr: 'Fran\u00e7ais',
			de: 'Deutsch',
			ja: '\u65e5\u672c\u8a9e',
			ru: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439',
		},
		spanishVariantLegend: 'How do you prefer Spanish?',
		spanishTuLabel: 'T\u00fa',
		spanishVosLabel: 'Vos',
		portugueseVariantLegend: 'Which Portuguese do you prefer?',
		portugueseBrazilLabel: 'Brasil',
		portuguesePortugalLabel: 'Portugal',
		continueLabel: 'Continue',
	},
	appearance: {
		title: 'Make it yours',
		introduction: 'Choose the appearance and color that feel most comfortable.',
		themeLegend: 'Appearance',
		themeOptions: {
			system: { label: 'System', description: 'Follow your device appearance.' },
			light: { label: 'Light', description: 'Use a light appearance.' },
			dark: { label: 'Dark', description: 'Use a dark appearance.' },
		},
		paletteLegend: 'Color',
		paletteLabels: {
			brown: 'Brown',
			green: 'Green',
			blue: 'Blue',
			purple: 'Purple',
			pink: 'Pink',
			orange: 'Orange',
		},
		previewTitle: 'This is what you\'ll see',
		continueLabel: 'Continue',
	},
	sites: {
		...TestEnglishLocalizationBundle.onboarding.sites,
		title: 'Choose your protected sites',
		introduction: 'Pick suggestions or add a website yourself. You can change this later.',
		suggestionsLegend: 'Popular choices',
		formatAddSuggestionLabel,
		formatAddingSuggestionLabel,
		formatAddedSuggestionLabel,
		manualLegend: 'Add another website',
		addressLabel: 'Website address',
		addressPlaceholder: 'example.com',
		addressHelp: 'Enter a domain or an http or https address.',
		addSiteLabel: 'Add site',
		addingSiteLabel: 'Adding site',
		invalidSiteError: 'Enter a valid website address.',
		alreadyProtectedError: 'That website is already protected.',
		permissionDeniedError: 'TOCus needs website access before it can protect this site.',
		permissionRequestError: 'Website access could not be requested. Try again.',
		permissionRetainedError: 'The site was not saved, but browser access may still be active.',
		saveError: 'The site could not be saved. Try again.',
		unexpectedError: 'Something went wrong. Try again.',
		formatAddedAnnouncement,
		finishLabel: 'Finish setup',
	},
};

/**
 * In-memory preferences editor used by onboarding-shell tests.
 * @since 0.1.0 Initial implementation.
 */
class MemoryOnboardingPreferencesEditor implements PreferencesEditor {
	/** Updates accepted by the editor in call order. */
	readonly updates: unknown[] = [];

	/** Whether updates should fail as if persistence were unavailable. */
	failUpdates = false;

	/** Optional controlled result returned instead of applying an update. */
	updateResult: PreferencesDocument | null | undefined;

	/** Current complete preferences document. */
	private preferences: PreferencesDocument = { ...DefaultPreferencesDocument };

	/**
	 * Loads the current in-memory preferences.
	 * @return Current complete preferences.
	 * @since 0.1.0 Initial implementation.
	 */
	load(): Promise<PreferencesDocument> {
		return Promise.resolve( this.preferences );
	}

	/**
	 * Applies one validated in-memory preference update.
	 * @param input - Unknown update received from the shell.
	 * @return Updated preferences, or a rejected promise for a controlled failure.
	 * @since 0.1.0 Initial implementation.
	 */
	update( input: unknown ): Promise<PreferencesDocument | null> {
		this.updates.push( input );
		if ( this.failUpdates ) {
			return Promise.reject( new Error( 'Controlled persistence failure.' ) );
		}

		if ( this.updateResult !== undefined ) {
			return Promise.resolve( this.updateResult );
		}

		const update = PreferencesUpdateSchema.parse( input );

		this.preferences = PreferencesDocumentSchema.parse( {
			...this.preferences,
			...update,
		} );

		return Promise.resolve( this.preferences );
	}

	/**
	 * Restores safe default preferences.
	 * @return Default preferences.
	 * @since 0.1.0 Initial implementation.
	 */
	restoreDefaults(): Promise<PreferencesDocument> {
		this.preferences = { ...DefaultPreferencesDocument };

		return Promise.resolve( this.preferences );
	}
}

/**
 * Waits for queued component work and asynchronous persistence.
 * @return Promise resolved after the current task.
 * @since 0.1.0 Initial implementation.
 */
async function settle(): Promise<void> {
	await new Promise<void>( ( resolve ) => {
		setTimeout( resolve, 0 );
	} );
}

/**
 * Renders one onboarding shell with controlled dependencies.
 * @param editor - Preferences editor supplied to the shell, or null when unavailable.
 * @param synchronizeLanguage - Localization readiness gate supplied to the shell.
 * @return Connected onboarding shell.
 * @since 0.1.0 Initial implementation.
 */
async function renderShell(
	editor: PreferencesEditor | null,
	synchronizeLanguage: OnboardingLanguageSynchronizer = () => Promise.resolve( true ),
): Promise<ComponentOnboardingShell> {
	return fixture<ComponentOnboardingShell>( html`
		<tocus-f-onboarding-shell
			.copy=${ TEST_COPY }
			.interruptionCopy=${ TestEnglishLocalizationBundle.interruption }
			.editor=${ editor }
			.enrollment=${ null }
			.language=${ Language.ENGLISH }
			.theme=${ ThemeMode.SYSTEM }
			.palette=${ Palette.BROWN }
			.protectedSites=${ [] }
			.suggestions=${ OnboardingSiteSuggestions }
			.synchronizeLanguage=${ synchronizeLanguage }
		></tocus-f-onboarding-shell>
	` );
}

/**
 * Returns the connected component shadow root.
 * @param element - Onboarding shell under test.
 * @return Component shadow root.
 * @since 0.1.0 Initial implementation.
 */
function getShadowRoot( element: ComponentOnboardingShell ): ShadowRoot {
	const shadowRoot = element.shadowRoot;

	assert.instanceOf( shadowRoot, ShadowRoot );
	if ( ! ( shadowRoot instanceof ShadowRoot ) ) {
		throw new TypeError( 'Expected the onboarding shell to render a shadow root.' );
	}

	return shadowRoot;
}

describe( 'tocus-f-onboarding-shell', () => {
	it( 'renders nothing until localized copy is supplied', async () => {
		const element = await fixture<ComponentOnboardingShell>( html`
			<tocus-f-onboarding-shell></tocus-f-onboarding-shell>
		` );

		assert.equal( getShadowRoot( element ).childElementCount, 0 );
	} );

	it( 'starts with the localized Language step and private local-only context', async () => {
		const element = await renderShell( new MemoryOnboardingPreferencesEditor() );
		const shadowRoot = getShadowRoot( element );

		assert.equal( customElements.get( 'tocus-f-onboarding-shell' ), ComponentOnboardingShell );
		assert.instanceOf( shadowRoot.querySelector( 'tocus-f-onboarding-language-step' ), HTMLElement );
		assert.include( shadowRoot.querySelector( '.privacy-card' )?.textContent, TEST_COPY.privacyDescription );
		assert.instanceOf( shadowRoot.querySelector( '.privacy-mark svg' ), SVGElement );
		assert.equal( shadowRoot.querySelector( '.privacy-mark svg' )?.getAttribute( 'viewBox' ), '0 0 640 640' );
		assert.equal( shadowRoot.querySelector( '.welcome-label' ), null );
		assert.equal( shadowRoot.querySelector( 'tocus-f-interruption-screen' ), null );
		assert.equal( shadowRoot.querySelector( '.non-clinical-note' ), null );
		assert.equal( shadowRoot.querySelector( '[aria-current="step"] strong' )?.textContent.trim(), 'Language' );
		await expect( element ).to.be.accessible();
	} );

	it( 'offers localized recovery actions when onboarding cannot start', async () => {
		const element = await renderShell( new MemoryOnboardingPreferencesEditor() );
		const shadowRoot = getShadowRoot( element );
		let openSettingsCount = 0;
		let retryCount = 0;

		element.addEventListener( OnboardingOpenSettingsEventName, () => {
			openSettingsCount += 1;
		} );
		element.addEventListener( OnboardingRetryEventName, () => {
			retryCount += 1;
		} );
		element.startupUnavailable = true;
		await element.updateComplete;

		assert.equal( shadowRoot.querySelector( 'tocus-f-onboarding-language-step' ), null );
		assert.include( shadowRoot.querySelector( '.recovery' )?.textContent, TEST_COPY.startupErrorTitle );
		const retryButton = shadowRoot.querySelector( '.recovery__retry' );
		const openSettingsButton = shadowRoot.querySelector( '.recovery__settings' );

		assert.instanceOf( retryButton, HTMLButtonElement );
		assert.instanceOf( openSettingsButton, HTMLButtonElement );
		const recoveryIcon = shadowRoot.querySelector( '.recovery__mark svg' );
		const actionColorProbe = document.createElement( 'span' );

		actionColorProbe.style.backgroundColor = 'var(--tocus-color-action)';
		shadowRoot.append( actionColorProbe );

		assert.instanceOf( recoveryIcon, SVGElement );
		assert.equal( recoveryIcon.getAttribute( 'viewBox' ), '0 0 640 640' );
		assert.equal(
			getComputedStyle( retryButton ).backgroundColor,
			getComputedStyle( actionColorProbe ).backgroundColor,
		);
		assert.equal( getComputedStyle( openSettingsButton ).backgroundColor, 'rgba(0, 0, 0, 0)' );
		actionColorProbe.remove();
		retryButton.click();
		openSettingsButton.click();

		assert.equal( retryCount, 1 );
		assert.equal( openSettingsCount, 1 );
		await expect( element ).to.be.accessible();
	} );

	it( 'persists the exact selected language before showing Appearance', async () => {
		const editor = new MemoryOnboardingPreferencesEditor();
		const element = await renderShell( editor );
		const shadowRoot = getShadowRoot( element );
		const languageStep = shadowRoot.querySelector( 'tocus-f-onboarding-language-step' );

		assert.instanceOf( languageStep, HTMLElement );
		languageStep.dispatchEvent( new CustomEvent( 'tocus-onboarding-language-select', {
			bubbles: true,
			composed: true,
			detail: { language: Language.SPANISH_VOS },
		} ) );
		languageStep.dispatchEvent( new CustomEvent( 'tocus-onboarding-language-continue', {
			bubbles: true,
			composed: true,
			detail: { language: Language.SPANISH_VOS },
		} ) );
		await settle();
		await element.updateComplete;

		assert.deepEqual( editor.updates, [ { language: Language.SPANISH_VOS } ] );
		assert.instanceOf( shadowRoot.querySelector( 'tocus-f-onboarding-appearance-step' ), HTMLElement );
	} );

	it( 'keeps Language visible until the newest selected localization is applied', async () => {
		const localization = Promise.withResolvers<boolean>();
		const editor = new MemoryOnboardingPreferencesEditor();
		const synchronizedLanguages: Language[] = [];

		/**
		 * Defers localization so the navigation gate can be observed.
		 * @param language - Language requested by the onboarding shell.
		 * @return Deferred synchronization result.
		 * @since 0.1.0 Initial implementation.
		 */
		const synchronizeLanguage: OnboardingLanguageSynchronizer = ( language ) => {
			synchronizedLanguages.push( language );

			return localization.promise;
		};
		const element = await renderShell( editor, synchronizeLanguage );
		const shadowRoot = getShadowRoot( element );
		const languageStep = shadowRoot.querySelector( 'tocus-f-onboarding-language-step' );

		assert.instanceOf( languageStep, HTMLElement );
		languageStep.dispatchEvent( new CustomEvent( 'tocus-onboarding-language-continue', {
			bubbles: true,
			composed: true,
			detail: { language: Language.SPANISH_VOS },
		} ) );
		await settle();
		await element.updateComplete;

		assert.instanceOf( shadowRoot.querySelector( 'tocus-f-onboarding-language-step' ), HTMLElement );
		assert.equal( shadowRoot.querySelector( 'tocus-f-onboarding-appearance-step' ), null );
		assert.equal( languageStep.pending, true );
		assert.deepEqual( synchronizedLanguages, [ Language.SPANISH_VOS ] );

		localization.resolve( true );
		await settle();
		await element.updateComplete;

		assert.instanceOf( shadowRoot.querySelector( 'tocus-f-onboarding-appearance-step' ), HTMLElement );
	} );

	it( 'keeps Language visible when a superseded localization is not applied', async () => {
		const editor = new MemoryOnboardingPreferencesEditor();
		const element = await renderShell( editor, () => Promise.resolve( false ) );
		const shadowRoot = getShadowRoot( element );
		const languageStep = shadowRoot.querySelector( 'tocus-f-onboarding-language-step' );

		assert.instanceOf( languageStep, HTMLElement );
		languageStep.dispatchEvent( new CustomEvent( 'tocus-onboarding-language-continue', {
			bubbles: true,
			composed: true,
			detail: { language: Language.SPANISH_VOS },
		} ) );
		await settle();
		await element.updateComplete;

		assert.instanceOf( shadowRoot.querySelector( 'tocus-f-onboarding-language-step' ), HTMLElement );
		assert.equal( shadowRoot.querySelector( 'tocus-f-onboarding-appearance-step' ), null );
		assert.equal( languageStep.pending, false );
	} );

	it( 'keeps the current step visible when its preference cannot be saved', async () => {
		const editor = new MemoryOnboardingPreferencesEditor();

		editor.failUpdates = true;
		const element = await renderShell( editor );
		const shadowRoot = getShadowRoot( element );
		const languageStep = shadowRoot.querySelector( 'tocus-f-onboarding-language-step' );

		assert.instanceOf( languageStep, HTMLElement );
		const continueButton = languageStep.shadowRoot?.querySelector( '.continue-action' );

		assert.instanceOf( continueButton, HTMLButtonElement );
		continueButton.focus();
		languageStep.dispatchEvent( new CustomEvent( 'tocus-onboarding-language-continue', {
			bubbles: true,
			composed: true,
			detail: { language: Language.ENGLISH },
		} ) );
		await settle();
		await element.updateComplete;

		const currentLanguageStep = shadowRoot.querySelector( 'tocus-f-onboarding-language-step' );

		assert.instanceOf( currentLanguageStep, HTMLElement );
		assert.equal( currentLanguageStep.errorMessage, TEST_COPY.preferenceSaveError );
		assert.notEqual(
			currentLanguageStep.shadowRoot?.activeElement?.getAttribute( 'id' ),
			'language-step-title',
		);

		element.copy = {
			...TEST_COPY,
			preferenceSaveError: 'Translated preference error.',
		};
		await element.updateComplete;

		assert.equal( currentLanguageStep.errorMessage, 'Translated preference error.' );
	} );

	it( 'keeps Language visible when the preference editor is unavailable', async () => {
		const element = await renderShell( null );
		const shadowRoot = getShadowRoot( element );
		const languageStep = shadowRoot.querySelector( 'tocus-f-onboarding-language-step' );

		assert.instanceOf( languageStep, HTMLElement );
		languageStep.dispatchEvent( new CustomEvent( 'tocus-onboarding-language-continue', {
			bubbles: true,
			composed: true,
			detail: { language: Language.ENGLISH },
		} ) );
		await settle();
		await element.updateComplete;

		assert.instanceOf( shadowRoot.querySelector( 'tocus-f-onboarding-language-step' ), HTMLElement );
		assert.equal( languageStep.errorMessage, TEST_COPY.preferenceSaveError );
	} );

	it( 'keeps Language visible when persistence returns unusable preferences', async () => {
		const results: readonly ( PreferencesDocument | null )[] = [
			null,
			{ ...DefaultPreferencesDocument, language: null },
		];

		for ( const result of results ) {
			const editor = new MemoryOnboardingPreferencesEditor();

			editor.updateResult = result;
			const element = await renderShell( editor );
			const shadowRoot = getShadowRoot( element );
			const languageStep = shadowRoot.querySelector( 'tocus-f-onboarding-language-step' );

			assert.instanceOf( languageStep, HTMLElement );
			languageStep.dispatchEvent( new CustomEvent( 'tocus-onboarding-language-continue', {
				bubbles: true,
				composed: true,
				detail: { language: Language.ENGLISH },
			} ) );
			await settle();
			await element.updateComplete;

			assert.instanceOf( shadowRoot.querySelector( 'tocus-f-onboarding-language-step' ), HTMLElement );
			assert.equal( languageStep.errorMessage, TEST_COPY.preferenceSaveError );
		}
	} );

	it( 'previews breathing and persists only theme and color before the final step', async () => {
		const editor = new MemoryOnboardingPreferencesEditor();
		const element = await renderShell( editor );
		const shadowRoot = getShadowRoot( element );
		const languageStep = shadowRoot.querySelector( 'tocus-f-onboarding-language-step' );

		assert.instanceOf( languageStep, HTMLElement );
		languageStep.dispatchEvent( new CustomEvent( 'tocus-onboarding-language-continue', {
			bubbles: true,
			composed: true,
			detail: { language: Language.ENGLISH },
		} ) );
		await settle();
		await element.updateComplete;

		const appearanceStep = shadowRoot.querySelector( 'tocus-f-onboarding-appearance-step' );
		const preview = shadowRoot.querySelector<ComponentInterruptionScreen>(
			'tocus-f-interruption-screen',
		);

		assert.instanceOf( appearanceStep, HTMLElement );
		assert.instanceOf( preview, HTMLElement );
		assert.notInclude( appearanceStep.shadowRoot?.textContent ?? '', 'Quiet' );
		assert.equal( preview.copy, TestEnglishLocalizationBundle.interruption );
		assert.equal( preview.wellbeingSummary, '' );
		assert.isTrue( preview.preview );
		assert.isTrue( preview.progressing );
		assert.equal( preview.state, InterruptionScreenState.WAITING );
		assert.isFalse( preview.continueShortcutEnabled );
		assert.equal( preview.getAttribute( 'aria-hidden' ), 'true' );
		assert.isTrue( preview.hasAttribute( 'inert' ) );
		assert.equal( preview.shadowRoot?.querySelector( 'button' ), null );
		assert.equal( preview.mode, InterruptionScreenMode.BREATHING );
		assert.equal(
			shadowRoot.querySelector( '.pause-preview figcaption' )?.textContent.trim(),
			'This is what you\'ll see',
		);
		assert.isTrue(
			shadowRoot.querySelector( '.onboarding-layout' )?.classList.contains(
				'onboarding-layout-with-preview',
			),
		);
		appearanceStep.dispatchEvent( new CustomEvent( 'tocus-onboarding-appearance-select', {
			bubbles: true,
			composed: true,
			detail: {
				theme: ThemeMode.DARK,
				palette: Palette.GREEN,
			},
		} ) );
		await element.updateComplete;

		assert.equal( element.getAttribute( 'data-tocus-theme' ), ThemeMode.DARK );
		assert.equal( element.getAttribute( 'data-tocus-palette' ), Palette.GREEN );
		assert.equal( preview.mode, InterruptionScreenMode.BREATHING );
		assert.deepEqual( editor.updates, [ { language: Language.ENGLISH } ] );
		await expect( element ).to.be.accessible();
		appearanceStep.dispatchEvent( new CustomEvent( 'tocus-onboarding-appearance-continue', {
			bubbles: true,
			composed: true,
			detail: {
				theme: ThemeMode.DARK,
				palette: Palette.GREEN,
			},
		} ) );
		await settle();
		await element.updateComplete;

		assert.deepEqual( editor.updates.at( -1 ), {
			theme: ThemeMode.DARK,
			palette: Palette.GREEN,
		} );
		const sitesStep = shadowRoot.querySelector( 'tocus-f-onboarding-sites-step' );

		assert.instanceOf( sitesStep, HTMLElement );
		assert.deepEqual( sitesStep.protectedSites, [] );
		assert.equal( shadowRoot.querySelector( 'tocus-f-interruption-screen' ), null );
		assert.isFalse(
			shadowRoot.querySelector( '.onboarding-layout' )?.classList.contains(
				'onboarding-layout-with-preview',
			),
		);
		await expect( element ).to.be.accessible();
	} );

	it( 'keeps a layered browser preview at the viewport bottom-left', async () => {
		await setViewport( { height: 1_000, width: 1_440 } );
		await emulateMedia( { colorScheme: 'light', forcedColors: 'none' } );

		try {
			const editor = new MemoryOnboardingPreferencesEditor();
			const element = await renderShell( editor );
			const shadowRoot = getShadowRoot( element );
			const languageStep = shadowRoot.querySelector( 'tocus-f-onboarding-language-step' );

			assert.instanceOf( languageStep, HTMLElement );
			languageStep.dispatchEvent( new CustomEvent( 'tocus-onboarding-language-continue', {
				bubbles: true,
				composed: true,
				detail: { language: Language.ENGLISH },
			} ) );
			await settle();
			await element.updateComplete;

			const preview = shadowRoot.querySelector( '.pause-preview' );
			const setupCard = shadowRoot.querySelector( '.setup-card' );
			const browserWindow = shadowRoot.querySelector( '.pause-preview-browser' );
			const browserChrome = shadowRoot.querySelector( '.pause-preview-chrome' );
			const tabStrip = shadowRoot.querySelector( '.pause-preview-tab-strip' );
			const toolbar = shadowRoot.querySelector( '.pause-preview-toolbar' );
			const windowControls = shadowRoot.querySelector( '.pause-preview-window-controls' );
			const browserTab = shadowRoot.querySelector( '.pause-preview-tab' );
			const browserAddress = shadowRoot.querySelector( '.pause-preview-address' );
			const addressPlaceholder = shadowRoot.querySelector( '.pause-preview-address-placeholder' );
			const browserViewport = shadowRoot.querySelector( '.pause-preview-viewport' );

			assert.instanceOf( preview, HTMLElement );
			assert.instanceOf( setupCard, HTMLElement );
			assert.instanceOf( browserWindow, HTMLElement );
			assert.instanceOf( browserChrome, HTMLElement );
			assert.instanceOf( tabStrip, HTMLElement );
			assert.instanceOf( toolbar, HTMLElement );
			assert.instanceOf( windowControls, HTMLElement );
			assert.instanceOf( browserTab, HTMLElement );
			assert.instanceOf( browserAddress, HTMLElement );
			assert.instanceOf( addressPlaceholder, HTMLElement );
			assert.instanceOf( browserViewport, HTMLElement );
			assert.equal( preview.parentNode, shadowRoot );
			assert.equal( tabStrip.parentNode, browserChrome );
			assert.equal( toolbar.parentNode, browserChrome );
			assert.equal( browserTab.parentNode, tabStrip );
			assert.equal( browserAddress.parentNode, toolbar );
			assert.equal( browserViewport.previousElementSibling, browserChrome );
			assert.closeTo(
				browserWindow.getBoundingClientRect().width / browserWindow.getBoundingClientRect().height,
				16 / 10,
				0.01,
			);
			assert.isAtLeast( browserWindow.getBoundingClientRect().width, 320 );
			assert.equal( getComputedStyle( preview ).position, 'fixed' );
			assert.closeTo( preview.getBoundingClientRect().left, 16, 0.5 );
			assert.closeTo( window.innerHeight - preview.getBoundingClientRect().bottom, 16, 0.5 );
			const lightChromeColor = getComputedStyle( browserWindow ).backgroundColor;

			element.theme = ThemeMode.DARK;
			await element.updateComplete;
			assert.equal( getComputedStyle( browserWindow ).backgroundColor, lightChromeColor );
			await emulateMedia( { colorScheme: 'dark' } );
			assert.notEqual( getComputedStyle( browserWindow ).backgroundColor, lightChromeColor );
			assert.isAtMost(
				preview.getBoundingClientRect().right,
				setupCard.getBoundingClientRect().left,
			);

			for ( const width of [ 1_024, 1_152, 1_280 ] ) {
				await setViewport( { height: 1_000, width } );
				assert.isAtMost(
					preview.getBoundingClientRect().right,
					setupCard.getBoundingClientRect().left,
				);
			}

			await setViewport( { height: 1_600, width: 420 } );

			assert.equal( getComputedStyle( preview ).position, 'fixed' );
			assert.closeTo( preview.getBoundingClientRect().left, 16, 0.5 );
			assert.closeTo( window.innerHeight - preview.getBoundingClientRect().bottom, 16, 0.5 );
			assert.isAtMost(
				setupCard.getBoundingClientRect().bottom,
				preview.getBoundingClientRect().top,
			);

			await emulateMedia( { colorScheme: 'light', forcedColors: 'active' } );
			assert.equal( getComputedStyle( browserAddress ).borderTopStyle, 'solid' );
			assert.notEqual(
				getComputedStyle( addressPlaceholder ).backgroundColor,
				getComputedStyle( toolbar ).backgroundColor,
			);
			assert.notEqual(
				getComputedStyle( windowControls, '::before' ).backgroundColor,
				getComputedStyle( tabStrip ).backgroundColor,
			);
		} finally {
			await setViewport( { height: 600, width: 800 } );
			await emulateMedia( { colorScheme: 'light', forcedColors: 'none' } );
		}
	} );

	it( 'keeps every scrolled appearance control clear of the fixed preview on compact viewports', async () => {
		await setViewport( { height: 900, width: 420 } );
		await emulateMedia( { colorScheme: 'light', forcedColors: 'none' } );

		try {
			const editor = new MemoryOnboardingPreferencesEditor();
			const element = await renderShell( editor );
			const shadowRoot = getShadowRoot( element );
			const languageStep = shadowRoot.querySelector( 'tocus-f-onboarding-language-step' );

			assert.instanceOf( languageStep, HTMLElement );
			languageStep.dispatchEvent( new CustomEvent( 'tocus-onboarding-language-continue', {
				bubbles: true,
				composed: true,
				detail: { language: Language.ENGLISH },
			} ) );
			await settle();
			await element.updateComplete;

			const preview = shadowRoot.querySelector( '.pause-preview' );
			const main = shadowRoot.querySelector( 'main' );
			const appearanceStep = shadowRoot.querySelector( 'tocus-f-onboarding-appearance-step' );

			assert.instanceOf( preview, HTMLElement );
			assert.instanceOf( main, HTMLElement );
			assert.instanceOf( appearanceStep, HTMLElement );
			const continueButton = appearanceStep.shadowRoot?.querySelector( 'button[type="submit"]' );

			assert.instanceOf( continueButton, HTMLButtonElement );
			for ( const viewport of [
				{ height: 900, width: 420 },
				{ height: 800, width: 420 },
				{ height: 420, width: 800 },
			] ) {
				await setViewport( viewport );
				assert.equal( getComputedStyle( preview ).position, 'fixed' );
				assert.closeTo( window.innerHeight - preview.getBoundingClientRect().bottom, 16, 0.5 );
				assert.isAtLeast( main.clientHeight, 100 );

				for ( const progress of [ 0, 0.5, 1 ] ) {
					main.scrollTop = ( main.scrollHeight - main.clientHeight ) * progress;
					const mainBounds: DOMRect = main.getBoundingClientRect();
					const previewBounds = preview.getBoundingClientRect();

					assert.isTrue( mainBounds.bottom <= previewBounds.top || mainBounds.left >= previewBounds.right );
				}

				const mainBounds = main.getBoundingClientRect();
				const buttonBounds = continueButton.getBoundingClientRect();

				assert.isAtLeast( buttonBounds.top, mainBounds.top );
				assert.isAtMost( buttonBounds.bottom, mainBounds.bottom );
			}

			await setViewport( { height: 256, width: 320 } );
			const setupCard = shadowRoot.querySelector( '.setup-card' );

			assert.instanceOf( setupCard, HTMLElement );
			assert.equal( getComputedStyle( preview ).position, 'absolute' );
			assert.isAtMost( setupCard.getBoundingClientRect().bottom, preview.getBoundingClientRect().top );
		} finally {
			await setViewport( { height: 600, width: 800 } );
			await emulateMedia( { colorScheme: 'light', forcedColors: 'none' } );
		}
	} );

	it( 'keeps the narrow preview countdown on one line and clear of the breathing sphere', async () => {
		await setViewport( { height: 1_600, width: 420 } );

		try {
			const editor = new MemoryOnboardingPreferencesEditor();
			const element = await renderShell( editor );
			const shadowRoot = getShadowRoot( element );
			const languageStep = shadowRoot.querySelector( 'tocus-f-onboarding-language-step' );

			assert.instanceOf( languageStep, HTMLElement );
			languageStep.dispatchEvent( new CustomEvent( 'tocus-onboarding-language-continue', {
				bubbles: true,
				composed: true,
				detail: { language: Language.ENGLISH },
			} ) );
			await settle();
			await element.updateComplete;

			const preview = shadowRoot.querySelector( 'tocus-f-interruption-screen' );

			assert.instanceOf( preview, HTMLElement );
			await preview.updateComplete;
			const previewRoot = preview.shadowRoot;

			assert.instanceOf( previewRoot, ShadowRoot );
			const remaining = previewRoot.querySelector( '.remaining' );
			const cue = previewRoot.querySelector( '.cue' );
			const sphere = previewRoot.querySelector( '.sphere-shell' );

			assert.instanceOf( remaining, HTMLElement );
			assert.instanceOf( cue, HTMLElement );
			assert.instanceOf( sphere, HTMLElement );
			assert.isAtMost(
				cue.getBoundingClientRect().bottom,
				sphere.getBoundingClientRect().top,
			);
			const remainingRange = document.createRange();

			remainingRange.selectNodeContents( remaining );
			assert.lengthOf( remainingRange.getClientRects(), 1 );
		} finally {
			await setViewport( { height: 600, width: 800 } );
		}
	} );

	it( 'keeps Appearance visible when its editor is unavailable', async () => {
		const editor = new MemoryOnboardingPreferencesEditor();
		const element = await renderShell( editor );
		const shadowRoot = getShadowRoot( element );
		const languageStep = shadowRoot.querySelector( 'tocus-f-onboarding-language-step' );

		assert.instanceOf( languageStep, HTMLElement );
		languageStep.dispatchEvent( new CustomEvent( 'tocus-onboarding-language-continue', {
			bubbles: true,
			composed: true,
			detail: { language: Language.ENGLISH },
		} ) );
		await settle();
		await element.updateComplete;
		element.editor = null;
		const appearanceStep = shadowRoot.querySelector( 'tocus-f-onboarding-appearance-step' );

		assert.instanceOf( appearanceStep, HTMLElement );
		appearanceStep.dispatchEvent( new CustomEvent( 'tocus-onboarding-appearance-continue', {
			bubbles: true,
			composed: true,
			detail: {
				theme: ThemeMode.SYSTEM,
				palette: Palette.BROWN,
			},
		} ) );
		await settle();
		await element.updateComplete;

		assert.instanceOf( shadowRoot.querySelector( 'tocus-f-onboarding-appearance-step' ), HTMLElement );
		assert.equal( appearanceStep.errorMessage, TEST_COPY.preferenceSaveError );
	} );

	it( 'keeps Appearance visible when persistence returns no preferences', async () => {
		const editor = new MemoryOnboardingPreferencesEditor();
		const element = await renderShell( editor );
		const shadowRoot = getShadowRoot( element );
		const languageStep = shadowRoot.querySelector( 'tocus-f-onboarding-language-step' );

		assert.instanceOf( languageStep, HTMLElement );
		languageStep.dispatchEvent( new CustomEvent( 'tocus-onboarding-language-continue', {
			bubbles: true,
			composed: true,
			detail: { language: Language.ENGLISH },
		} ) );
		await settle();
		await element.updateComplete;
		editor.updateResult = null;
		const appearanceStep = shadowRoot.querySelector( 'tocus-f-onboarding-appearance-step' );

		assert.instanceOf( appearanceStep, HTMLElement );
		appearanceStep.dispatchEvent( new CustomEvent( 'tocus-onboarding-appearance-continue', {
			bubbles: true,
			composed: true,
			detail: {
				theme: ThemeMode.DARK,
				palette: Palette.GREEN,
			},
		} ) );
		await settle();
		await element.updateComplete;

		assert.instanceOf( shadowRoot.querySelector( 'tocus-f-onboarding-appearance-step' ), HTMLElement );
		assert.equal( appearanceStep.errorMessage, TEST_COPY.preferenceSaveError );
	} );

	it( 'keeps Appearance visible when preference persistence rejects', async () => {
		const editor = new MemoryOnboardingPreferencesEditor();
		const element = await renderShell( editor );
		const shadowRoot = getShadowRoot( element );
		const languageStep = shadowRoot.querySelector( 'tocus-f-onboarding-language-step' );

		assert.instanceOf( languageStep, HTMLElement );
		languageStep.dispatchEvent( new CustomEvent( 'tocus-onboarding-language-continue', {
			bubbles: true,
			composed: true,
			detail: { language: Language.ENGLISH },
		} ) );
		await settle();
		await element.updateComplete;
		editor.failUpdates = true;
		const appearanceStep = shadowRoot.querySelector( 'tocus-f-onboarding-appearance-step' );

		assert.instanceOf( appearanceStep, HTMLElement );
		appearanceStep.dispatchEvent( new CustomEvent( 'tocus-onboarding-appearance-continue', {
			bubbles: true,
			composed: true,
			detail: {
				theme: ThemeMode.DARK,
				palette: Palette.GREEN,
			},
		} ) );
		await settle();
		await element.updateComplete;

		assert.instanceOf( shadowRoot.querySelector( 'tocus-f-onboarding-appearance-step' ), HTMLElement );
		assert.equal( appearanceStep.errorMessage, TEST_COPY.preferenceSaveError );
	} );

	it( 'emits completion from the final step even when no new site was added', async () => {
		const editor = new MemoryOnboardingPreferencesEditor();
		const element = await renderShell( editor );
		const shadowRoot = getShadowRoot( element );
		let completionCount = 0;

		element.addEventListener( OnboardingCompleteEventName, () => {
			completionCount += 1;
		} );
		const languageStep = shadowRoot.querySelector( 'tocus-f-onboarding-language-step' );

		assert.instanceOf( languageStep, HTMLElement );
		languageStep.dispatchEvent( new CustomEvent( 'tocus-onboarding-language-continue', {
			bubbles: true,
			composed: true,
			detail: { language: Language.ENGLISH },
		} ) );
		await settle();
		const appearanceStep = shadowRoot.querySelector( 'tocus-f-onboarding-appearance-step' );

		assert.instanceOf( appearanceStep, HTMLElement );
		appearanceStep.dispatchEvent( new CustomEvent( 'tocus-onboarding-appearance-continue', {
			bubbles: true,
			composed: true,
			detail: {
				theme: ThemeMode.SYSTEM,
				palette: Palette.BROWN,
			},
		} ) );
		await settle();
		const sitesStep = shadowRoot.querySelector( 'tocus-f-onboarding-sites-step' );

		assert.instanceOf( sitesStep, HTMLElement );
		sitesStep.dispatchEvent( new Event( 'tocus-onboarding-sites-finish', { bubbles: true, composed: true } ) );
		await element.updateComplete;

		assert.equal( completionCount, 1 );
		assert.include( shadowRoot.querySelector( '.completion' )?.textContent, TEST_COPY.completionTitle );
		assert.instanceOf( shadowRoot.querySelector( '.completion__mark svg' ), SVGElement );
		assert.equal(
			shadowRoot.querySelector( '.completion__mark svg' )?.getAttribute( 'viewBox' ),
			'0 0 640 640',
		);
		assert.equal( shadowRoot.querySelector( 'tocus-f-interruption-screen' ), null );
	} );

	it( 'offers Settings from the visible completion fallback', async () => {
		const editor = new MemoryOnboardingPreferencesEditor();
		const element = await renderShell( editor );
		const shadowRoot = getShadowRoot( element );
		let openSettingsCount = 0;

		element.addEventListener( OnboardingOpenSettingsEventName, () => {
			openSettingsCount += 1;
		} );
		const languageStep = shadowRoot.querySelector( 'tocus-f-onboarding-language-step' );

		assert.instanceOf( languageStep, HTMLElement );
		languageStep.dispatchEvent( new CustomEvent( 'tocus-onboarding-language-continue', {
			bubbles: true,
			composed: true,
			detail: { language: Language.ENGLISH },
		} ) );
		await settle();
		const appearanceStep = shadowRoot.querySelector( 'tocus-f-onboarding-appearance-step' );

		assert.instanceOf( appearanceStep, HTMLElement );
		appearanceStep.dispatchEvent( new CustomEvent( 'tocus-onboarding-appearance-continue', {
			bubbles: true,
			composed: true,
			detail: {
				theme: ThemeMode.SYSTEM,
				palette: Palette.BROWN,
			},
		} ) );
		await settle();
		const sitesStep = shadowRoot.querySelector( 'tocus-f-onboarding-sites-step' );

		assert.instanceOf( sitesStep, HTMLElement );
		sitesStep.dispatchEvent( new Event( 'tocus-onboarding-sites-finish', { bubbles: true, composed: true } ) );
		await element.updateComplete;
		const openSettingsButton = shadowRoot.querySelector( '.completion__settings' );

		assert.instanceOf( openSettingsButton, HTMLButtonElement );
		assert.equal( openSettingsButton.textContent.trim(), TEST_COPY.openSettingsLabel );
		openSettingsButton.click();

		assert.equal( openSettingsCount, 1 );
		await expect( element ).to.be.accessible();
	} );
} );
