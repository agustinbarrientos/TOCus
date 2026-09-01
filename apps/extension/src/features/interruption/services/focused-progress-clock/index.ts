import {
	FocusedProgressClockTransition,
	type FocusedProgressClock,
	type FocusedProgressClockInput,
	type FocusedProgressClockOptions,
	type FocusedProgressClockTransition as FocusedProgressClockTransitionValue,
	type FocusedProgressClockUpdateOptions,
} from './types';

/**
 * Restricts displayed progress to one captured duration.
 * @param progressMilliseconds - Progress received from the presentation owner.
 * @param durationMilliseconds - Captured wait duration.
 * @return Safe displayed progress.
 */
function clampProgress( progressMilliseconds: number, durationMilliseconds: number ): number {
	if ( ! Number.isFinite( progressMilliseconds ) ) {
		return 0;
	}

	return Math.max( 0, Math.min( durationMilliseconds, progressMilliseconds ) );
}

/**
 * Creates a presentation-only clock that advances while its screen remains focused.
 * @param options - Timing and update dependencies.
 * @return Focused-progress clock lifecycle.
 * @since 0.1.0 Initial implementation.
 */
export function createFocusedProgressClock(
	options: FocusedProgressClockOptions,
): FocusedProgressClock {
	let input: FocusedProgressClockInput = {
		authoritativeProgressMilliseconds: 0,
		continuous: false,
		documentVisible: false,
		durationMilliseconds: 0,
		progressing: false,
		waiting: false,
		windowFocused: false,
	};
	let connected = false;
	let initialized = false;
	let displayedProgressMilliseconds = 0;
	let animationFrameHandle: number | null = null;
	let timeoutHandle: number | null = null;
	let callbackGeneration = 0;
	let lastProgressTimestampMilliseconds = 0;
	let advancing = false;
	let hasAdvanced = false;

	/**
	 * Cancels every callback currently owned by the clock.
	 */
	function cancelScheduledProgressUpdate(): void {
		callbackGeneration += 1;
		if ( animationFrameHandle !== null ) {
			options.timing.cancelAnimationFrame( animationFrameHandle );
			animationFrameHandle = null;
		}

		if ( timeoutHandle !== null ) {
			options.timing.clearTimeout( timeoutHandle );
			timeoutHandle = null;
		}
	}

	/**
	 * Adds active monotonic time to displayed focused progress.
	 * @param nowMilliseconds - Current monotonic presentation time.
	 */
	function synchronize( nowMilliseconds: number ): void {
		if ( ! advancing ) {
			return;
		}

		const elapsedMilliseconds = Math.max(
			0,
			nowMilliseconds - lastProgressTimestampMilliseconds,
		);

		displayedProgressMilliseconds = clampProgress(
			displayedProgressMilliseconds + elapsedMilliseconds,
			input.durationMilliseconds,
		);
		lastProgressTimestampMilliseconds = nowMilliseconds;
	}

	/**
	 * Reports whether local visual progress can currently advance.
	 * @return Whether the clock is in one active focused Waiting interval.
	 */
	function canAdvance(): boolean {
		return connected &&
			input.waiting &&
			input.progressing &&
			input.documentVisible &&
			input.windowFocused &&
			displayedProgressMilliseconds < input.durationMilliseconds;
	}

	/**
	 * Applies one scheduled progress update and queues its successor when needed.
	 * @param nowMilliseconds - Current monotonic presentation time.
	 */
	function runScheduledProgressUpdate( nowMilliseconds: number ): void {
		synchronize( nowMilliseconds );
		options.onProgress();
		if ( ! canAdvance() ) {
			advancing = false;
			lastProgressTimestampMilliseconds = 0;

			return;
		}

		scheduleProgressUpdate();
	}

	/**
	 * Schedules the next continuous frame or discrete countdown boundary.
	 */
	function scheduleProgressUpdate(): void {
		callbackGeneration += 1;
		const scheduledGeneration = callbackGeneration;

		/**
		 * Advances the current continuously animated frame.
		 * @param nowMilliseconds - Monotonic animation-frame timestamp.
		 */
		function handleScheduledAnimationFrame( nowMilliseconds: number ): void {
			if ( scheduledGeneration !== callbackGeneration ) {
				return;
			}

			animationFrameHandle = null;
			runScheduledProgressUpdate( nowMilliseconds );
		}

		/**
		 * Advances the current discrete countdown update.
		 */
		function handleScheduledDiscreteProgressUpdate(): void {
			if ( scheduledGeneration !== callbackGeneration ) {
				return;
			}

			timeoutHandle = null;
			runScheduledProgressUpdate( options.timing.now() );
		}

		if ( input.continuous ) {
			animationFrameHandle = options.timing.requestAnimationFrame(
				handleScheduledAnimationFrame,
			);

			return;
		}

		const remainingMilliseconds = input.durationMilliseconds - displayedProgressMilliseconds;
		const boundaryRemainderMilliseconds = remainingMilliseconds % 1_000;
		const delayMilliseconds = boundaryRemainderMilliseconds === 0
			? Math.min( 1_000, remainingMilliseconds )
			: boundaryRemainderMilliseconds;

		timeoutHandle = options.timing.setTimeout(
			handleScheduledDiscreteProgressUpdate,
			delayMilliseconds,
		);
	}

	/**
	 * Reconciles scheduling and returns any user-facing pause transition.
	 * @param nowMilliseconds - Current monotonic presentation time.
	 * @return Pause-state transition produced by reconciliation.
	 */
	function refresh(
		nowMilliseconds: number,
	): FocusedProgressClockTransitionValue | null {
		const wasAdvancing = advancing;
		const shouldAdvance = canAdvance();

		cancelScheduledProgressUpdate();
		if ( ! shouldAdvance ) {
			advancing = false;
			lastProgressTimestampMilliseconds = 0;
			if (
				wasAdvancing &&
				input.waiting &&
				displayedProgressMilliseconds < input.durationMilliseconds
			) {
				return FocusedProgressClockTransition.PAUSED;
			}

			return null;
		}

		advancing = true;
		lastProgressTimestampMilliseconds = nowMilliseconds;
		if ( ! wasAdvancing ) {
			if ( hasAdvanced ) {
				scheduleProgressUpdate();

				return FocusedProgressClockTransition.RESUMED;
			}

			hasAdvanced = true;
		}

		scheduleProgressUpdate();

		return null;
	}

	/**
	 * Connects the clock with current presentation conditions.
	 * @param nextInput - Current presentation conditions.
	 * @return Pause-state transition produced by the connection.
	 */
	function connect(
		nextInput: FocusedProgressClockInput,
	): FocusedProgressClockTransitionValue | null {
		if ( ! initialized ) {
			displayedProgressMilliseconds = clampProgress(
				nextInput.authoritativeProgressMilliseconds,
				nextInput.durationMilliseconds,
			);
			initialized = true;
		}

		input = nextInput;
		connected = true;

		return refresh( options.timing.now() );
	}

	/**
	 * Disconnects the clock and releases every scheduled callback.
	 */
	function disconnect(): void {
		synchronize( options.timing.now() );
		connected = false;
		advancing = false;
		lastProgressTimestampMilliseconds = 0;
		cancelScheduledProgressUpdate();
	}

	/**
	 * Returns the locally displayed focused progress.
	 * @return Displayed focused progress in milliseconds.
	 */
	function getProgressMilliseconds(): number {
		return displayedProgressMilliseconds;
	}

	/**
	 * Reconciles changed presentation conditions.
	 * @param nextInput - Current presentation conditions.
	 * @param updateOptions - Reconciliation behavior for this update.
	 * @return Pause-state transition produced by the update.
	 */
	function update(
		nextInput: FocusedProgressClockInput,
		updateOptions: FocusedProgressClockUpdateOptions,
	): FocusedProgressClockTransitionValue | null {
		const nowMilliseconds = options.timing.now();

		synchronize( nowMilliseconds );
		if ( updateOptions.reanchor || updateOptions.reset ) {
			displayedProgressMilliseconds = clampProgress(
				nextInput.authoritativeProgressMilliseconds,
				nextInput.durationMilliseconds,
			);
		}

		if ( updateOptions.reset ) {
			hasAdvanced = false;
		}

		input = nextInput;

		return refresh( nowMilliseconds );
	}

	return {
		connect,
		disconnect,
		getProgressMilliseconds,
		update,
	};
}

export {
	FocusedProgressClockTransition,
	type FocusedProgressClock,
	type FocusedProgressClockInput,
	type FocusedProgressClockOptions,
	type FocusedProgressClockTiming,
	type FocusedProgressClockUpdateOptions,
} from './types';
