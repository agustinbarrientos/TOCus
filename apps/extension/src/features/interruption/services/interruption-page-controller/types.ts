import { type InterruptionScreenState } from '../../components/screen/types';
import { type InterruptionPageRequest } from '../../../protection-runtime/types/runtime-message';

/**
 * Minimal interruption-screen surface coordinated by the extension page.
 * @since 0.1.0 Initial implementation.
 */
export interface InterruptionPageScreen extends EventTarget {
	/** Authoritative presentation state. */
	state: InterruptionScreenState;

	/** Captured duration of the current wait. */
	waitDurationMilliseconds: number;

	/** Latest authoritative focused progress. */
	focusedProgressMilliseconds: number;

	/** Whether local focused progress may advance. */
	progressing: boolean;

	/** Whether continuous visual motion is disabled. */
	reducedMotion: boolean;

	/** Whether an explicit recovery request is currently pending. */
	recovering: boolean;

	/**
	 * Returns the focused progress currently displayed by the local presentation clock.
	 * @return Displayed focused progress in milliseconds.
	 * @since 0.1.0 Initial implementation.
	 */
	getFocusedProgressMilliseconds(): number;
}

/**
 * Epoch clock used to schedule authoritative Ready-state synchronization.
 * @since 0.1.0 Initial implementation.
 */
export interface InterruptionPageClock {
	/**
	 * Returns current epoch time.
	 * @return Current epoch milliseconds.
	 * @since 0.1.0 Initial implementation.
	 */
	now(): number;
}

/**
 * Browser reduced-motion preference observed by the interruption page.
 * @since 0.1.0 Initial implementation.
 */
export interface InterruptionPageMotionPreference {
	/** Whether reduced motion is currently preferred. */
	readonly matches: boolean;

	/**
	 * Begins observing effective reduced-motion changes.
	 * @param type - Effective motion change event name.
	 * @param listener - Effective motion change listener.
	 * @since 0.1.0 Initial implementation.
	 */
	addEventListener( type: 'change', listener: EventListenerOrEventListenerObject ): void;

	/**
	 * Stops observing effective reduced-motion changes.
	 * @param type - Effective motion change event name.
	 * @param listener - Effective motion change listener.
	 * @since 0.1.0 Initial implementation.
	 */
	removeEventListener( type: 'change', listener: EventListenerOrEventListenerObject ): void;
}

/**
 * Runtime message boundary used by the interruption page.
 * @since 0.1.0 Initial implementation.
 */
export interface InterruptionPageRuntime {
	/**
	 * Sends one validated interruption-page request to the background runtime.
	 * @param request - Interruption-page request.
	 * @return Unknown response awaiting local validation.
	 * @since 0.1.0 Initial implementation.
	 */
	sendMessage( request: InterruptionPageRequest ): Promise<unknown>;
}

/**
 * Timing operations used for progress checkpoints and allowance expiry.
 * @since 0.1.0 Initial implementation.
 */
export interface InterruptionPageScheduler {
	/**
	 * Starts one recurring callback.
	 * @param callback - Callback to execute.
	 * @param delayMilliseconds - Delay between executions.
	 * @return Browser interval handle.
	 * @since 0.1.0 Initial implementation.
	 */
	setInterval( callback: () => void, delayMilliseconds: number ): number;

	/**
	 * Stops one recurring callback.
	 * @param handle - Browser interval handle.
	 * @since 0.1.0 Initial implementation.
	 */
	clearInterval( handle: number ): void;

	/**
	 * Starts one one-shot callback.
	 * @param callback - Callback to execute.
	 * @param delayMilliseconds - Delay before execution.
	 * @return Browser timeout handle.
	 * @since 0.1.0 Initial implementation.
	 */
	setTimeout( callback: () => void, delayMilliseconds: number ): number;

	/**
	 * Stops one one-shot callback.
	 * @param handle - Browser timeout handle.
	 * @since 0.1.0 Initial implementation.
	 */
	clearTimeout( handle: number ): void;
}

/**
 * Current document and browser-window visibility used by focused progress.
 * @since 0.1.0 Initial implementation.
 */
export interface InterruptionPageVisibility {
	/**
	 * Reports whether the interruption document is visible.
	 * @return Current document visibility.
	 * @since 0.1.0 Initial implementation.
	 */
	isDocumentVisible(): boolean;

	/**
	 * Reports whether the browser window currently owns operating-system focus.
	 * @return Whether the browser window is focused.
	 * @since 0.1.0 Initial implementation.
	 */
	isWindowFocused(): boolean;
}

/**
 * Dependencies used by one interruption-page controller.
 * @since 0.1.0 Initial implementation.
 */
export interface InterruptionPageControllerOptions {
	/** Epoch clock used for exact allowance-expiry scheduling. */
	clock: InterruptionPageClock;

	/** Document lifecycle event target. */
	documentTarget: EventTarget;

	/** Browser reduced-motion preference observed by the page. */
	motionPreference: InterruptionPageMotionPreference;

	/** Background runtime message boundary. */
	runtime: InterruptionPageRuntime;

	/** Page timing scheduler. */
	scheduler: InterruptionPageScheduler;

	/** Interruption presentation controlled by runtime responses. */
	screen: InterruptionPageScreen;

	/** Current document and browser-window visibility projection. */
	visibility: InterruptionPageVisibility;

	/** Browser-window attention event target. */
	windowTarget: EventTarget;
}

/**
 * Interruption-page messaging and lifecycle coordinator.
 * @since 0.1.0 Initial implementation.
 */
export interface InterruptionPageController {
	/**
	 * Connects the page and begins observing timing, attention, and motion preferences.
	 * @return Promise resolved after the initial authoritative projection.
	 * @since 0.1.0 Initial implementation.
	 */
	start(): Promise<void>;

	/**
	 * Stops scheduled work and releases every page listener.
	 * @since 0.1.0 Initial implementation.
	 */
	stop(): void;
}
