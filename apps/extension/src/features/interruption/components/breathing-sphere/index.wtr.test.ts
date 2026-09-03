import { assert, expect, fixture, html } from '@open-wc/testing';
import { emulateMedia } from '@web/test-runner-commands';
import { ComponentBreathingSphere } from './index';

/**
 * Returns the Canvas rendered by a breathing-sphere fixture.
 * @param element - Rendered breathing-sphere component.
 * @return Rendered Canvas element.
 */
function getCanvas( element: ComponentBreathingSphere ): HTMLCanvasElement {
	const canvas = element.shadowRoot?.querySelector( 'canvas' );

	assert.instanceOf( canvas, HTMLCanvasElement );
	if ( ! ( canvas instanceof HTMLCanvasElement ) ) {
		throw new Error( 'Expected the breathing sphere to render a Canvas.' );
	}

	return canvas;
}

/**
 * Counts pixels whose alpha channel is not fully transparent.
 * @param canvas - Canvas whose real rendered pixels are inspected.
 * @return Number of visible pixels.
 */
function countVisiblePixels( canvas: HTMLCanvasElement ): number {
	const context = canvas.getContext( '2d' );

	assert.notEqual( context, null );
	if ( context === null ) {
		throw new Error( 'Expected a two-dimensional Canvas context.' );
	}

	const pixels = context.getImageData( 0, 0, canvas.width, canvas.height ).data;
	let count = 0;

	for ( let index = 3; index < pixels.length; index += 4 ) {
		if ( pixels[ index ] !== 0 ) {
			count += 1;
		}
	}

	return count;
}

/**
 * Waits for the next browser animation frame.
 * @return Promise resolved after one frame.
 */
function nextFrame(): Promise<void> {
	return new Promise( ( resolve ) => {
		requestAnimationFrame( () => {
			resolve();
		} );
	} );
}

/**
 * Represents a browser that cannot create a two-dimensional Canvas context.
 * @return Unavailable Canvas context.
 */
function getUnavailableCanvasContext(): null {
	return null;
}

describe( 'tocus-f-breathing-sphere', () => {
	beforeEach( async () => {
		document.documentElement.setAttribute( 'data-tocus-palette', 'brown' );
		document.documentElement.setAttribute( 'data-tocus-theme', 'light' );
		await emulateMedia( { colorScheme: 'light' } );
	} );

	afterEach( () => {
		document.documentElement.removeAttribute( 'data-tocus-palette' );
		document.documentElement.removeAttribute( 'data-tocus-theme' );
	} );

	it( 'registers the exported component class', () => {
		assert.equal( customElements.get( 'tocus-f-breathing-sphere' ), ComponentBreathingSphere );
	} );

	it( 'does not attach observers after disconnection precedes the first update', async () => {
		const element = document.createElement( 'tocus-f-breathing-sphere' );

		document.body.append( element );
		element.remove();
		await element.updateComplete;
		await Promise.resolve();

		assert.equal( Reflect.get( element, 'appearanceObserver' ), null );
		assert.equal( Reflect.get( element, 'resizeObserver' ), null );
		assert.equal( Reflect.get( element, 'colorSchemeQuery' ), null );
	} );

	it( 'reconnects its observers and refreshes inherited colors', async () => {
		const element = document.createElement( 'tocus-f-breathing-sphere' );

		element.style.width = '260px';
		element.style.height = '220px';
		document.body.append( element );
		element.remove();
		document.body.append( element );
		await element.updateComplete;
		await Promise.resolve();

		const canvas = getCanvas( element );
		const brownImage = canvas.toDataURL();

		element.remove();
		document.documentElement.setAttribute( 'data-tocus-palette', 'green' );
		document.body.append( element );
		await Promise.resolve();
		await nextFrame();

		assert.instanceOf( Reflect.get( element, 'appearanceObserver' ), MutationObserver );
		assert.notEqual( canvas.toDataURL(), brownImage );
		element.remove();
	} );

	it( 'renders one decorative responsive Canvas with real visible pixels', async () => {
		const element = await fixture<ComponentBreathingSphere>(
			html`<tocus-f-breathing-sphere style="width: 320px; height: 280px;"></tocus-f-breathing-sphere>`,
		);
		const canvas = getCanvas( element );

		await nextFrame();

		assert.equal( canvas.getAttribute( 'aria-hidden' ), 'true' );
		assert.equal( canvas.width, 320 );
		assert.equal( canvas.height, 280 );
		assert.isAbove( countVisiblePixels( canvas ), 0 );
		await expect( element ).to.be.accessible();
	} );

	it( 'renders a resting frame for an invalid public progress attribute', async () => {
		const element = await fixture<ComponentBreathingSphere>(
			html`<tocus-f-breathing-sphere style="width: 320px; height: 280px;"></tocus-f-breathing-sphere>`,
		);

		element.setAttribute( 'breath-progress', 'not-a-number' );
		await element.updateComplete;

		assert.isAbove( countVisiblePixels( getCanvas( element ) ), 0 );
	} );

	it( 'renders a visibly larger sphere at the inhale peak', async () => {
		const element = await fixture<ComponentBreathingSphere>(
			html`<tocus-f-breathing-sphere style="width: 320px; height: 280px;"></tocus-f-breathing-sphere>`,
		);
		const canvas = getCanvas( element );

		element.breathProgress = 0;
		await element.updateComplete;
		const restingPixels = countVisiblePixels( canvas );

		element.breathProgress = 1;
		await element.updateComplete;
		const peakPixels = countVisiblePixels( canvas );

		assert.isAbove( peakPixels, restingPixels );
	} );

	it( 'keeps the dimensional still sphere unchanged across breath values', async () => {
		const element = await fixture<ComponentBreathingSphere>(
			html`<tocus-f-breathing-sphere
				still
				style="width: 320px; height: 280px;"
			></tocus-f-breathing-sphere>`,
		);
		const canvas = getCanvas( element );

		element.breathProgress = 0;
		await element.updateComplete;
		const restingImage = canvas.toDataURL();

		element.breathProgress = 1;
		await element.updateComplete;

		assert.equal( canvas.toDataURL(), restingImage );
	} );

	it( 'resizes its backing pixels when the artboard changes', async () => {
		const element = await fixture<ComponentBreathingSphere>(
			html`<tocus-f-breathing-sphere style="width: 240px; height: 200px;"></tocus-f-breathing-sphere>`,
		);
		const canvas = getCanvas( element );

		assert.equal( canvas.width, 240 );
		assert.equal( canvas.height, 200 );

		element.style.width = '300px';
		element.style.height = '260px';
		await nextFrame();
		await nextFrame();

		assert.equal( canvas.width, 300 );
		assert.equal( canvas.height, 260 );
	} );

	it( 'resynchronizes backing pixels when device scale changes without a layout resize', async () => {
		const originalDevicePixelRatio = window.devicePixelRatio;

		try {
			Object.defineProperty( window, 'devicePixelRatio', { configurable: true, value: 1 } );
			const element = await fixture<ComponentBreathingSphere>(
				html`<tocus-f-breathing-sphere style="width: 120px; height: 80px;"></tocus-f-breathing-sphere>`,
			);
			const canvas = getCanvas( element );

			assert.equal( canvas.width, 120 );
			assert.equal( canvas.height, 80 );

			Object.defineProperty( window, 'devicePixelRatio', { configurable: true, value: 2 } );
			element.breathProgress = 0.5;
			await element.updateComplete;

			assert.equal( canvas.width, 240 );
			assert.equal( canvas.height, 160 );
		} finally {
			Object.defineProperty( window, 'devicePixelRatio', {
				configurable: true,
				value: originalDevicePixelRatio,
			} );
		}
	} );

	it( 'redraws from inherited palette and explicit-theme tokens', async () => {
		const element = await fixture<ComponentBreathingSphere>(
			html`<tocus-f-breathing-sphere style="width: 260px; height: 220px;"></tocus-f-breathing-sphere>`,
		);
		const canvas = getCanvas( element );
		const brownLightImage = canvas.toDataURL();

		document.documentElement.setAttribute( 'data-tocus-palette', 'green' );
		await Promise.resolve();
		await element.updateComplete;
		const greenLightImage = canvas.toDataURL();

		document.documentElement.setAttribute( 'data-tocus-theme', 'dark' );
		await Promise.resolve();
		await element.updateComplete;
		const greenDarkImage = canvas.toDataURL();

		assert.notEqual( greenLightImage, brownLightImage );
		assert.notEqual( greenDarkImage, greenLightImage );
	} );

	it( 'redraws when an outer shadow host changes its inherited appearance', async () => {
		const outerHost = document.createElement( 'div' );
		const outerShadow = outerHost.attachShadow( { mode: 'open' } );
		const innerHost = document.createElement( 'div' );
		const innerShadow = innerHost.attachShadow( { mode: 'open' } );
		const element = document.createElement( 'tocus-f-breathing-sphere' );

		element.style.width = '260px';
		element.style.height = '220px';
		innerShadow.append( element );
		outerShadow.append( innerHost );
		document.body.append( outerHost );
		await element.updateComplete;
		await nextFrame();
		const canvas = getCanvas( element );
		const brownImage = canvas.toDataURL();

		outerHost.style.setProperty( '--tocus-color-breathing-sphere', '#78966c' );
		outerHost.style.setProperty( '--tocus-color-breathing-sphere-highlight', '#bdcfad' );
		outerHost.style.setProperty( '--tocus-color-breathing-sphere-shadow', '#4d6849' );
		outerHost.style.setProperty( '--tocus-color-breathing-sphere-contour', '#4d6849' );
		outerHost.style.setProperty( '--tocus-color-shadow-depth', '#263829' );
		outerHost.style.setProperty( '--tocus-color-stage-start', '#f4f7ef' );
		outerHost.setAttribute( 'data-tocus-palette', 'green' );
		await Promise.resolve();
		await element.updateComplete;

		assert.notEqual( canvas.toDataURL(), brownImage );
		outerHost.remove();
	} );

	it( 'redraws when the system color scheme changes', async () => {
		document.documentElement.setAttribute( 'data-tocus-theme', 'system' );
		const element = await fixture<ComponentBreathingSphere>(
			html`<tocus-f-breathing-sphere style="width: 260px; height: 220px;"></tocus-f-breathing-sphere>`,
		);
		const canvas = getCanvas( element );
		const lightImage = canvas.toDataURL();
		const colorSchemeQuery = Reflect.get( element, 'colorSchemeQuery' ) as MediaQueryList | null;

		assert.notEqual( colorSchemeQuery, null );
		if ( colorSchemeQuery === null ) {
			throw new Error( 'Expected the breathing sphere to observe the system color scheme.' );
		}

		await emulateMedia( { colorScheme: 'dark' } );
		colorSchemeQuery.dispatchEvent( new Event( 'change' ) );
		await nextFrame();
		await element.updateComplete;

		assert.isTrue( colorSchemeQuery.matches );
		assert.notEqual( canvas.toDataURL(), lightImage );
	} );

	it( 'does not fail when a two-dimensional Canvas context is unavailable', async () => {
		const element = await fixture<ComponentBreathingSphere>(
			html`<tocus-f-breathing-sphere style="width: 260px; height: 220px;"></tocus-f-breathing-sphere>`,
		);
		const canvas = getCanvas( element );

		Object.defineProperty( canvas, 'getContext', { value: getUnavailableCanvasContext } );
		element.breathProgress = 0.5;
		await element.updateComplete;

		assert.equal( element.breathProgress, 0.5 );
	} );
} );
