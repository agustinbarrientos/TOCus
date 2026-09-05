import { assert, expect, fixture, html } from '@open-wc/testing';
import {
	Palette,
	ThemeMode,
	type Palette as PaletteValue,
	type ThemeMode as ThemeModeValue,
} from '../../../../domains/preferences/types';
import { ComponentAppearanceControls } from '../../../preferences/components/appearance-controls';
import {
	ComponentOnboardingAppearanceStep,
	OnboardingAppearanceContinueEventName,
	OnboardingAppearanceSelectEventName,
} from './index';
import {
	type OnboardingAppearanceEventDetail,
	type OnboardingAppearanceStepCopy,
} from './types';

/**
 * Complete English copy used by the Appearance-step component tests.
 * @since 0.1.0 Initial implementation.
 */
const TEST_COPY: Readonly<OnboardingAppearanceStepCopy> = {
	title: 'Make it yours',
	introduction: 'Choose the appearance and color that feel most comfortable.',
	themeLegend: 'Appearance',
	themeOptions: {
		system: {
			label: 'System',
			description: 'Follow your device appearance.',
		},
		light: {
			label: 'Light',
			description: 'Use a light appearance.',
		},
		dark: {
			label: 'Dark',
			description: 'Use a dark appearance.',
		},
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
};

/**
 * Renders one ready Appearance step.
 * @param theme - Appearance mode initially selected.
 * @param palette - Full-scene color palette initially selected.
 * @return Connected Appearance-step component.
 * @since 0.1.0 Initial implementation.
 */
async function renderAppearanceStep(
	theme: ThemeModeValue = ThemeMode.SYSTEM,
	palette: PaletteValue = Palette.BROWN,
): Promise<ComponentOnboardingAppearanceStep> {
	return fixture<ComponentOnboardingAppearanceStep>( html`
		<tocus-f-onboarding-appearance-step
			.copy=${ TEST_COPY }
			.theme=${ theme }
			.palette=${ palette }
		></tocus-f-onboarding-appearance-step>
	` );
}

/**
 * Returns the connected component shadow root.
 * @param element - Appearance-step component under test.
 * @return Component shadow root.
 * @since 0.1.0 Initial implementation.
 */
function getShadowRoot( element: ComponentOnboardingAppearanceStep ): ShadowRoot {
	const shadowRoot = element.shadowRoot;

	assert.instanceOf( shadowRoot, ShadowRoot );
	if ( ! ( shadowRoot instanceof ShadowRoot ) ) {
		throw new TypeError( 'Expected the Appearance step to render a shadow root.' );
	}

	return shadowRoot;
}

/**
 * Returns the shared appearance controls rendered by the onboarding step.
 * @param element - Appearance-step component under test.
 * @return Connected shared appearance controls.
 * @since 0.1.0 Initial implementation.
 */
function getAppearanceControls(
	element: ComponentOnboardingAppearanceStep,
): ComponentAppearanceControls {
	const controls = getShadowRoot( element ).querySelector( 'tocus-f-appearance-controls' );

	assert.instanceOf( controls, ComponentAppearanceControls );
	if ( ! ( controls instanceof ComponentAppearanceControls ) ) {
		throw new TypeError( 'Expected the Appearance step to render shared appearance controls.' );
	}

	return controls;
}

/**
 * Returns the shared appearance-controls shadow root.
 * @param element - Appearance-step component under test.
 * @return Shared appearance-controls shadow root.
 * @since 0.1.0 Initial implementation.
 */
function getAppearanceControlsRoot( element: ComponentOnboardingAppearanceStep ): ShadowRoot {
	const shadowRoot = getAppearanceControls( element ).shadowRoot;

	assert.instanceOf( shadowRoot, ShadowRoot );
	if ( ! ( shadowRoot instanceof ShadowRoot ) ) {
		throw new TypeError( 'Expected the shared appearance controls to render a shadow root.' );
	}

	return shadowRoot;
}

/**
 * Waits for one typed Appearance-step event.
 * @param element - Component expected to emit the event.
 * @param eventName - Stable Appearance-step event name.
 * @return Next matching custom event.
 * @since 0.1.0 Initial implementation.
 */
function waitForAppearanceEvent(
	element: ComponentOnboardingAppearanceStep,
	eventName: string,
): Promise<CustomEvent<OnboardingAppearanceEventDetail>> {
	return new Promise( ( resolve ) => {
		element.addEventListener( eventName, ( event ) => {
			if ( event instanceof CustomEvent ) {
				resolve( event );
			}
		}, { once: true } );
	} );
}

describe( 'tocus-f-onboarding-appearance-step', () => {
	it( 'renders nothing until localized copy is supplied', async () => {
		const element = await fixture<ComponentOnboardingAppearanceStep>( html`
			<tocus-f-onboarding-appearance-step></tocus-f-onboarding-appearance-step>
		` );

		assert.equal( getShadowRoot( element ).childElementCount, 0 );
	} );

	it( 'uses the shared appearance controls without exposing pause settings', async () => {
		const element = await renderAppearanceStep(
			ThemeMode.LIGHT,
			Palette.PURPLE,
		);
		const controls = getAppearanceControls( element );
		const controlsRoot = getAppearanceControlsRoot( element );

		assert.equal( customElements.get( 'tocus-f-onboarding-appearance-step' ), ComponentOnboardingAppearanceStep );
		assert.instanceOf( controls, ComponentAppearanceControls );
		assert.equal( controlsRoot.querySelector( 'input[name="pause-mode"]' ), null );
		assert.equal( controlsRoot.querySelector( 'input[name="reduced-motion"]' ), null );
		assert.deepEqual(
			[ ...controlsRoot.querySelectorAll<HTMLInputElement>( 'input[name="theme"]' ) ]
				.map( ( input ) => input.value ),
			[ ThemeMode.LIGHT, ThemeMode.DARK, ThemeMode.SYSTEM ],
		);
		assert.lengthOf( controlsRoot.querySelectorAll( 'input[name="palette"]' ), 6 );
		assert.equal( element.getAttribute( 'data-tocus-theme' ), ThemeMode.LIGHT );
		assert.equal( element.getAttribute( 'data-tocus-palette' ), Palette.PURPLE );
		await expect( element ).to.be.accessible();
	} );

	it( 'emits only theme and color when appearance values change', async () => {
		const element = await renderAppearanceStep();
		const shadowRoot = getAppearanceControlsRoot( element );
		const darkEventPromise = waitForAppearanceEvent(
			element,
			OnboardingAppearanceSelectEventName,
		);
		const dark = shadowRoot.querySelector<HTMLInputElement>( 'input[value="dark"]' );

		assert.instanceOf( dark, HTMLInputElement );
		dark.click();
		const darkEvent = await darkEventPromise;

		assert.deepEqual( darkEvent.detail, {
			theme: ThemeMode.DARK,
			palette: Palette.BROWN,
		} );

		const greenEventPromise = waitForAppearanceEvent(
			element,
			OnboardingAppearanceSelectEventName,
		);
		const green = shadowRoot.querySelector<HTMLInputElement>( 'input[value="green"]' );

		assert.instanceOf( green, HTMLInputElement );
		green.click();
		const greenEvent = await greenEventPromise;

		assert.deepEqual( greenEvent.detail, {
			theme: ThemeMode.DARK,
			palette: Palette.GREEN,
		} );
	} );

	it( 'ignores unchecked, pending, and unsupported appearance controls', async () => {
		const element = await renderAppearanceStep();
		const controls = getAppearanceControls( element );
		const shadowRoot = getAppearanceControlsRoot( element );
		const dark = shadowRoot.querySelector<HTMLInputElement>( 'input[value="dark"]' );
		let selectionCount = 0;

		element.addEventListener( OnboardingAppearanceSelectEventName, () => {
			selectionCount += 1;
		} );
		assert.instanceOf( dark, HTMLInputElement );

		dark.checked = false;
		dark.dispatchEvent( new Event( 'change', { bubbles: true } ) );
		element.pending = true;
		await element.updateComplete;
		await controls.updateComplete;
		dark.checked = true;
		dark.dispatchEvent( new Event( 'change', { bubbles: true } ) );

		element.pending = false;
		await element.updateComplete;
		dark.value = 'sepia';
		dark.dispatchEvent( new Event( 'change', { bubbles: true } ) );
		dark.name = 'palette';
		dark.dispatchEvent( new Event( 'change', { bubbles: true } ) );
		dark.name = 'unsupported';
		dark.value = ThemeMode.DARK;
		dark.dispatchEvent( new Event( 'change', { bubbles: true } ) );

		assert.equal( selectionCount, 0 );
		assert.equal( element.theme, ThemeMode.SYSTEM );
	} );

	it( 'emits all selected values when Continue is requested', async () => {
		const element = await renderAppearanceStep(
			ThemeMode.LIGHT,
			Palette.ORANGE,
		);
		const shadowRoot = getShadowRoot( element );
		const eventPromise = waitForAppearanceEvent(
			element,
			OnboardingAppearanceContinueEventName,
		);
		const continueButton = shadowRoot.querySelector( '.continue-action' );

		assert.instanceOf( continueButton, HTMLButtonElement );
		continueButton.click();
		const event = await eventPromise;

		assert.deepEqual( event.detail, {
			theme: ThemeMode.LIGHT,
			palette: Palette.ORANGE,
		} );
	} );
} );
