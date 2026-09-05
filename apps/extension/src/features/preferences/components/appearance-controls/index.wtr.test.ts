import { assert, expect, fixture, html } from '@open-wc/testing';
import {
	Palette,
	ThemeMode,
} from '../../../../domains/preferences/types';
import {
	AppearanceControlsChangeEventName,
	ComponentAppearanceControls,
} from './index';
import {
	type AppearanceControlsChangeDetail,
	type AppearanceControlsCopy,
} from './types';

/**
 * Complete English copy used by shared appearance-control tests.
 * @since 0.1.0 Initial implementation.
 */
const TEST_COPY: Readonly<AppearanceControlsCopy> = {
	themeLegend: 'Appearance',
	themeOptions: {
		light: { label: 'Light', description: 'Use a light appearance.' },
		dark: { label: 'Dark', description: 'Use a dark appearance.' },
		system: { label: 'System', description: 'Follow your device appearance.' },
	},
	paletteLegend: 'Color',
	paletteHelp: 'Choose a color for the whole scene.',
	paletteLabels: {
		brown: 'Brown',
		green: 'Green',
		blue: 'Blue',
		purple: 'Purple',
		pink: 'Pink',
		orange: 'Orange',
	},
};

/**
 * Renders ready shared appearance controls.
 * @return Connected shared appearance controls.
 * @since 0.1.0 Initial implementation.
 */
async function renderControls(): Promise<ComponentAppearanceControls> {
	return fixture<ComponentAppearanceControls>( html`
		<tocus-f-appearance-controls
			.copy=${ TEST_COPY }
			.theme=${ ThemeMode.DARK }
			.palette=${ Palette.PURPLE }
		></tocus-f-appearance-controls>
	` );
}

/**
 * Returns the connected component shadow root.
 * @param element - Shared appearance controls under test.
 * @return Component shadow root.
 * @since 0.1.0 Initial implementation.
 */
function getShadowRoot( element: ComponentAppearanceControls ): ShadowRoot {
	const shadowRoot = element.shadowRoot;

	assert.instanceOf( shadowRoot, ShadowRoot );
	if ( ! ( shadowRoot instanceof ShadowRoot ) ) {
		throw new TypeError( 'Expected shared appearance controls to render a shadow root.' );
	}

	return shadowRoot;
}

/**
 * Returns one required native input from the shared controls.
 * @param element - Shared appearance controls under test.
 * @param selector - Required input selector.
 * @return Matching native input.
 * @since 0.1.0 Initial implementation.
 */
function getInput(
	element: ComponentAppearanceControls,
	selector: string,
): HTMLInputElement {
	const input = getShadowRoot( element ).querySelector( selector );

	assert.instanceOf( input, HTMLInputElement );
	if ( ! ( input instanceof HTMLInputElement ) ) {
		throw new TypeError( `Expected shared appearance controls to render ${ selector }.` );
	}

	return input;
}

/**
 * Waits for the next shared appearance update.
 * @param element - Shared appearance controls expected to emit the event.
 * @return Next composed appearance update event.
 * @since 0.1.0 Initial implementation.
 */
function waitForChange(
	element: ComponentAppearanceControls,
): Promise<CustomEvent<AppearanceControlsChangeDetail>> {
	return new Promise( ( resolve ) => {
		element.addEventListener( AppearanceControlsChangeEventName, ( event ) => {
			if ( event instanceof CustomEvent ) {
				resolve( event );
			}
		}, { once: true } );
	} );
}

describe( 'tocus-f-appearance-controls', () => {
	it( 'renders nothing until localized copy is supplied', async () => {
		const element = await fixture<ComponentAppearanceControls>( html`
			<tocus-f-appearance-controls></tocus-f-appearance-controls>
		` );

		assert.equal( getShadowRoot( element ).childElementCount, 0 );
	} );

	it( 'renders the approved theme and color controls in a stable order', async () => {
		const element = await renderControls();
		const shadowRoot = getShadowRoot( element );
		const themes = [ ...shadowRoot.querySelectorAll<HTMLInputElement>( 'input[name="theme"]' ) ];
		const palettes = [ ...shadowRoot.querySelectorAll<HTMLInputElement>( 'input[name="palette"]' ) ];

		assert.equal( customElements.get( 'tocus-f-appearance-controls' ), ComponentAppearanceControls );
		assert.deepEqual( themes.map( ( input ) => input.value ), [
			ThemeMode.LIGHT,
			ThemeMode.DARK,
			ThemeMode.SYSTEM,
		] );
		assert.deepEqual( palettes.map( ( input ) => input.value ), [
			Palette.BROWN,
			Palette.GREEN,
			Palette.BLUE,
			Palette.PURPLE,
			Palette.PINK,
			Palette.ORANGE,
		] );
		assert.isTrue( getInput( element, '#theme-dark' ).checked );
		assert.isTrue( getInput( element, '#palette-purple' ).checked );
		assert.equal( shadowRoot.querySelectorAll( '.theme-preview--system .theme-preview-pane' ).length, 2 );
		assert.equal( shadowRoot.querySelector( 'input[name="pause-mode"]' ), null );
		assert.equal( shadowRoot.querySelector( 'input[name="reduced-motion"]' ), null );
		await expect( element ).to.be.accessible();
	} );

	it( 'uses compact palette targets and four-by-three theme previews', async () => {
		const element = await renderControls();
		const shadowRoot = getShadowRoot( element );
		const paletteOption = shadowRoot.querySelector( '.palette-option' );
		const themePreview = shadowRoot.querySelector( '.theme-preview' );

		assert.instanceOf( paletteOption, HTMLElement );
		assert.instanceOf( themePreview, HTMLElement );
		if ( ! ( paletteOption instanceof HTMLElement ) || ! ( themePreview instanceof HTMLElement ) ) {
			throw new TypeError( 'Expected compact palette and theme preview controls.' );
		}

		const paletteBounds = paletteOption.getBoundingClientRect();
		const previewBounds = themePreview.getBoundingClientRect();

		assert.closeTo( paletteBounds.width, 44, 0.5 );
		assert.closeTo( paletteBounds.height, 44, 0.5 );
		assert.closeTo( previewBounds.width / previewBounds.height, 4 / 3, 0.02 );
	} );

	it( 'emits typed controlled theme and color updates', async () => {
		const element = await renderControls();
		const themeEventPromise = waitForChange( element );

		getInput( element, '#theme-light' ).click();
		const themeEvent = await themeEventPromise;

		assert.deepEqual( themeEvent.detail, { update: { theme: ThemeMode.LIGHT } } );
		assert.equal( element.theme, ThemeMode.DARK );

		const paletteEventPromise = waitForChange( element );
		getInput( element, '#palette-green' ).click();
		const paletteEvent = await paletteEventPromise;

		assert.deepEqual( paletteEvent.detail, { update: { palette: Palette.GREEN } } );
		assert.equal( element.palette, Palette.PURPLE );
	} );

	it( 'ignores disabled, unchecked, and unsupported controls', async () => {
		const element = await renderControls();
		const theme = getInput( element, '#theme-light' );
		let changeCount = 0;

		element.addEventListener( AppearanceControlsChangeEventName, () => {
			changeCount += 1;
		} );

		theme.checked = false;
		theme.dispatchEvent( new Event( 'change' ) );
		theme.name = 'unsupported';
		theme.checked = true;
		theme.dispatchEvent( new Event( 'change' ) );
		theme.name = 'theme';
		theme.value = 'sepia';
		theme.dispatchEvent( new Event( 'change' ) );
		theme.name = 'palette';
		theme.value = 'teal';
		theme.dispatchEvent( new Event( 'change' ) );
		element.disabled = true;
		await element.updateComplete;
		getInput( element, '#theme-light' ).dispatchEvent( new Event( 'change' ) );

		assert.equal( changeCount, 0 );
	} );

	it( 'restores focus to a requested native control', async () => {
		const element = await renderControls();
		const input = getInput( element, '#palette-orange' );

		element.focusControl( 'palette-orange' );
		assert.equal( getShadowRoot( element ).activeElement, input );
		element.focusControl( 'missing-control' );
		assert.equal( getShadowRoot( element ).activeElement, input );
	} );

	it( 'supports omitted and empty palette help without empty text', async () => {
		const element = await renderControls();
		const copyWithoutPaletteHelp: Readonly<AppearanceControlsCopy> = {
			themeLegend: TEST_COPY.themeLegend,
			themeOptions: TEST_COPY.themeOptions,
			paletteLegend: TEST_COPY.paletteLegend,
			paletteLabels: TEST_COPY.paletteLabels,
		};

		element.copy = copyWithoutPaletteHelp;
		await element.updateComplete;
		assert.equal( getShadowRoot( element ).querySelector( '.field-help' ), null );

		element.copy = { ...TEST_COPY, paletteHelp: '' };
		await element.updateComplete;
		assert.equal( getShadowRoot( element ).querySelector( '.field-help' ), null );
	} );
} );
