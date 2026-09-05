import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import { assert, fixture } from '@open-wc/testing';
import {
	createManualInterruptionScreenEnvironment,
	type ManualInterruptionScreenEnvironment,
} from './__fixtures__';
import { ComponentInterruptionScreen } from './index';
import {
	InterruptionScreenMode,
	InterruptionScreenState,
} from './types';

/**
 * Returns one required element from the screen shadow tree.
 * @param element - Rendered interruption screen.
 * @param selector - Selector for the required element.
 * @return Matching HTML element.
 */
function getRequiredElement( element: ComponentInterruptionScreen, selector: string ): HTMLElement {
	const match = element.shadowRoot?.querySelector( selector );

	assert.instanceOf( match, HTMLElement );
	if ( ! ( match instanceof HTMLElement ) ) {
		throw new Error( `Expected the interruption screen to render ${ selector }.` );
	}

	return match;
}

/**
 * Creates one connected screen with deterministic timing.
 * @param timing - Manual timing environment.
 * @return Connected interruption screen.
 */
async function createTimedScreen(
	timing: ManualInterruptionScreenEnvironment,
): Promise<ComponentInterruptionScreen> {
	const element = new ComponentInterruptionScreen( timing );
	element.copy = TestEnglishLocalizationBundle.interruption;

	return fixture<ComponentInterruptionScreen>( element );
}

describe( 'tocus-f-interruption-screen presentation timing', () => {
	it( 'reports locally displayed focused progress for persistence checkpoints', async () => {
		const timing = createManualInterruptionScreenEnvironment();
		const element = new ComponentInterruptionScreen( timing );
		element.copy = TestEnglishLocalizationBundle.interruption;

		element.progressing = true;
		await fixture( element );
		timing.advance( 2_500 );

		assert.equal( element.getFocusedProgressMilliseconds(), 2_500 );
	} );

	it( 'advances normal breathing with animation frames and freezes in Waiting at completion', async () => {
		const timing = createManualInterruptionScreenEnvironment();
		const element = new ComponentInterruptionScreen( timing );
		element.copy = TestEnglishLocalizationBundle.interruption;

		element.progressing = true;
		await fixture( element );
		assert.equal( timing.getFrameCount(), 1 );
		assert.equal( timing.getTimerCount(), 0 );

		timing.advance( 4_000 );
		await element.updateComplete;
		assert.equal( getRequiredElement( element, '.remaining' ).textContent.trim(), '6s remaining' );
		assert.equal( getRequiredElement( element, '.cue' ).textContent.trim(), 'Breathe out' );

		timing.advance( 6_000 );
		await element.updateComplete;
		assert.equal( getRequiredElement( element, '.remaining' ).textContent.trim(), '0s remaining' );
		assert.equal( element.state, InterruptionScreenState.WAITING );
		assert.equal( element.shadowRoot?.querySelector( 'button' ), null );
		assert.equal( timing.getFrameCount(), 0 );
	} );

	it( 'starts a new Waiting interval from unchanged authoritative progress', async () => {
		const timing = createManualInterruptionScreenEnvironment();
		const element = new ComponentInterruptionScreen( timing );
		element.copy = TestEnglishLocalizationBundle.interruption;

		element.progressing = true;
		await fixture( element );
		timing.advance( 10_000 );
		await element.updateComplete;
		assert.equal( getRequiredElement( element, '.remaining' ).textContent.trim(), '0s remaining' );

		element.state = InterruptionScreenState.READY;
		await element.updateComplete;
		element.state = InterruptionScreenState.WAITING;
		await element.updateComplete;

		assert.equal( getRequiredElement( element, '.remaining' ).textContent.trim(), '10s remaining' );
		assert.equal( timing.getFrameCount(), 1 );
	} );

	it( 'reanchors authoritative progress and excludes time while progressing is disabled', async () => {
		const timing = createManualInterruptionScreenEnvironment();
		const element = await createTimedScreen( timing );

		assert.equal( timing.getFrameCount(), 0 );
		timing.elapse( 5_000 );
		assert.equal( getRequiredElement( element, '.remaining' ).textContent.trim(), '10s remaining' );

		element.progressing = true;
		await element.updateComplete;
		timing.elapse( 1_500 );
		element.progressing = false;
		await element.updateComplete;
		assert.equal( getRequiredElement( element, '.remaining' ).textContent.trim(), '9s remaining' );
		assert.equal( timing.getFrameCount(), 0 );

		timing.advance( 5_000 );
		element.focusedProgressMilliseconds = 6_000;
		await element.updateComplete;
		assert.equal( getRequiredElement( element, '.remaining' ).textContent.trim(), '4s remaining' );
	} );

	it( 'coalesces overlapping focus and visibility pauses without counting paused time', async () => {
		const timing = createManualInterruptionScreenEnvironment();
		const element = new ComponentInterruptionScreen( timing );
		element.copy = TestEnglishLocalizationBundle.interruption;

		element.progressing = true;
		await fixture( element );
		timing.advance( 1_000 );
		await element.updateComplete;

		timing.setWindowFocused( false );
		await element.updateComplete;
		assert.equal(
			getRequiredElement( element, '[aria-live]' ).textContent.trim(),
			TestEnglishLocalizationBundle.interruption.pausedAnnouncement,
		);
		assert.equal( timing.getFrameCount(), 0 );

		element.copy = {
			...TestEnglishLocalizationBundle.interruption,
			pausedAnnouncement: 'Die ruhige Pause ist angehalten.',
		};
		await element.updateComplete;
		assert.equal( getRequiredElement( element, '[aria-live]' ).textContent.trim(), 'Die ruhige Pause ist angehalten.' );

		timing.setDocumentVisible( false );
		timing.setWindowFocused( true );
		await element.updateComplete;
		assert.equal( getRequiredElement( element, '[aria-live]' ).textContent.trim(), 'Die ruhige Pause ist angehalten.' );
		assert.equal( timing.getFrameCount(), 0 );

		timing.elapse( 5_000 );
		timing.setDocumentVisible( true );
		await element.updateComplete;
		assert.equal(
			getRequiredElement( element, '[aria-live]' ).textContent.trim(),
			TestEnglishLocalizationBundle.interruption.resumedAnnouncement,
		);
		assert.equal( timing.getFrameCount(), 1 );

		timing.advance( 1_000 );
		await element.updateComplete;
		assert.equal( getRequiredElement( element, '.remaining' ).textContent.trim(), '8s remaining' );
	} );

	it( 'uses discrete timeout updates for Quiet pause without animation frames', async () => {
		const timing = createManualInterruptionScreenEnvironment();
		const element = new ComponentInterruptionScreen( timing );
		element.copy = TestEnglishLocalizationBundle.interruption;

		element.mode = InterruptionScreenMode.QUIET;
		element.progressing = true;
		await fixture( element );
		assert.equal( timing.getFrameCount(), 0 );
		assert.equal( timing.getTimerCount(), 1 );

		timing.advance( 1_000 );
		await element.updateComplete;
		assert.equal( getRequiredElement( element, '.remaining' ).textContent.trim(), '9s remaining' );
		assert.equal( timing.getFrameCount(), 0 );
		assert.equal( timing.getTimerCount(), 1 );
	} );

	it( 'aligns a discrete update with the next displayed-second boundary', async () => {
		const timing = createManualInterruptionScreenEnvironment();
		const element = new ComponentInterruptionScreen( timing );
		element.copy = TestEnglishLocalizationBundle.interruption;

		element.mode = InterruptionScreenMode.QUIET;
		element.focusedProgressMilliseconds = 750;
		element.progressing = true;
		await fixture( element );
		assert.equal( timing.getNextTimerDelayMilliseconds(), 250 );

		timing.advance( 250 );
		await element.updateComplete;
		assert.equal( getRequiredElement( element, '.remaining' ).textContent.trim(), '9s remaining' );
	} );

	it( 'uses discrete timeout updates for explicit reduced motion', async () => {
		const timing = createManualInterruptionScreenEnvironment();
		const element = new ComponentInterruptionScreen( timing );
		element.copy = TestEnglishLocalizationBundle.interruption;

		element.reducedMotion = true;
		element.progressing = true;
		await fixture( element );
		assert.equal( timing.getFrameCount(), 0 );
		assert.equal( timing.getTimerCount(), 1 );

		timing.advance( 1_000 );
		await element.updateComplete;
		assert.equal( getRequiredElement( element, '.remaining' ).textContent.trim(), '9s remaining' );
		assert.equal( timing.getFrameCount(), 0 );
		assert.equal( timing.getTimerCount(), 1 );
	} );

	it( 'cancels every callback and lifecycle listener when disconnected', async () => {
		const timing = createManualInterruptionScreenEnvironment();
		const element = new ComponentInterruptionScreen( timing );
		element.copy = TestEnglishLocalizationBundle.interruption;

		element.mode = InterruptionScreenMode.QUIET;
		element.progressing = true;
		await fixture( element );
		assert.equal( timing.getTimerCount(), 1 );

		element.remove();
		assert.equal( timing.getFrameCount(), 0 );
		assert.equal( timing.getTimerCount(), 0 );

		timing.setDocumentVisible( false );
		timing.setWindowFocused( false );
		assert.equal( timing.getFrameCount(), 0 );
		assert.equal( timing.getTimerCount(), 0 );
	} );

	it( 'restarts active progress when the component lifecycle reconnects', async () => {
		const timing = createManualInterruptionScreenEnvironment();
		const element = new ComponentInterruptionScreen( timing );
		element.copy = TestEnglishLocalizationBundle.interruption;

		element.progressing = true;
		await fixture( element );
		assert.equal( timing.getFrameCount(), 1 );

		element.disconnectedCallback();
		assert.equal( timing.getFrameCount(), 0 );
		element.connectedCallback();
		assert.equal( timing.getFrameCount(), 1 );
	} );

	it( 'ignores a frame callback that arrives after an authoritative state change', async () => {
		const timing = createManualInterruptionScreenEnvironment();
		const element = new ComponentInterruptionScreen( timing );
		element.copy = TestEnglishLocalizationBundle.interruption;

		element.progressing = true;
		await fixture( element );
		const staleFrame = timing.getNextFrameCallback();

		assert.notEqual( staleFrame, null );
		if ( staleFrame === null ) {
			throw new Error( 'Expected the active screen to schedule one animation frame.' );
		}

		element.state = InterruptionScreenState.READY;
		await element.updateComplete;
		staleFrame( timing.now() );

		assert.equal( timing.getFrameCount(), 0 );
		assert.equal( timing.getTimerCount(), 0 );
		assert.equal( element.state, InterruptionScreenState.READY );
	} );
} );
