import { type InterruptionScreenEnvironment } from '../types';

/**
 * Callback and due time retained by one deterministic interruption-screen timeout.
 * @since 0.1.0 Initial implementation.
 */
export interface ScheduledInterruptionScreenCallback {
	/**
	 * Callback invoked when deterministic time reaches the deadline.
	 * @since 0.1.0 Initial implementation.
	 */
	callback: () => void;

	/**
	 * Deterministic deadline in milliseconds.
	 * @since 0.1.0 Initial implementation.
	 */
	dueMilliseconds: number;
}

/**
 * Controllable environment used by interruption-screen timing tests.
 * @since 0.1.0 Initial implementation.
 */
export interface ManualInterruptionScreenEnvironment extends InterruptionScreenEnvironment {
	/**
	 * Moves deterministic time without executing callbacks.
	 * @param milliseconds - Nonnegative time to advance.
	 * @since 0.1.0 Initial implementation.
	 */
	elapse( milliseconds: number ): void;

	/**
	 * Advances deterministic time and executes callbacks already due.
	 * @param milliseconds - Nonnegative time to advance.
	 * @since 0.1.0 Initial implementation.
	 */
	advance( milliseconds: number ): void;

	/**
	 * Changes document visibility and emits the real lifecycle event.
	 * @param visible - New document visibility.
	 * @since 0.1.0 Initial implementation.
	 */
	setDocumentVisible( visible: boolean ): void;

	/**
	 * Changes window focus and emits the real lifecycle event.
	 * @param focused - New window focus.
	 * @since 0.1.0 Initial implementation.
	 */
	setWindowFocused( focused: boolean ): void;

	/**
	 * Returns the number of queued animation frames.
	 * @return Queued frame count.
	 * @since 0.1.0 Initial implementation.
	 */
	getFrameCount(): number;

	/**
	 * Returns the number of queued timeout callbacks.
	 * @return Queued timeout count.
	 * @since 0.1.0 Initial implementation.
	 */
	getTimerCount(): number;

	/**
	 * Returns the delay until the next queued timeout.
	 * @return Next delay or null when no timeout is queued.
	 * @since 0.1.0 Initial implementation.
	 */
	getNextTimerDelayMilliseconds(): number | null;

	/**
	 * Captures the next queued frame callback without changing cancellation behavior.
	 * @return Queued frame callback or null when none exists.
	 * @since 0.1.0 Initial implementation.
	 */
	getNextFrameCallback(): FrameRequestCallback | null;
}
