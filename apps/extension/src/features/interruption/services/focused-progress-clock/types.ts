/**
 * Clock transition that affects the screen's polite announcement.
 * @since 0.1.0 Initial implementation.
 */
export const FocusedProgressClockTransition = {
	PAUSED: 'paused',
	RESUMED: 'resumed',
} as const;

/**
 * Clock transition that affects the screen's polite announcement.
 * @since 0.1.0 Initial implementation.
 */
export type FocusedProgressClockTransition = typeof FocusedProgressClockTransition[
	keyof typeof FocusedProgressClockTransition
];

/**
 * Current presentation conditions consumed by the focused-progress clock.
 * @since 0.1.0 Initial implementation.
 */
export interface FocusedProgressClockInput {
	/** Latest focused progress received from the presentation owner. */
	authoritativeProgressMilliseconds: number;

	/** Whether the next update should use animation frames instead of a discrete timer. */
	continuous: boolean;

	/** Whether the document is visible. */
	documentVisible: boolean;

	/** Captured duration represented by this clock. */
	durationMilliseconds: number;

	/** Whether the presentation owner currently permits local interpolation. */
	progressing: boolean;

	/** Whether the authoritative presentation remains in its Waiting state. */
	waiting: boolean;

	/** Whether the browser window is focused. */
	windowFocused: boolean;
}

/**
 * Browser timing dependencies used by one focused-progress clock.
 * @since 0.1.0 Initial implementation.
 */
export interface FocusedProgressClockTiming {
	/**
	 * Cancels one scheduled animation frame.
	 * @param handle - Frame handle to cancel.
	 * @since 0.1.0 Initial implementation.
	 */
	cancelAnimationFrame( handle: number ): void;

	/**
	 * Cancels one scheduled timeout.
	 * @param handle - Timeout handle to cancel.
	 * @since 0.1.0 Initial implementation.
	 */
	clearTimeout( handle: number ): void;

	/**
	 * Returns the current monotonic presentation time.
	 * @return Monotonic milliseconds.
	 * @since 0.1.0 Initial implementation.
	 */
	now(): number;

	/**
	 * Schedules one animation frame.
	 * @param callback - Callback for the next frame.
	 * @return Frame handle.
	 * @since 0.1.0 Initial implementation.
	 */
	requestAnimationFrame( callback: FrameRequestCallback ): number;

	/**
	 * Schedules one timeout.
	 * @param callback - Callback to run after the delay.
	 * @param delayMilliseconds - Delay before the callback.
	 * @return Timeout handle.
	 * @since 0.1.0 Initial implementation.
	 */
	setTimeout( callback: () => void, delayMilliseconds: number ): number;
}

/**
 * Options applied when presentation conditions change.
 * @since 0.1.0 Initial implementation.
 */
export interface FocusedProgressClockUpdateOptions {
	/** Whether authoritative focused progress replaces the displayed value. */
	reanchor: boolean;

	/** Whether this update starts a distinct Waiting interval at authoritative progress. */
	reset: boolean;
}

/**
 * Dependencies used to create one focused-progress clock.
 * @since 0.1.0 Initial implementation.
 */
export interface FocusedProgressClockOptions {
	/** Requests a presentation update after the displayed progress changes. */
	onProgress: () => void;

	/** Browser timing operations owned by the clock. */
	timing: FocusedProgressClockTiming;
}

/**
 * Local focused-progress clock owned by one interruption screen.
 * @since 0.1.0 Initial implementation.
 */
export interface FocusedProgressClock {
	/**
	 * Connects the clock with current presentation conditions.
	 * @param input - Current presentation conditions.
	 * @return Pause-state transition produced by the connection.
	 * @since 0.1.0 Initial implementation.
	 */
	connect( input: FocusedProgressClockInput ): FocusedProgressClockTransition | null;

	/**
	 * Disconnects the clock and releases every scheduled callback.
	 * @since 0.1.0 Initial implementation.
	 */
	disconnect(): void;

	/**
	 * Returns the locally displayed focused progress.
	 * @return Displayed focused progress in milliseconds.
	 * @since 0.1.0 Initial implementation.
	 */
	getProgressMilliseconds(): number;

	/**
	 * Reconciles changed presentation conditions.
	 * @param input - Current presentation conditions.
	 * @param options - Reconciliation behavior for this update.
	 * @return Pause-state transition produced by the update.
	 * @since 0.1.0 Initial implementation.
	 */
	update(
		input: FocusedProgressClockInput,
		options: FocusedProgressClockUpdateOptions,
	): FocusedProgressClockTransition | null;
}
