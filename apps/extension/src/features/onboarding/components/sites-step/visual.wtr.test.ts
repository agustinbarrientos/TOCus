import { assert, fixture, html } from '@open-wc/testing';
import { emulateMedia, setViewport } from '@web/test-runner-commands';
import { visualDiff } from '@web/test-runner-visual-regression';
import {
	Palette,
	ThemeMode,
	type Palette as PaletteValue,
	type ThemeMode as ThemeModeValue,
} from '../../../../domains/preferences/types';
import {
	ProtectionConfigurationEditRejectionReason,
} from '../../../../domains/protection/services/protection-configuration-editor';
import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import {
	ProtectedSiteEnrollmentStatus,
	type ProtectedSiteEnrollmentResult,
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
			.protectedRuleHosts=${ [ 'instagram.com', 'reddit.com' ] }
			.suggestions=${ OnboardingSiteSuggestions }
		></tocus-f-onboarding-sites-step>
	` );

	await element.updateComplete;
	await Promise.all( Array.from(
		element.shadowRoot?.querySelectorAll<HTMLImageElement>( '.suggestion img' ) ?? [],
		( image ) => image.decode(),
	) );

	return element;
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
} );
