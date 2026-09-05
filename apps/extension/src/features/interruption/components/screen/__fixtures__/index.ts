import {
	type ManualInterruptionScreenEnvironment,
	type ScheduledInterruptionScreenCallback,
} from './types';

/**
 * Deterministic attention and timing environment for interruption-screen tests.
 * @since 0.1.0 Initial implementation.
 */
class ManualInterruptionScreenEnvironmentFixture implements ManualInterruptionScreenEnvironment {
	private currentTimeMilliseconds = 0;

	private documentVisible = true;

	private windowFocused = true;

	private nextHandle = 1;

	private readonly frameCallbacks = new Map<number, FrameRequestCallback>();

	private readonly timerCallbacks = new Map<number, ScheduledInterruptionScreenCallback>();

	/**
	 * Returns deterministic monotonic time.
	 * @return Current test time in milliseconds.
	 * @since 0.1.0 Initial implementation.
	 */
	now(): number {
		return this.currentTimeMilliseconds;
	}

	/**
	 * Reports deterministic document visibility.
	 * @return Whether focused progress may advance.
	 * @since 0.1.0 Initial implementation.
	 */
	isDocumentVisible(): boolean {
		return this.documentVisible;
	}

	/**
	 * Reports deterministic window focus.
	 * @return Whether focused progress may advance.
	 * @since 0.1.0 Initial implementation.
	 */
	isWindowFocused(): boolean {
		return this.windowFocused;
	}

	/**
	 * Queues one deterministic animation frame.
	 * @param callback - Frame callback to retain.
	 * @return Deterministic callback handle.
	 * @since 0.1.0 Initial implementation.
	 */
	requestAnimationFrame( callback: FrameRequestCallback ): number {
		const handle = this.nextHandle;

		this.nextHandle += 1;
		this.frameCallbacks.set( handle, callback );

		return handle;
	}

	/**
	 * Cancels one deterministic animation frame.
	 * @param handle - Frame callback handle.
	 * @since 0.1.0 Initial implementation.
	 */
	cancelAnimationFrame( handle: number ): void {
		this.frameCallbacks.delete( handle );
	}

	/**
	 * Queues one deterministic timeout.
	 * @param callback - Timeout callback to retain.
	 * @param delayMilliseconds - Delay from current test time.
	 * @return Deterministic callback handle.
	 * @since 0.1.0 Initial implementation.
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
	 * Cancels one deterministic timeout.
	 * @param handle - Timeout callback handle.
	 * @since 0.1.0 Initial implementation.
	 */
	clearTimeout( handle: number ): void {
		this.timerCallbacks.delete( handle );
	}

	/**
	 * Moves deterministic time without executing callbacks.
	 * @param milliseconds - Nonnegative time to advance.
	 * @since 0.1.0 Initial implementation.
	 */
	elapse( milliseconds: number ): void {
		this.currentTimeMilliseconds += milliseconds;
	}

	/**
	 * Advances deterministic time and runs callbacks already due.
	 * @param milliseconds - Nonnegative time to advance.
	 * @since 0.1.0 Initial implementation.
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

		const frames = Array.from( this.frameCallbacks.values() );

		this.frameCallbacks.clear();
		for ( const frame of frames ) {
			frame( this.currentTimeMilliseconds );
		}
	}

	/**
	 * Changes document visibility and emits the real lifecycle event.
	 * @param visible - New document visibility.
	 * @since 0.1.0 Initial implementation.
	 */
	setDocumentVisible( visible: boolean ): void {
		this.documentVisible = visible;
		document.dispatchEvent( new Event( 'visibilitychange' ) );
	}

	/**
	 * Changes window focus and emits the real lifecycle event.
	 * @param focused - New window focus.
	 * @since 0.1.0 Initial implementation.
	 */
	setWindowFocused( focused: boolean ): void {
		this.windowFocused = focused;
		window.dispatchEvent( new Event( focused ? 'focus' : 'blur' ) );
	}

	/**
	 * Returns the number of queued animation frames.
	 * @return Queued frame count.
	 * @since 0.1.0 Initial implementation.
	 */
	getFrameCount(): number {
		return this.frameCallbacks.size;
	}

	/**
	 * Returns the number of queued timeout callbacks.
	 * @return Queued timeout count.
	 * @since 0.1.0 Initial implementation.
	 */
	getTimerCount(): number {
		return this.timerCallbacks.size;
	}

	/**
	 * Returns the delay until the next queued timeout.
	 * @return Next delay or null when no timeout is queued.
	 * @since 0.1.0 Initial implementation.
	 */
	getNextTimerDelayMilliseconds(): number | null {
		const timer = this.timerCallbacks.values().next().value;

		return timer === undefined
			? null
			: timer.dueMilliseconds - this.currentTimeMilliseconds;
	}

	/**
	 * Captures the next queued frame callback without changing cancellation behavior.
	 * @return Queued frame callback or null when none exists.
	 * @since 0.1.0 Initial implementation.
	 */
	getNextFrameCallback(): FrameRequestCallback | null {
		return this.frameCallbacks.values().next().value ?? null;
	}
}

/**
 * Creates one controllable interruption-screen timing environment.
 * @return Deterministic test environment.
 * @since 0.1.0 Initial implementation.
 */
export function createManualInterruptionScreenEnvironment(): ManualInterruptionScreenEnvironment {
	return new ManualInterruptionScreenEnvironmentFixture();
}

export {
	type ManualInterruptionScreenEnvironment,
	type ScheduledInterruptionScreenCallback,
} from './types';
