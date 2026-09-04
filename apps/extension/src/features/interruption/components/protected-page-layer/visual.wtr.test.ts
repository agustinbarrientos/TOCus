import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import { assert, fixture, html } from '@open-wc/testing';
import { emulateMedia } from '@web/test-runner-commands';
import { visualDiff } from '@web/test-runner-visual-regression';
import './index';
import { type ComponentProtectedPageLayer } from './index';

/**
 * Returns the rendered warning inside one protected-page layer.
 * @param element - Rendered protected-page layer.
 * @return Quiet warning element.
 * @since 0.1.0 Initial implementation.
 */
function getWarning( element: ComponentProtectedPageLayer ): HTMLElement {
	const presentationRoot = element.getInterruptionScreen().getRootNode();

	assert.instanceOf( presentationRoot, ShadowRoot );
	if ( ! ( presentationRoot instanceof ShadowRoot ) ) {
		throw new TypeError( 'Expected the screen to belong to the protected-page shadow root.' );
	}

	const warning = presentationRoot.querySelector( '.warning' );

	assert.instanceOf( warning, HTMLElement );
	if ( ! ( warning instanceof HTMLElement ) ) {
		throw new TypeError( 'Expected a rendered allowance warning.' );
	}

	return warning;
}

describe( 'tocus-f-protected-page-layer visual', () => {
	before( async () => {
		const loadedFonts = await document.fonts.load( '500 1rem "Fredoka Variable"', 'TOCus' );

		assert.isAbove( loadedFonts.length, 0 );
	} );

	afterEach( () => {
		document.body.style.removeProperty( 'background' );
	} );

	for ( const scenario of [
		{ appearance: 'light', background: '#fff8f0' },
		{ appearance: 'dark', background: '#120c09' },
	] as const ) {
		it( `matches the quiet warning in the ${ scenario.appearance } appearance`, async () => {
			document.body.style.background = scenario.background;
			await emulateMedia( {
				colorScheme: scenario.appearance,
				forcedColors: 'none',
				reducedMotion: 'reduce',
			} );
			const element = await fixture<ComponentProtectedPageLayer>( html`
				<tocus-f-protected-page-layer
			.copy=${ TestEnglishLocalizationBundle.protectedPageLayer }
			.interruptionCopy=${ TestEnglishLocalizationBundle.interruption }
					.warningRemainingSeconds=${ 8 }
				></tocus-f-protected-page-layer>
			` );

			await visualDiff( getWarning( element ), `protected-page-warning-${ scenario.appearance }` );
		} );
	}
} );
