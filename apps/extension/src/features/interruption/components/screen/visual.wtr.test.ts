import { assert, fixture, html } from '@open-wc/testing';
import { emulateMedia } from '@web/test-runner-commands';
import { visualDiff } from '@web/test-runner-visual-regression';
import './index';
import { type ComponentInterruptionScreen } from './index';
import { InterruptionScreenState } from './types';

/** Deterministic all-time wellbeing sentence used by interruption screenshots. */
const VISUAL_WELLBEING_SUMMARY = 'You have saved yourself at least 3h 24m and spent 18m taking care of yourself.';

describe( 'tocus-f-interruption-screen visual', () => {
	before( async () => {
		const loadedFonts = await document.fonts.load( '600 2rem "Fredoka Variable"', 'TOCus' );

		assert.isAbove( loadedFonts.length, 0 );
	} );

	afterEach( () => {
		document.documentElement.removeAttribute( 'data-tocus-palette' );
		document.documentElement.removeAttribute( 'data-tocus-theme' );
	} );

	it( 'matches Brown Waiting in the light appearance', async () => {
		document.documentElement.setAttribute( 'data-tocus-palette', 'brown' );
		document.documentElement.setAttribute( 'data-tocus-theme', 'light' );
		await emulateMedia( { colorScheme: 'light', forcedColors: 'none', reducedMotion: 'no-preference' } );
		const element = await fixture<ComponentInterruptionScreen>( html`
			<tocus-f-interruption-screen
				.focusedProgressMilliseconds=${ 2_000 }
				.wellbeingSummary=${ VISUAL_WELLBEING_SUMMARY }
			></tocus-f-interruption-screen>
		` );

		assert.isTrue( element.isConnected );
		await visualDiff( element, 'interruption-screen-waiting-light' );
	} );

	it( 'matches Brown Waiting in the dark appearance', async () => {
		document.documentElement.setAttribute( 'data-tocus-palette', 'brown' );
		document.documentElement.setAttribute( 'data-tocus-theme', 'dark' );
		await emulateMedia( { colorScheme: 'dark', forcedColors: 'none', reducedMotion: 'no-preference' } );
		const element = await fixture<ComponentInterruptionScreen>( html`
			<tocus-f-interruption-screen
				.focusedProgressMilliseconds=${ 2_000 }
				.wellbeingSummary=${ VISUAL_WELLBEING_SUMMARY }
			></tocus-f-interruption-screen>
		` );

		assert.isTrue( element.isConnected );
		await visualDiff( element, 'interruption-screen-waiting-dark' );
	} );

	it( 'matches the centered Ready action', async () => {
		document.documentElement.setAttribute( 'data-tocus-palette', 'brown' );
		document.documentElement.setAttribute( 'data-tocus-theme', 'light' );
		await emulateMedia( { colorScheme: 'light', forcedColors: 'none', reducedMotion: 'reduce' } );
		const element = await fixture<ComponentInterruptionScreen>( html`
			<tocus-f-interruption-screen
				reduced-motion
				.state=${ InterruptionScreenState.READY }
				.wellbeingSummary=${ VISUAL_WELLBEING_SUMMARY }
			></tocus-f-interruption-screen>
		` );

		assert.isTrue( element.isConnected );
		await visualDiff( element, 'interruption-screen-ready' );
	} );

	it( 'matches the unavailable recovery state', async () => {
		document.documentElement.setAttribute( 'data-tocus-palette', 'brown' );
		document.documentElement.setAttribute( 'data-tocus-theme', 'light' );
		await emulateMedia( { colorScheme: 'light', forcedColors: 'none', reducedMotion: 'reduce' } );
		const element = await fixture<ComponentInterruptionScreen>( html`
			<tocus-f-interruption-screen
				reduced-motion
				.state=${ InterruptionScreenState.UNAVAILABLE }
				.wellbeingSummary=${ VISUAL_WELLBEING_SUMMARY }
			></tocus-f-interruption-screen>
		` );

		assert.isTrue( element.isConnected );
		await visualDiff( element, 'interruption-screen-unavailable' );
	} );
} );
