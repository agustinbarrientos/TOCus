import { assert, expect, fixture, html, nextFrame } from '@open-wc/testing';
import { emulateMedia, setViewport } from '@web/test-runner-commands';
import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import { InterruptionScreenState } from '../screen/types';
import { ComponentProtectedPageLayer } from './index';
import './index';

/**
 * Returns a required rendered layout element from the actual interruption screen.
 * @param layer - Protected-page layer containing the screen.
 * @param selector - Screen descendant selector.
 * @return Rendered layout element.
 * @since 0.1.0 Initial implementation.
 */
function getScreenElement( layer: ComponentProtectedPageLayer, selector: string ): HTMLElement {
	const element = layer.getInterruptionScreen().shadowRoot?.querySelector( selector );

	assert.instanceOf( element, HTMLElement );
	if ( ! ( element instanceof HTMLElement ) ) {
		throw new TypeError( `Expected screen element: ${ selector }` );
	}

	return element;
}

describe( 'tocus-f-protected-page-layer layout', () => {
	let originalRootFontSize: string;

	beforeEach( async () => {
		originalRootFontSize = document.documentElement.style.fontSize;
		await setViewport( { width: 1728, height: 900 } );
		await emulateMedia( { colorScheme: 'light', forcedColors: 'none', reducedMotion: 'reduce' } );
	} );

	afterEach( async () => {
		document.documentElement.style.fontSize = originalRootFontSize;
		await setViewport( { width: 800, height: 600 } );
		await emulateMedia( { colorScheme: 'light', forcedColors: 'none', reducedMotion: 'no-preference' } );
	} );

	for ( const rootFontSize of [ '10px', '16px', '20px' ] ) {
		it( `preserves readable Ready text and geometry on a page with a ${ rootFontSize } root`, async () => {
			document.documentElement.style.fontSize = rootFontSize;
			const layer = await fixture<ComponentProtectedPageLayer>( html`
				<tocus-f-protected-page-layer
					.copy=${ TestEnglishLocalizationBundle.protectedPageLayer }
					.interruptionCopy=${ TestEnglishLocalizationBundle.interruption }
					.interruptionLayerPresented=${ true }
				></tocus-f-protected-page-layer>
			` );
			layer.getInterruptionScreen().state = InterruptionScreenState.READY;
			layer.getInterruptionScreen().wellbeingSummary = 'Since you started, you have taken 45 seconds for yourself.';
			await layer.getInterruptionScreen().updateComplete;
			const button = getScreenElement( layer, '.continue-button' );
			const footer = getScreenElement( layer, 'footer' );
			const icon = getScreenElement( layer, '.brand-icon' );

			assert.approximately( parseFloat( getComputedStyle( footer ).fontSize ), 13.8, 0.01 );
			assert.approximately( parseFloat( getComputedStyle( button ).fontSize ), 16.1, 0.01 );
			assert.approximately( parseFloat( getComputedStyle( button ).lineHeight ), 23, 0.01 );
			assert.approximately( parseFloat( getComputedStyle( button ).paddingInlineStart ), 32, 0.01 );
			assert.approximately( button.getBoundingClientRect().width, 160, 1 );
			assert.approximately( button.getBoundingClientRect().height, 56, 1 );
			assert.approximately( icon.getBoundingClientRect().width, 32, 0.01 );
			assert.equal( document.documentElement.style.fontSize, rootFontSize );
		} );
	}

	for ( const state of [ InterruptionScreenState.WAITING, InterruptionScreenState.READY ] ) {
		it( `has no decorative desktop scrolling while ${ state }`, async () => {
			const layer = await fixture<ComponentProtectedPageLayer>( html`
				<tocus-f-protected-page-layer
					.copy=${ TestEnglishLocalizationBundle.protectedPageLayer }
					.interruptionCopy=${ TestEnglishLocalizationBundle.interruption }
					.interruptionLayerPresented=${ true }
				></tocus-f-protected-page-layer>
			` );
			layer.getInterruptionScreen().state = state;
			layer.getInterruptionScreen().wellbeingSummary = 'Since you started, you have taken 45 seconds for yourself.';
			await layer.getInterruptionScreen().updateComplete;
			const scene = getScreenElement( layer, '.scene' );

			for ( const bloomScale of [ '0.82', '1' ] ) {
				scene.style.setProperty( '--tocus-breath-bloom-scale', bloomScale );
				assert.equal( scene.clientHeight, 900 );
				assert.equal( scene.scrollHeight, scene.clientHeight );
				assert.equal( scene.scrollWidth, scene.clientWidth );
			}
		} );
	}

	it( 'keeps Continue and the footer reachable on a short protected page in forced colors', async () => {
		document.documentElement.style.fontSize = '10px';
		await setViewport( { width: 320, height: 240 } );
		await emulateMedia( { forcedColors: 'active', reducedMotion: 'reduce' } );
		const layer = await fixture<ComponentProtectedPageLayer>( html`
			<tocus-f-protected-page-layer
				.copy=${ TestEnglishLocalizationBundle.protectedPageLayer }
				.interruptionCopy=${ TestEnglishLocalizationBundle.interruption }
				.interruptionLayerPresented=${ true }
			></tocus-f-protected-page-layer>
		` );
		layer.getInterruptionScreen().state = InterruptionScreenState.READY;
		layer.getInterruptionScreen().wellbeingSummary = 'Since you started, you have taken three hours and twenty-four minutes for yourself.';
		await layer.getInterruptionScreen().updateComplete;
		const scene = getScreenElement( layer, '.scene' );
		const button = getScreenElement( layer, '.continue-button' );
		const footer = getScreenElement( layer, 'footer' );
		const stage = getScreenElement( layer, '.stage' );
		const shortcut = getScreenElement( layer, '.shortcut' );

		assert.equal( getComputedStyle( scene ).overflowY, 'auto' );
		assert.isAbove( scene.scrollHeight, scene.clientHeight );
		assert.isAtMost( stage.getBoundingClientRect().bottom, footer.getBoundingClientRect().top );
		assert.isAtMost( shortcut.getBoundingClientRect().bottom, footer.getBoundingClientRect().top );
		button.scrollIntoView( { block: 'center' } );
		await nextFrame();
		assert.isAtLeast( button.getBoundingClientRect().top, 0 );
		assert.isAtMost( button.getBoundingClientRect().bottom, window.innerHeight );
		assert.equal( getComputedStyle( button ).borderStyle, 'solid' );
		footer.scrollIntoView( { block: 'end' } );
		await nextFrame();
		assert.isAtMost( footer.getBoundingClientRect().bottom, window.innerHeight + 1 );
		await expect( layer ).to.be.accessible();
	} );
} );
