import { assert, fixture, html } from '@open-wc/testing';
import { emulateMedia } from '@web/test-runner-commands';
import {
	readBreathingSphereColors,
	renderBreathingSphereFrame,
	resizeBreathingSphereCanvas,
} from './index';

/**
 * Browser elements needed to exercise the Canvas renderer.
 */
interface RendererFixture {
	canvas: HTMLCanvasElement;
	colorProbe: HTMLSpanElement;
}

/**
 * Creates a real responsive Canvas and inherited-color probe.
 * @param width - Displayed Canvas width.
 * @param height - Displayed Canvas height.
 * @return Renderer fixture attached to the test document.
 */
async function createRendererFixture( width: number, height: number ): Promise<RendererFixture> {
	const container = await fixture<HTMLElement>( html`
		<div>
			<canvas style="display: block; width: ${ width }px; height: ${ height }px;"></canvas>
			<span></span>
		</div>
	` );
	const canvas = container.querySelector( 'canvas' );
	const colorProbe = container.querySelector( 'span' );

	assert.instanceOf( canvas, HTMLCanvasElement );
	assert.instanceOf( colorProbe, HTMLSpanElement );
	if ( ! ( canvas instanceof HTMLCanvasElement ) || ! ( colorProbe instanceof HTMLSpanElement ) ) {
		throw new Error( 'Expected a Canvas and color probe in the renderer fixture.' );
	}

	return { canvas, colorProbe };
}

/**
 * Counts pixels whose alpha channel is not fully transparent.
 * @param canvas - Canvas whose rendered pixels are inspected.
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
 * Represents a browser that cannot create a two-dimensional Canvas context.
 * @return Unavailable Canvas context.
 */
function getUnavailableCanvasContext(): null {
	return null;
}

describe( 'breathing-sphere renderer', () => {
	beforeEach( async () => {
		document.documentElement.setAttribute( 'data-tocus-palette', 'brown' );
		document.documentElement.setAttribute( 'data-tocus-theme', 'light' );
		await emulateMedia( { colorScheme: 'light' } );
	} );

	afterEach( () => {
		document.documentElement.removeAttribute( 'data-tocus-palette' );
		document.documentElement.removeAttribute( 'data-tocus-theme' );
	} );

	it( 'resolves every inherited Canvas color from the shared theme', async () => {
		const { colorProbe } = await createRendererFixture( 320, 280 );
		const brownColors = readBreathingSphereColors( colorProbe );
		const brownColorValues = [
			brownColors.clay,
			brownColors.clayHighlightBlend,
			brownColors.clayShadowBlend,
			brownColors.contour,
			brownColors.depth,
			brownColors.depthMuted,
			brownColors.depthShadow,
			brownColors.highlight,
			brownColors.shadow,
			brownColors.stageStart,
		];

		document.documentElement.setAttribute( 'data-tocus-palette', 'green' );
		const greenColors = readBreathingSphereColors( colorProbe );

		assert.isTrue( brownColorValues.every( ( color ) => color.length > 0 ) );
		assert.notDeepEqual( greenColors, brownColors );
	} );

	it( 'uses high-density backing pixels and caps the device scale at two', async () => {
		const originalDevicePixelRatio = window.devicePixelRatio;
		const { canvas } = await createRendererFixture( 120, 80 );

		try {
			Object.defineProperty( window, 'devicePixelRatio', { configurable: true, value: 2 } );
			resizeBreathingSphereCanvas( canvas );

			assert.equal( canvas.width, 240 );
			assert.equal( canvas.height, 160 );

			Object.defineProperty( window, 'devicePixelRatio', { configurable: true, value: 3 } );
			resizeBreathingSphereCanvas( canvas );

			assert.equal( canvas.width, 240 );
			assert.equal( canvas.height, 160 );
		} finally {
			Object.defineProperty( window, 'devicePixelRatio', {
				configurable: true,
				value: originalDevicePixelRatio,
			} );
		}
	} );

	it( 'sizes the backing pixels and paints a larger inhale peak', async () => {
		const { canvas, colorProbe } = await createRendererFixture( 320, 280 );
		const colors = readBreathingSphereColors( colorProbe );

		resizeBreathingSphereCanvas( canvas );
		resizeBreathingSphereCanvas( canvas );
		renderBreathingSphereFrame( { breathProgress: 0, canvas, colors, still: false } );
		const restingPixels = countVisiblePixels( canvas );

		renderBreathingSphereFrame( { breathProgress: 1, canvas, colors, still: false } );

		assert.equal( canvas.width, 320 );
		assert.equal( canvas.height, 280 );
		assert.isAbove( countVisiblePixels( canvas ), restingPixels );
	} );

	it( 'keeps the dimensional still sphere unchanged across breath values', async () => {
		const { canvas, colorProbe } = await createRendererFixture( 320, 280 );
		const colors = readBreathingSphereColors( colorProbe );

		resizeBreathingSphereCanvas( canvas );
		renderBreathingSphereFrame( { breathProgress: 0, canvas, colors, still: true } );
		const restingImage = canvas.toDataURL();

		renderBreathingSphereFrame( { breathProgress: 1, canvas, colors, still: true } );

		assert.equal( canvas.toDataURL(), restingImage );
	} );

	it( 'normalizes non-finite progress to the resting frame', async () => {
		const { canvas, colorProbe } = await createRendererFixture( 320, 280 );
		const colors = readBreathingSphereColors( colorProbe );

		resizeBreathingSphereCanvas( canvas );
		renderBreathingSphereFrame( { breathProgress: 0, canvas, colors, still: false } );
		const restingImage = canvas.toDataURL();

		renderBreathingSphereFrame( { breathProgress: Number.NaN, canvas, colors, still: false } );

		assert.equal( canvas.toDataURL(), restingImage );
	} );

	it( 'returns safely when a two-dimensional Canvas context is unavailable', async () => {
		const { canvas, colorProbe } = await createRendererFixture( 320, 280 );
		const colors = readBreathingSphereColors( colorProbe );

		Object.defineProperty( canvas, 'getContext', { value: getUnavailableCanvasContext } );
		renderBreathingSphereFrame( { breathProgress: 0.5, canvas, colors, still: false } );

		assert.equal( canvas.width, 300 );
	} );
} );
