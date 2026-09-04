import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import { assert, fixture } from '@open-wc/testing';
import { ComponentInterruptionScreen } from './index';
import {
	InterruptionScreenMode,
	InterruptionScreenState,
	type InterruptionScreenEnvironment,
} from './types';

/**
 * One callback scheduled against the deterministic test clock.
 */
interface ScheduledTestCallback {
	callback: () => void;
	dueMilliseconds: number;
}

/**
 * Deterministic timing environment used to exercise presentation-clock behavior.
 */
class ManualInterruptionScreenTiming implements InterruptionScreenEnvironment {
	private currentTimeMilliseconds = 0;

	private documentVisible = true;

	private windowFocused = true;

	private nextHandle = 1;

	private readonly frameCallbacks = new Map<number, FrameRequestCallback>();

	private readonly timerCallbacks = new Map<number, ScheduledTestCallback>();

	/**
	 * Returns the deterministic monotonic time.
	 * @return Current test time.
	 */
	now(): number {
		return this.currentTimeMilliseconds;
	}

	/**
	 * Reports whether the test document is visible.
	 * @return Current document visibility.
	 */
	isDocumentVisible(): boolean {
		return this.documentVisible;
	}

	/**
	 * Reports whether the test window is focused.
	 * @return Current window focus.
	 */
	isWindowFocused(): boolean {
		return this.windowFocused;
	}

	/**
	 * Queues one deterministic animation-frame callback.
	 * @param callback - Frame callback to retain.
	 * @return Deterministic callback handle.
	 */
	requestAnimationFrame( callback: FrameRequestCallback ): number {
		const handle = this.nextHandle;

		this.nextHandle += 1;
		this.frameCallbacks.set( handle, callback );

		return handle;
	}

	/**
	 * Cancels one deterministic animation-frame callback.
	 * @param handle - Callback handle to cancel.
	 */
	cancelAnimationFrame( handle: number ): void {
		this.frameCallbacks.delete( handle );
	}

	/**
	 * Queues one deterministic timeout callback.
	 * @param callback - Timeout callback to retain.
	 * @param delayMilliseconds - Delay from the current test time.
	 * @return Deterministic callback handle.
	 */
	setTimeout( callback: () => void, delayMilliseconds: number ): number {
		const handle = this.nextHandle;

		this.nextHandle += 1;
		this.timerCallbacks.set( handle, {
			callback,
			dueMilliseconds: this.currentTimeMilliseconds + delayMilliseconds,
		} );

		return handle;
	}

	/**
	 * Cancels one deterministic timeout callback.
	 * @param handle - Callback handle to cancel.
	 */
	clearTimeout( handle: number ): void {
		this.timerCallbacks.delete( handle );
	}

	/**
	 * Moves time without executing scheduled callbacks.
	 * @param milliseconds - Nonnegative time increment.
	 */
	elapse( milliseconds: number ): void {
		this.currentTimeMilliseconds += milliseconds;
	}

	/**
	 * Moves time and executes callbacks that were already scheduled.
	 * @param milliseconds - Nonnegative time increment.
	 */
	advance( milliseconds: number ): void {
		this.elapse( milliseconds );

		const dueTimers = Array.from( this.timerCallbacks.entries() )
			.filter( ( [ , timer ] ) => timer.dueMilliseconds <= this.currentTimeMilliseconds )
			.sort( ( [ , left ], [ , right ] ) => left.dueMilliseconds - right.dueMilliseconds );

		for ( const [ handle, timer ] of dueTimers ) {
			this.timerCallbacks.delete( handle );
			timer.callback();
		}

		const frameCallbacks = Array.from( this.frameCallbacks.values() );

		this.frameCallbacks.clear();
		for ( const callback of frameCallbacks ) {
			callback( this.currentTimeMilliseconds );
		}
	}

	/**
	 * Changes document visibility and emits the real lifecycle event.
	 * @param visible - New document visibility.
	 */
	setDocumentVisible( visible: boolean ): void {
		this.documentVisible = visible;
		document.dispatchEvent( new Event( 'visibilitychange' ) );
	}

	/**
	 * Changes window focus and emits the real lifecycle event.
	 * @param focused - New window focus.
	 */
	setWindowFocused( focused: boolean ): void {
		this.windowFocused = focused;
		window.dispatchEvent( new Event( focused ? 'focus' : 'blur' ) );
	}

	/**
	 * Returns the number of queued frame callbacks.
	 * @return Queued frame count.
	 */
	getFrameCount(): number {
		return this.frameCallbacks.size;
	}

	/**
	 * Returns the number of queued timeout callbacks.
	 * @return Queued timeout count.
	 */
	getTimerCount(): number {
		return this.timerCallbacks.size;
	}

	/**
	 * Returns the delay until the next queued timeout.
	 * @return Next delay or null when no timeout is queued.
	 */
	getNextTimerDelayMilliseconds(): number | null {
		const timer = this.timerCallbacks.values().next().value;

		return timer === undefined
			? null
			: timer.dueMilliseconds - this.currentTimeMilliseconds;
	}

	/**
	 * Captures the next queued frame callback without changing its cancellation behavior.
	 * @return Queued frame callback or null when none exists.
	 */
	getNextFrameCallback(): FrameRequestCallback | null {
		return this.frameCallbacks.values().next().value ?? null;
	}
}

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
	timing: ManualInterruptionScreenTiming,
): Promise<ComponentInterruptionScreen> {
	const element = new ComponentInterruptionScreen( timing );
	element.copy = TestEnglishLocalizationBundle.interruption;

	return fixture<ComponentInterruptionScreen>( element );
}

describe( 'tocus-f-interruption-screen presentation timing', () => {
	it( 'reports locally displayed focused progress for persistence checkpoints', async () => {
		const timing = new ManualInterruptionScreenTiming();
		const element = new ComponentInterruptionScreen( timing );
		element.copy = TestEnglishLocalizationBundle.interruption;

		element.progressing = true;
		await fixture( element );
		timing.advance( 2_500 );

		assert.equal( element.getFocusedProgressMilliseconds(), 2_500 );
	} );

	it( 'advances normal breathing with animation frames and freezes in Waiting at completion', async () => {
		const timing = new ManualInterruptionScreenTiming();
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
		const timing = new ManualInterruptionScreenTiming();
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
		const timing = new ManualInterruptionScreenTiming();
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
		const timing = new ManualInterruptionScreenTiming();
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
		const timing = new ManualInterruptionScreenTiming();
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
		const timing = new ManualInterruptionScreenTiming();
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
		const timing = new ManualInterruptionScreenTiming();
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
		const timing = new ManualInterruptionScreenTiming();
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
		const timing = new ManualInterruptionScreenTiming();
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
		const timing = new ManualInterruptionScreenTiming();
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
