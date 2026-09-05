import { assert, fixture, html } from '@open-wc/testing';
import { emulateMedia, setViewport } from '@web/test-runner-commands';
import { visualDiff } from '@web/test-runner-visual-regression';
import {
	Palette,
	Language,
	ThemeMode,
	type Language as LanguageValue,
	type Palette as PaletteValue,
	type ThemeMode as ThemeModeValue,
} from '../../../../domains/preferences/types';
import {
	ProtectionConfigurationEditRejectionReason,
} from '../../../../domains/protection/services/protection-configuration-editor';
import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import { loadLocalizationBundle } from '../../../../localization';
import {
	ProtectedSiteEnrollmentStatus,
	type ProtectedSiteEnrollmentResult,
	type ProtectedSiteBatchEnrollmentResult,
	type ProtectedSiteEnrollmentService,
	type ProtectedSiteRemovalResult,
} from '../../../protected-sites/services/protected-site-enrollment';
import { OnboardingSiteSuggestions } from '../../utils/site-suggestion-catalog';
import './index';
import { type ComponentOnboardingSitesStep } from './index';

/**
 * Inert enrollment boundary used by screenshots that never invoke site actions.
 * @since 0.1.0 Initial implementation.
 */
class IdleVisualEnrollmentService implements ProtectedSiteEnrollmentService {
	/**
	 * Returns a deterministic denial for the visible retry state.
	 * @return Stable permission-denied result.
	 * @since 0.1.0 Initial implementation.
	 */
	addMany(): Promise<ProtectedSiteBatchEnrollmentResult> {
		return Promise.resolve( { status: ProtectedSiteEnrollmentStatus.PERMISSION_DENIED } );
	}

	/**
	 * Returns a stable unused result if a visual fixture unexpectedly invokes enrollment.
	 * @return Stable permission-denied result.
	 * @since 0.1.0 Initial implementation.
	 */
	add(): Promise<ProtectedSiteEnrollmentResult> {
		return Promise.resolve( { status: ProtectedSiteEnrollmentStatus.PERMISSION_DENIED } );
	}

	/**
	 * Returns a stable unused result if a visual fixture unexpectedly invokes removal.
	 * @return Stable site-not-found result.
	 * @since 0.1.0 Initial implementation.
	 */
	remove(): Promise<ProtectedSiteRemovalResult> {
		return Promise.resolve( {
			status: ProtectedSiteEnrollmentStatus.REJECTED,
			reason: ProtectionConfigurationEditRejectionReason.SITE_NOT_FOUND,
		} );
	}
}

/**
 * Renders a ready Sites step with deterministic local suggestions.
 * @param width - Explicit component width.
 * @return Connected and settled Sites step.
 * @since 0.1.0 Initial implementation.
 */
async function renderSitesStep( width: string ): Promise<ComponentOnboardingSitesStep> {
	const element = await fixture<ComponentOnboardingSitesStep>( html`
		<tocus-f-onboarding-sites-step
			style=${ `width: ${ width };` }
			.copy=${ TestEnglishLocalizationBundle.onboarding.sites }
			.enrollment=${ new IdleVisualEnrollmentService() }
			.suggestions=${ OnboardingSiteSuggestions }
		></tocus-f-onboarding-sites-step>
	` );

	await element.updateComplete;
	for ( const id of [ 'instagram', 'reddit' ] ) {
		element.shadowRoot?.querySelector<HTMLButtonElement>( `.suggestion[data-site-id="${ id }"]` )?.click();
		await element.updateComplete;
	}
	await Promise.all( Array.from(
		element.shadowRoot?.querySelectorAll<HTMLImageElement>( '.suggestion img' ) ?? [],
		( image ) => image.decode(),
	) );

	return element;
}

/**
 * Applies packaged Spanish copy and leaves an address ready to add.
 * @param element - Connected Sites step.
 * @param language - Exact supported Spanish variant.
 * @return Promise resolved after localization and form state settle.
 * @since 0.1.0 Initial implementation.
 */
async function prepareSpanishInput( element: ComponentOnboardingSitesStep, language: LanguageValue ): Promise<void> {
	const bundle = await loadLocalizationBundle( language );
	element.copy = bundle.onboarding.sites;
	const input = element.shadowRoot?.querySelector( '#onboarding-site-address' );
	assert.instanceOf( input, HTMLInputElement );
	input.value = 'example.com';
	input.dispatchEvent( new Event( 'input', { bubbles: true } ) );
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

describe( 'tocus-f-onboarding-sites-step visual', () => {
	before( async () => {
		const loadedFonts = await document.fonts.load( '600 2rem "Fredoka Variable"', 'Sites' );

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

	it( 'matches selected suggestions in the light brown appearance', async () => {
		await setViewport( { height: 1_400, width: 1_280 } );
		await configureAppearance( ThemeMode.LIGHT, Palette.BROWN );
		const element = await renderSitesStep( '62rem' );

		await visualDiff( element, 'onboarding-sites-step-brown-light' );
	} );

	it( 'matches the local suggestion grid in the narrow dark purple appearance', async () => {
		await setViewport( { height: 2_000, width: 420 } );
		await configureAppearance( ThemeMode.DARK, Palette.PURPLE );
		const element = await renderSitesStep( '100%' );

		await visualDiff( element, 'onboarding-sites-step-purple-dark-narrow' );
	} );

	it( 'matches the filled add action and selected list in Spanish vos', async () => {
		await setViewport( { height: 2_400, width: 420 } );
		await configureAppearance( ThemeMode.LIGHT, Palette.BROWN );
		const element = await renderSitesStep( '100%' );
		await prepareSpanishInput( element, Language.SPANISH_VOS );
		await visualDiff( element, 'onboarding-sites-step-spanish-vos-filled' );
	} );

	it( 'retains the selected list below a denied batch in Spanish tu', async () => {
		await setViewport( { height: 1_600, width: 1_280 } );
		await configureAppearance( ThemeMode.DARK, Palette.PURPLE );
		const element = await renderSitesStep( '62rem' );
		await prepareSpanishInput( element, Language.SPANISH_TU );
		const form = element.shadowRoot?.querySelector( '.manual-form' );
		assert.instanceOf( form, HTMLFormElement );
		form.dispatchEvent( new SubmitEvent( 'submit', { bubbles: true, cancelable: true } ) );
		await element.updateComplete;
		element.shadowRoot?.querySelector<HTMLButtonElement>( '.finish-action' )?.click();
		await new Promise<void>( ( resolve ) => {
			setTimeout( resolve, 0 );
		} );
		await element.updateComplete;
		await visualDiff( element, 'onboarding-sites-step-spanish-tu-denied' );
	} );
} );
