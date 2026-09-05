import { describe, expect, it } from 'vitest';
import { createFocusedProgressClock } from './index';
import {
	FocusedProgressClockTransition,
	type FocusedProgressClockInput,
	type FocusedProgressClockTiming,
} from './types';

/**
 * One timeout retained by the deterministic service test clock.
 */
interface ScheduledTestTimeout {
	callback: () => void;
	dueMilliseconds: number;
}

/**
 * Deterministic timing environment for focused-progress clock tests.
 */
class ManualFocusedProgressClockTiming implements FocusedProgressClockTiming {
	private currentTimeMilliseconds = 0;

	private nextHandle = 1;

	private readonly frameCallbacks = new Map<number, FrameRequestCallback>();

	private readonly timeoutCallbacks = new Map<number, ScheduledTestTimeout>();

	/**
	 * Returns the deterministic monotonic time.
	 * @return Current test time.
	 */
	now(): number {
		return this.currentTimeMilliseconds;
	}

	/**
	 * Queues one deterministic animation frame.
	 * @param callback - Frame callback to retain.
	 * @return Deterministic frame handle.
	 */
	requestAnimationFrame( callback: FrameRequestCallback ): number {
		const handle = this.nextHandle;

		this.nextHandle += 1;
		this.frameCallbacks.set( handle, callback );

		return handle;
	}

	/**
	 * Cancels one deterministic animation frame.
	 * @param handle - Frame handle to cancel.
	 */
	cancelAnimationFrame( handle: number ): void {
		this.frameCallbacks.delete( handle );
	}

	/**
	 * Queues one deterministic timeout.
	 * @param callback - Timeout callback to retain.
	 * @param delayMilliseconds - Delay from the current test time.
	 * @return Deterministic timeout handle.
	 */
	setTimeout( callback: () => void, delayMilliseconds: number ): number {
		const handle = this.nextHandle;

		this.nextHandle += 1;
		this.timeoutCallbacks.set( handle, {
			callback,
			dueMilliseconds: this.currentTimeMilliseconds + delayMilliseconds,
		} );

		return handle;
	}

	/**
	 * Cancels one deterministic timeout.
	 * @param handle - Timeout handle to cancel.
	 */
	clearTimeout( handle: number ): void {
		this.timeoutCallbacks.delete( handle );
	}

	/**
	 * Moves time without executing callbacks.
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

		const dueTimeouts = Array.from( this.timeoutCallbacks.entries() )
			.filter( ( [ , timeout ] ) => timeout.dueMilliseconds <= this.currentTimeMilliseconds );

		for ( const [ handle, timeout ] of dueTimeouts ) {
			this.timeoutCallbacks.delete( handle );
			timeout.callback();
		}

		const frames = Array.from( this.frameCallbacks.values() );

		this.frameCallbacks.clear();
		for ( const frame of frames ) {
			frame( this.currentTimeMilliseconds );
		}
	}

	/**
	 * Returns the number of queued animation frames.
	 * @return Queued frame count.
	 */
	getFrameCount(): number {
		return this.frameCallbacks.size;
	}

	/**
	 * Returns the number of queued timeouts.
	 * @return Queued timeout count.
	 */
	getTimeoutCount(): number {
		return this.timeoutCallbacks.size;
	}

	/**
	 * Returns the delay until the next queued timeout.
	 * @return Next timeout delay or null.
	 */
	getNextTimeoutDelayMilliseconds(): number | null {
		const timeout = this.timeoutCallbacks.values().next().value;

		return timeout === undefined
			? null
			: timeout.dueMilliseconds - this.currentTimeMilliseconds;
	}

	/**
	 * Captures the next queued frame callback.
	 * @return Queued callback or null.
	 */
	getNextFrameCallback(): FrameRequestCallback | null {
		return this.frameCallbacks.values().next().value ?? null;
	}

	/**
	 * Captures the next queued timeout callback.
	 * @return Queued callback or null.
	 */
	getNextTimeoutCallback(): ( () => void ) | null {
		return this.timeoutCallbacks.values().next().value?.callback ?? null;
	}
}

/**
 * Creates one complete clock input with focused active Waiting defaults.
 * @param overrides - Input values overriding the defaults.
 * @return Complete focused-progress clock input.
 */
function createInput( overrides: Partial<FocusedProgressClockInput> = {} ): FocusedProgressClockInput {
	return {
		authoritativeProgressMilliseconds: 0,
		continuous: true,
		documentVisible: true,
		durationMilliseconds: 10_000,
		looping: false,
		progressing: true,
		waiting: true,
		windowFocused: true,
		...overrides,
	};
}

/**
 * Ignores one displayed-progress notification in tests that inspect clock state directly.
 * @return Always undefined.
 */
function ignoreProgressUpdate(): void {
	return undefined;
}

describe( 'createFocusedProgressClock', () => {
	it( 'advances continuously and freezes at the captured duration', () => {
		const timing = new ManualFocusedProgressClockTiming();
		let progressUpdateCount = 0;
		/**
		 * Counts one displayed-progress notification.
		 */
		function countProgressUpdate(): void {
			progressUpdateCount += 1;
		}
		const clock = createFocusedProgressClock( {
			onProgress: countProgressUpdate,
			timing,
		} );

		expect( clock.connect( createInput() ) ).toBeNull();
		expect( timing.getFrameCount() ).toBe( 1 );
		expect(
			clock.update( createInput(), { reanchor: false, reset: false } ),
		).toBeNull();
		expect( timing.getFrameCount() ).toBe( 1 );
		timing.advance( 10_000 );

		expect( clock.getProgressMilliseconds() ).toBe( 10_000 );
		expect( timing.getFrameCount() ).toBe( 0 );
		expect( progressUpdateCount ).toBe( 1 );
	} );

	it( 'wraps preview progress and keeps its clock active', () => {
		const timing = new ManualFocusedProgressClockTiming();
		const clock = createFocusedProgressClock( { onProgress: ignoreProgressUpdate, timing } );

		clock.connect( createInput( { looping: true } ) );
		timing.advance( 10_000 );

		expect( clock.getProgressMilliseconds() ).toBe( 0 );
		expect( timing.getFrameCount() ).toBe( 1 );

		timing.advance( 750 );

		expect( clock.getProgressMilliseconds() ).toBe( 750 );
		expect( timing.getFrameCount() ).toBe( 1 );
	} );

	it( 'loops a discrete Quiet preview without scheduling a zero-delay timeout', () => {
		const timing = new ManualFocusedProgressClockTiming();
		const clock = createFocusedProgressClock( { onProgress: ignoreProgressUpdate, timing } );

		clock.connect( createInput( { continuous: false, looping: true } ) );

		expect( timing.getNextTimeoutDelayMilliseconds() ).toBe( 1_000 );
		timing.advance( 10_000 );

		expect( clock.getProgressMilliseconds() ).toBe( 0 );
		expect( timing.getTimeoutCount() ).toBe( 1 );
		expect( timing.getNextTimeoutDelayMilliseconds() ).toBe( 1_000 );
	} );

	it( 'aligns discrete updates to the next displayed-second boundary', () => {
		const timing = new ManualFocusedProgressClockTiming();
		const clock = createFocusedProgressClock( { onProgress: ignoreProgressUpdate, timing } );

		clock.connect( createInput( {
			authoritativeProgressMilliseconds: 750,
			continuous: false,
		} ) );

		expect( timing.getFrameCount() ).toBe( 0 );
		expect( timing.getNextTimeoutDelayMilliseconds() ).toBe( 250 );
		timing.advance( 250 );
		expect( clock.getProgressMilliseconds() ).toBe( 1_000 );
		expect( timing.getNextTimeoutDelayMilliseconds() ).toBe( 1_000 );
		clock.disconnect();
		expect( timing.getTimeoutCount() ).toBe( 0 );
	} );

	it( 'clamps invalid and out-of-range authoritative progress', () => {
		const timing = new ManualFocusedProgressClockTiming();
		const clock = createFocusedProgressClock( { onProgress: ignoreProgressUpdate, timing } );

		clock.connect( createInput( {
			authoritativeProgressMilliseconds: Number.NaN,
			progressing: false,
		} ) );
		expect( clock.getProgressMilliseconds() ).toBe( 0 );

		clock.update(
			createInput( { authoritativeProgressMilliseconds: -1, progressing: false } ),
			{ reanchor: true, reset: false },
		);
		expect( clock.getProgressMilliseconds() ).toBe( 0 );

		clock.update(
			createInput( { authoritativeProgressMilliseconds: 20_000, progressing: false } ),
			{ reanchor: true, reset: false },
		);
		expect( clock.getProgressMilliseconds() ).toBe( 10_000 );
	} );

	it( 'coalesces attention pauses and excludes their elapsed time', () => {
		const timing = new ManualFocusedProgressClockTiming();
		const clock = createFocusedProgressClock( { onProgress: ignoreProgressUpdate, timing } );

		clock.connect( createInput() );
		timing.advance( 1_000 );
		expect(
			clock.update( createInput( { windowFocused: false } ), { reanchor: false, reset: false } ),
		).toBe( FocusedProgressClockTransition.PAUSED );
		expect(
			clock.update(
				createInput( { documentVisible: false, windowFocused: false } ),
				{ reanchor: false, reset: false },
			),
		).toBeNull();

		timing.elapse( 5_000 );
		expect(
			clock.update( createInput(), { reanchor: false, reset: false } ),
		).toBe( FocusedProgressClockTransition.RESUMED );
		timing.advance( 1_000 );

		expect( clock.getProgressMilliseconds() ).toBe( 2_000 );
	} );

	it( 'reanchors authoritative progress after synchronizing an active interval', () => {
		const timing = new ManualFocusedProgressClockTiming();
		const clock = createFocusedProgressClock( { onProgress: ignoreProgressUpdate, timing } );

		clock.connect( createInput() );
		timing.elapse( 1_500 );
		expect(
			clock.update( createInput( { progressing: false } ), { reanchor: false, reset: false } ),
		).toBe( FocusedProgressClockTransition.PAUSED );
		expect( clock.getProgressMilliseconds() ).toBe( 1_500 );

		clock.update(
			createInput( { authoritativeProgressMilliseconds: 6_000, progressing: false } ),
			{ reanchor: true, reset: false },
		);
		expect( clock.getProgressMilliseconds() ).toBe( 6_000 );
	} );

	it( 'restarts after disconnection without counting detached time', () => {
		const timing = new ManualFocusedProgressClockTiming();
		const clock = createFocusedProgressClock( { onProgress: ignoreProgressUpdate, timing } );

		clock.connect( createInput() );
		clock.disconnect();
		timing.elapse( 5_000 );

		expect( clock.connect( createInput() ) ).toBe( FocusedProgressClockTransition.RESUMED );
		expect( clock.getProgressMilliseconds() ).toBe( 0 );
		expect( timing.getFrameCount() ).toBe( 1 );
	} );

	it( 'treats a new Waiting interval as a fresh start after another state', () => {
		const timing = new ManualFocusedProgressClockTiming();
		const clock = createFocusedProgressClock( { onProgress: ignoreProgressUpdate, timing } );

		clock.connect( createInput() );
		timing.advance( 10_000 );
		expect( clock.getProgressMilliseconds() ).toBe( 10_000 );
		expect(
			clock.update( createInput( { waiting: false } ), { reanchor: false, reset: false } ),
		).toBeNull();
		expect(
			clock.update( createInput(), { reanchor: false, reset: true } ),
		).toBeNull();
		expect( clock.getProgressMilliseconds() ).toBe( 0 );
		expect( timing.getFrameCount() ).toBe( 1 );
	} );

	it( 'does not restart when updated after disconnection', () => {
		const timing = new ManualFocusedProgressClockTiming();
		const clock = createFocusedProgressClock( { onProgress: ignoreProgressUpdate, timing } );

		clock.connect( createInput() );
		clock.disconnect();
		clock.update( createInput(), { reanchor: false, reset: false } );

		expect( timing.getFrameCount() ).toBe( 0 );
	} );

	it( 'ignores a cancelled frame that arrives after Waiting ends', () => {
		const timing = new ManualFocusedProgressClockTiming();
		const clock = createFocusedProgressClock( { onProgress: ignoreProgressUpdate, timing } );

		clock.connect( createInput() );
		const staleFrame = timing.getNextFrameCallback();

		expect( staleFrame ).not.toBeNull();
		clock.update( createInput( { waiting: false } ), { reanchor: false, reset: false } );
		staleFrame?.( timing.now() );

		expect( clock.getProgressMilliseconds() ).toBe( 0 );
		expect( timing.getFrameCount() ).toBe( 0 );
	} );

	it( 'ignores a cancelled frame that arrives after an active reschedule', () => {
		const timing = new ManualFocusedProgressClockTiming();
		const clock = createFocusedProgressClock( { onProgress: ignoreProgressUpdate, timing } );

		clock.connect( createInput() );
		const staleFrame = timing.getNextFrameCallback();

		expect( staleFrame ).not.toBeNull();
		clock.update( createInput(), { reanchor: false, reset: false } );
		expect( timing.getFrameCount() ).toBe( 1 );
		staleFrame?.( timing.now() );

		expect( timing.getFrameCount() ).toBe( 1 );
	} );

	it( 'ignores a cancelled timeout that arrives after an active reschedule', () => {
		const timing = new ManualFocusedProgressClockTiming();
		const clock = createFocusedProgressClock( { onProgress: ignoreProgressUpdate, timing } );
		const input = createInput( { continuous: false } );

		clock.connect( input );
		const staleTimeout = timing.getNextTimeoutCallback();

		expect( staleTimeout ).not.toBeNull();
		clock.update( input, { reanchor: false, reset: false } );
		expect( timing.getTimeoutCount() ).toBe( 1 );
		staleTimeout?.();

		expect( timing.getTimeoutCount() ).toBe( 1 );
	} );
} );
