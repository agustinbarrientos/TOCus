import { assert, expect, fixture, html } from '@open-wc/testing';
import { sendKeys, setViewport } from '@web/test-runner-commands';
import { LitElement } from 'lit';
import { DefaultPreferencesDocument, Language, Palette, PreferencesDocumentSchema, ThemeMode, type PreferencesDocument } from '../../../../domains/preferences/types';
import { PreferencesUpdateSchema, type PreferencesEditor } from '../../../../domains/preferences/services/preferences-editor';
import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import {
	ProtectedSiteEnrollmentStatus,
	type ProtectedSiteBatchEnrollmentResult,
} from '../../../protected-sites/services/protected-site-enrollment';
import { OnboardingSiteSuggestions } from '../../utils/site-suggestion-catalog';
import { ComponentOnboardingShell } from './index';
import './index';

/**
 * Creates a complete in-memory preference editor for step navigation.
 * @return Editor that retains each validated selection.
 * @since 0.1.0 Initial implementation.
 */
function createEditor(): PreferencesEditor {
	let preferences: PreferencesDocument = { ...DefaultPreferencesDocument };

	return {
		/**
		 * Reads the current preferences.
		 * @return Current in-memory preferences.
		 * @since 0.1.0 Initial implementation.
		 */
		load: () => Promise.resolve( preferences ),
		/**
		 * Applies the selected preferences.
		 * @param input - Preference update to validate.
		 * @return Updated in-memory preferences.
		 * @since 0.1.0 Initial implementation.
		 */
		update: ( input ) => {
			preferences = PreferencesDocumentSchema.parse( {
				...preferences,
				...PreferencesUpdateSchema.parse( input ),
			} );
			return Promise.resolve( preferences );
		},
		/**
		 * Restores default preferences.
		 * @return Default preferences.
		 * @since 0.1.0 Initial implementation.
		 */
		restoreDefaults: () => Promise.resolve( DefaultPreferencesDocument ),
	};
}

/**
 * Renders the real onboarding steps with an in-memory persistence boundary.
 * @return Connected onboarding shell.
 * @since 0.1.0 Initial implementation.
 */
async function renderShell(): Promise<ComponentOnboardingShell> {
	return fixture<ComponentOnboardingShell>( html`
		<tocus-f-onboarding-shell
			.copy=${ TestEnglishLocalizationBundle.onboarding }
			.interruptionCopy=${ TestEnglishLocalizationBundle.interruption }
			.editor=${ createEditor() }
			.synchronizeLanguage=${ () => Promise.resolve( true ) }
			.suggestions=${ OnboardingSiteSuggestions }
			.reducedMotion=${ true }
		></tocus-f-onboarding-shell>
	` );
}

/**
 * Finds one required element inside a component.
 * @param element - Component owning the shadow root.
 * @param selector - Required control selector.
 * @return Connected matching element.
 * @since 0.1.0 Initial implementation.
 */
function control( element: LitElement, selector: string ): HTMLElement {
	const target = element.shadowRoot?.querySelector( selector );
	assert.instanceOf( target, HTMLElement, selector );
	return target;
}

/**
 * Finds the only mounted onboarding step.
 * @param shell - Onboarding shell being navigated.
 * @return Active child step.
 * @since 0.1.0 Initial implementation.
 */
function activeStep( shell: ComponentOnboardingShell ): LitElement {
	const step = control( shell, '[data-onboarding-step]' );
	assert.instanceOf( step, LitElement );
	return step;
}

/**
 * Waits for asynchronous persistence and child rendering.
 * @param shell - Onboarding shell being navigated.
 * @return Promise resolved after rendering settles.
 * @since 0.1.0 Initial implementation.
 */
async function settle( shell: ComponentOnboardingShell ): Promise<void> {
	await new Promise<void>( ( resolve ) => {
		setTimeout( resolve, 0 );
	} );
	await shell.updateComplete;
	await activeStep( shell ).updateComplete;
}

/**
 * Continues the current step through its real submit button.
 * @param shell - Onboarding shell being navigated.
 * @return Promise resolved after the next step renders.
 * @since 0.1.0 Initial implementation.
 */
async function continueStep( shell: ComponentOnboardingShell ): Promise<void> {
	control( activeStep( shell ), '.continue-action' ).click();
	await settle( shell );
}

describe( 'tocus-f-onboarding-shell navigation', () => {
	afterEach( async () => {
		await setViewport( { width: 800, height: 600 } );
	} );

	it( 'names each step when the narrow layout hides its visible label', async () => {
		await setViewport( { width: 420, height: 1_400 } );
		const shell = await renderShell();
		await continueStep( shell );
		await expect( shell ).to.be.accessible();
	} );

	it( 'preserves unsaved appearance when language persistence reapplies stored preferences', async () => {
		const shell = await renderShell();
		const editor = createEditor();
		shell.editor = {
			...editor,
			/**
			 * Reapplies persisted preferences through the page binding.
			 * @param input - Update submitted by the active step.
			 * @return Persisted preferences.
			 * @since 0.1.0 Initial implementation.
			 */
			update: async ( input ) => {
				const preferences = await editor.update( input );
				assert.isNotNull( preferences );
				shell.theme = preferences.theme;
				shell.palette = preferences.palette;
				return preferences;
			},
		};
		await continueStep( shell );
		const appearance = activeStep( shell );
		appearance.dispatchEvent( new CustomEvent( 'tocus-onboarding-appearance-select', {
			bubbles: true,
			composed: true,
			detail: { theme: ThemeMode.DARK, palette: Palette.GREEN },
		} ) );
		await shell.updateComplete;
		control( shell, '.progress li:first-child button' ).click();
		await settle( shell );
		await continueStep( shell );
		assert.equal( shell.theme, ThemeMode.DARK );
		assert.equal( shell.palette, Palette.GREEN );
	} );

	it( 'prevents skipping unvisited steps and returns to Language with the keyboard', async () => {
		const shell = await renderShell();
		const next = control( shell, '.progress li:nth-child(2) button' );
		assert.instanceOf( next, HTMLButtonElement );
		assert.isTrue( next.disabled );
		next.click();
		next.dispatchEvent( new MouseEvent( 'click' ) );
		assert.equal( activeStep( shell ).localName, 'tocus-f-onboarding-language-step' );

		shell.language = Language.SPANISH_VOS;
		await shell.updateComplete;
		await activeStep( shell ).updateComplete;
		await continueStep( shell );
		const back = control( shell, '.progress li:first-child button' );
		assert.instanceOf( back, HTMLButtonElement );
		assert.isFalse( back.disabled );
		assert.instanceOf( back.querySelector( 'svg' ), SVGElement );
		back.focus();
		await sendKeys( { press: 'Enter' } );
		await settle( shell );

		assert.equal( activeStep( shell ).localName, 'tocus-f-onboarding-language-step' );
		assert.equal( shell.language, Language.SPANISH_VOS );
		assert.equal( activeStep( shell ).shadowRoot?.activeElement?.tagName, 'H1' );
		assert.instanceOf( control( shell, '.progress li:first-child button' ).querySelector( 'svg' ), SVGElement );
		await expect( shell ).to.be.accessible();
	} );

	it( 'preserves selected websites and an unfinished address across earlier steps', async () => {
		const shell = await renderShell();
		await continueStep( shell );
		shell.theme = ThemeMode.DARK;
		shell.palette = Palette.GREEN;
		await shell.updateComplete;
		await activeStep( shell ).updateComplete;
		await continueStep( shell );
		const sites = activeStep( shell );
		control( sites, '[data-site-id="youtube"]' ).click();
		const address = control( sites, '#onboarding-site-address' );
		assert.instanceOf( address, HTMLInputElement );
		address.value = 'github.com';
		address.dispatchEvent( new Event( 'input', { bubbles: true } ) );
		await sites.updateComplete;
		assert.equal( sites.shadowRoot?.querySelectorAll( '.added-site' ).length, 1 );

		control( shell, '.progress li:first-child button' ).click();
		await settle( shell );
		assert.isFalse( sites.isConnected );
		assert.lengthOf( shell.shadowRoot?.querySelectorAll( '.progress .complete' ) ?? [], 2 );
		await continueStep( shell );
		assert.equal( shell.theme, ThemeMode.DARK );
		assert.equal( shell.palette, Palette.GREEN );
		await continueStep( shell );

		assert.equal( activeStep( shell ), sites );
		assert.equal( control( sites, '[data-site-id="youtube"]' ).getAttribute( 'aria-pressed' ), 'true' );
		assert.equal( address.value, 'github.com' );
		assert.lengthOf( sites.shadowRoot?.querySelectorAll( '.added-site' ) ?? [], 1 );
	} );

	it( 'disables earlier steps while appearance preferences are saving', async () => {
		const shell = await renderShell();
		await continueStep( shell );
		const pending = Promise.withResolvers<Awaited<ReturnType<PreferencesEditor[ 'update' ]>>>();
		shell.editor = {
			...createEditor(),
			/**
			 * Defers preference persistence until the test settles it.
			 * @return Pending preference update result.
			 * @since 0.1.0 Initial implementation.
			 */
			update: () => pending.promise,
		};
		await shell.updateComplete;
		control( activeStep( shell ), '.continue-action' ).click();
		const back = control( shell, '.progress li:first-child button' );
		back.dispatchEvent( new MouseEvent( 'click' ) );
		await shell.updateComplete;
		assert.instanceOf( back, HTMLButtonElement );
		assert.isTrue( back.disabled );
		assert.equal( activeStep( shell ).localName, 'tocus-f-onboarding-appearance-step' );
		pending.resolve( null );
		await settle( shell );
		assert.isFalse( back.disabled );
		back.click();
		await settle( shell );
		assert.equal( activeStep( shell ).localName, 'tocus-f-onboarding-language-step' );
	} );

	it( 'keeps the sites step mounted while browser permission is pending and unlocks after denial', async () => {
		const shell = await renderShell();
		const pending = Promise.withResolvers<ProtectedSiteBatchEnrollmentResult>();
		shell.enrollment = {
			/**
			 * Rejects unexpected single-site permission requests.
			 * @since 0.1.0 Initial implementation.
			 */
			add: () => {
				throw new Error( 'Unexpected single-site enrollment.' );
			},
			/**
			 * Defers the browser enrollment outcome.
			 * @return Pending batch enrollment result.
			 * @since 0.1.0 Initial implementation.
			 */
			addMany: () => pending.promise,
			/**
			 * Rejects unexpected removal requests.
			 * @since 0.1.0 Initial implementation.
			 */
			remove: () => {
				throw new Error( 'Unexpected site removal.' );
			},
		};
		await continueStep( shell );
		await continueStep( shell );
		const sites = activeStep( shell );
		control( sites, '[data-site-id="youtube"]' ).click();
		await sites.updateComplete;
		control( sites, '.finish-action' ).click();
		const back = control( shell, '.progress li:first-child button' );
		back.dispatchEvent( new MouseEvent( 'click' ) );
		await shell.updateComplete;
		assert.instanceOf( back, HTMLButtonElement );
		assert.isTrue( back.disabled );
		assert.equal( activeStep( shell ), sites );
		pending.resolve( { status: ProtectedSiteEnrollmentStatus.PERMISSION_DENIED } );
		await settle( shell );
		assert.isFalse( back.disabled );
		assert.equal( control( sites, '[data-site-id="youtube"]' ).getAttribute( 'aria-pressed' ), 'true' );
		back.focus();
		await sendKeys( { press: 'Space' } );
		await settle( shell );
		assert.equal( activeStep( shell ).localName, 'tocus-f-onboarding-language-step' );
	} );
} );
