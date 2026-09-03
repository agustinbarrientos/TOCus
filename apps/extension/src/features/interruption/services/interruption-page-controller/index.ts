import {
	InterruptionPageRequestType,
	InterruptionPageResponseSchema,
	InterruptionPageResponseState,
	type InterruptionPageRequest,
	type InterruptionPageResponse,
} from '../../../protection-runtime/types/runtime-message';
import {
	InterruptionContinueRequestEventName,
	InterruptionScreenState,
} from '../../components/screen/types';
import {
	type InterruptionPageController,
	type InterruptionPageControllerOptions,
} from './types';

const CHECKPOINT_INTERVAL_MILLISECONDS = 1_000;

/**
 * Creates one interruption-page messaging and lifecycle coordinator.
 * @param options - Page, runtime, attention, and timing dependencies.
 * @return Interruption-page controller lifecycle.
 * @since 0.1.0 Initial implementation.
 */
export function createInterruptionPageController(
	options: InterruptionPageControllerOptions,
): InterruptionPageController {
	let checkpointIntervalHandle: number | null = null;
	let pendingRequest: InterruptionPageRequest | null = null;
	let requestOperation: Promise<void> | null = null;
	let readyExpiryTimeoutHandle: number | null = null;
	let observing = false;
	let windowFocused = false;
	let lifecycleGeneration = 0;

	/**
	 * Stops the recurring checkpoint when one is active.
	 * @since 0.1.0 Initial implementation.
	 */
	function stopCheckpointInterval(): void {
		if ( checkpointIntervalHandle === null ) {
			return;
		}

		options.scheduler.clearInterval( checkpointIntervalHandle );
		checkpointIntervalHandle = null;
	}

	/**
	 * Stops the one-shot Ready-state synchronization when one is active.
	 * @since 0.1.0 Initial implementation.
	 */
	function stopReadyExpiryTimeout(): void {
		if ( readyExpiryTimeoutHandle === null ) {
			return;
		}

		options.scheduler.clearTimeout( readyExpiryTimeoutHandle );
		readyExpiryTimeoutHandle = null;
	}

	/**
	 * Runs recurring checkpoints only while authoritative Waiting progress may advance.
	 * @since 0.1.0 Initial implementation.
	 */
	function synchronizeCheckpointInterval(): void {
		const shouldCheckpoint = observing &&
			windowFocused &&
			options.visibility.isDocumentVisible() &&
			options.screen.state === InterruptionScreenState.WAITING &&
			options.screen.progressing;

		if ( ! shouldCheckpoint ) {
			stopCheckpointInterval();
			return;
		}

		if ( checkpointIntervalHandle === null ) {
			checkpointIntervalHandle = options.scheduler.setInterval(
				handleSynchronizationRequest,
				CHECKPOINT_INTERVAL_MILLISECONDS,
			);
		}
	}

	/**
	 * Shows a distinct non-actionable presentation when runtime state is unavailable.
	 * @since 0.1.0 Initial implementation.
	 */
	function showUnavailable(): void {
		stopReadyExpiryTimeout();
		options.screen.progressing = false;
		options.screen.state = InterruptionScreenState.UNAVAILABLE;
		synchronizeCheckpointInterval();
	}

	/**
	 * Applies one validated authoritative runtime projection to the interruption screen.
	 * @param response - Validated interruption-page response.
	 * @since 0.1.0 Initial implementation.
	 */
	function applyResponse( response: InterruptionPageResponse ): void {
		if ( response.state === InterruptionPageResponseState.WAITING ) {
			stopReadyExpiryTimeout();
			options.screen.waitDurationMilliseconds = response.capturedWaitDurationMilliseconds;
			options.screen.focusedProgressMilliseconds = response.focusedProgressMilliseconds;
			options.screen.progressing = response.progressing;
			options.screen.state = InterruptionScreenState.WAITING;
			synchronizeCheckpointInterval();

			return;
		}

		options.screen.progressing = false;
		if ( response.state === InterruptionPageResponseState.READY ) {
			options.screen.state = InterruptionScreenState.READY;
			synchronizeCheckpointInterval();
			synchronizeReadyExpiryTimeout( response.allowanceExpiresAtEpochMilliseconds );
			return;
		}

		stopReadyExpiryTimeout();
		options.screen.state = response.state === InterruptionPageResponseState.READY_EXPIRED
			? InterruptionScreenState.READY_EXPIRED
			: InterruptionScreenState.UNAVAILABLE;
		synchronizeCheckpointInterval();
	}

	/**
	 * Sends and safely projects one interruption-page request.
	 * @param request - Validated request to send.
	 * @param generation - Controller lifecycle that owns the response.
	 * @return Promise resolved after one response or safe fallback is applied.
	 * @since 0.1.0 Initial implementation.
	 */
	async function sendRequest(
		request: InterruptionPageRequest,
		generation: number,
	): Promise<void> {
		try {
			const response = InterruptionPageResponseSchema.parse(
				await options.runtime.sendMessage( request ),
			);

			if ( ! observing || generation !== lifecycleGeneration ) {
				return;
			}

			applyResponse( response );
		} catch {
			if ( observing && generation === lifecycleGeneration ) {
				showUnavailable();
			}
		}
	}

	/**
	 * Starts the next retained request after the current operation settles.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleRequestCompletion(): void {
		const nextRequest = pendingRequest;

		pendingRequest = null;
		requestOperation = null;
		if ( nextRequest !== null ) {
			void startRequest( nextRequest );
		}
	}

	/**
	 * Sends one request as the sole active runtime operation.
	 * @param request - Validated request to send.
	 * @return Promise resolved after the request is projected.
	 * @since 0.1.0 Initial implementation.
	 */
	function startRequest( request: InterruptionPageRequest ): Promise<void> {
		const operation = sendRequest( request, lifecycleGeneration );

		requestOperation = operation;
		void operation.then( handleRequestCompletion );

		return operation;
	}

	/**
	 * Sends immediately or retains one request behind active messaging.
	 * @param request - Validated request to enqueue.
	 * @return Promise resolved after the operation active at submission time settles.
	 * @since 0.1.0 Initial implementation.
	 */
	function enqueueRequest( request: InterruptionPageRequest ): Promise<void> {
		if ( requestOperation === null ) {
			return startRequest( request );
		}

		if (
			request.type !== InterruptionPageRequestType.CONTINUE &&
			pendingRequest?.type === InterruptionPageRequestType.CONTINUE
		) {
			return requestOperation;
		}

		pendingRequest = request;

		return requestOperation;
	}

	/**
	 * Creates the current checkpoint or synchronization request for page state.
	 * @return Request carrying current visibility and any locally displayed Waiting progress.
	 * @since 0.1.0 Initial implementation.
	 */
	function createSynchronizationRequest(): InterruptionPageRequest {
		const documentVisible = options.visibility.isDocumentVisible();

		return options.screen.state === InterruptionScreenState.WAITING
			? {
				type: InterruptionPageRequestType.CHECKPOINT,
				documentVisible,
				displayedFocusedDurationMilliseconds: options.screen.getFocusedProgressMilliseconds(),
			}
			: {
				type: InterruptionPageRequestType.SYNCHRONIZE,
				documentVisible,
			};
	}

	/**
	 * Queues current progress or state synchronization after attention changes and timer ticks.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleSynchronizationRequest(): void {
		void enqueueRequest( createSynchronizationRequest() );
	}

	/**
	 * Pauses local checkpoints while document visibility is reconciled.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleDocumentVisibilityChange(): void {
		stopCheckpointInterval();
		handleSynchronizationRequest();
	}

	/**
	 * Stops local checkpoints as soon as the browser loses operating-system focus.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleWindowBlur(): void {
		windowFocused = false;
		stopCheckpointInterval();
		handleSynchronizationRequest();
	}

	/**
	 * Requests authoritative state when the browser regains operating-system focus.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleWindowFocus(): void {
		windowFocused = true;
		handleSynchronizationRequest();
	}

	/**
	 * Requests authoritative state when the locally scheduled Ready allowance expires.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleReadyExpiry(): void {
		readyExpiryTimeoutHandle = null;
		if ( ! observing || options.screen.state !== InterruptionScreenState.READY ) {
			return;
		}

		handleSynchronizationRequest();
	}

	/**
	 * Replaces any existing Ready expiry timeout with the current authoritative boundary.
	 * @param expiresAtEpochMilliseconds - Exact epoch time when the allowance ends.
	 * @since 0.1.0 Initial implementation.
	 */
	function synchronizeReadyExpiryTimeout( expiresAtEpochMilliseconds: number ): void {
		stopReadyExpiryTimeout();
		readyExpiryTimeoutHandle = options.scheduler.setTimeout(
			handleReadyExpiry,
			Math.max( 0, expiresAtEpochMilliseconds - options.clock.now() ),
		);
	}

	/**
	 * Projects the latest browser reduced-motion preference to the screen.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleMotionPreferenceChange(): void {
		options.screen.reducedMotion = options.motionPreference.matches;
	}

	/**
	 * Queues one explicit Continue request from the Ready screen.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleContinueRequest(): void {
		void enqueueRequest( {
			type: InterruptionPageRequestType.CONTINUE,
			documentVisible: options.visibility.isDocumentVisible(),
		} );
	}

	/**
	 * Connects the page and begins observing timing, attention, and motion preferences.
	 * @return Promise resolved after the initial authoritative projection.
	 * @since 0.1.0 Initial implementation.
	 */
	async function start(): Promise<void> {
		lifecycleGeneration += 1;
		observing = true;
		windowFocused = options.visibility.isWindowFocused();
		options.screen.progressing = false;
		options.screen.state = InterruptionScreenState.WAITING;
		options.motionPreference.addEventListener( 'change', handleMotionPreferenceChange );
		handleMotionPreferenceChange();
		options.documentTarget.addEventListener( 'visibilitychange', handleDocumentVisibilityChange );
		options.windowTarget.addEventListener( 'blur', handleWindowBlur );
		options.windowTarget.addEventListener( 'focus', handleWindowFocus );
		options.screen.addEventListener( InterruptionContinueRequestEventName, handleContinueRequest );
		await enqueueRequest( {
			type: InterruptionPageRequestType.CONNECT,
			documentVisible: options.visibility.isDocumentVisible(),
		} );
	}

	/**
	 * Stops scheduled work and releases every page listener.
	 * @since 0.1.0 Initial implementation.
	 */
	function stop(): void {
		lifecycleGeneration += 1;
		observing = false;
		pendingRequest = null;
		stopCheckpointInterval();
		stopReadyExpiryTimeout();
		options.motionPreference.removeEventListener( 'change', handleMotionPreferenceChange );
		options.documentTarget.removeEventListener( 'visibilitychange', handleDocumentVisibilityChange );
		options.windowTarget.removeEventListener( 'blur', handleWindowBlur );
		options.windowTarget.removeEventListener( 'focus', handleWindowFocus );
		options.screen.removeEventListener( InterruptionContinueRequestEventName, handleContinueRequest );
	}

	return { start, stop };
}

export * from './types';
