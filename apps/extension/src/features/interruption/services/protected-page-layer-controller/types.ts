import { type AllowanceId } from '../../../../domains/protection/types/protection-value';
import { type ProtectedPagePresentationStatus } from '../../../protection-runtime/types/protected-page-message';
import { type InterruptionPageController } from '../interruption-page-controller';

/**
 * Epoch clock used to derive the local final allowance countdown.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectedPageLayerClock {
	/**
	 * Returns the current epoch time.
	 * @return Current epoch milliseconds.
	 * @since 0.1.0 Initial implementation.
	 */
	now(): number;
}

/**
 * Local scheduling operations used by the protected-page presentation.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectedPageLayerScheduler {
	/**
	 * Stops one recurring callback.
	 * @param handle - Browser interval handle.
	 * @since 0.1.0 Initial implementation.
	 */
	clearInterval( handle: number ): void;

	/**
	 * Stops one one-shot callback.
	 * @param handle - Browser timeout handle.
	 * @since 0.1.0 Initial implementation.
	 */
	clearTimeout( handle: number ): void;

	/**
	 * Starts one recurring callback.
	 * @param callback - Callback to execute.
	 * @param delayMilliseconds - Delay between executions.
	 * @return Browser interval handle.
	 * @since 0.1.0 Initial implementation.
	 */
	setInterval( callback: () => void, delayMilliseconds: number ): number;

	/**
	 * Starts one one-shot callback.
	 * @param callback - Callback to execute.
	 * @param delayMilliseconds - Delay before execution.
	 * @return Browser timeout handle.
	 * @since 0.1.0 Initial implementation.
	 */
	setTimeout( callback: () => void, delayMilliseconds: number ): number;
}

/**
 * Isolated view state controlled inside one protected top-level document.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectedPageLayerView {
	/** Whether the semantic modal interruption covers the live page. */
	interruptionLayerPresented: boolean;
	/** Whole final allowance seconds displayed by the quiet warning. */
	warningRemainingSeconds: number | null;

	/**
	 * Waits until a requested interruption is visibly mounted in the native top layer.
	 * @return Promise resolved after the interruption presentation becomes visible.
	 * @since 0.1.0 Initial implementation.
	 */
	waitForInterruptionPresentation(): Promise<void>;
}

/**
 * Dependencies used to coordinate one injected protected-page presentation.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectedPageLayerControllerOptions {
	/** Epoch clock used for exact warning expiry. */
	clock: ProtectedPageLayerClock;
	/** Existing authoritative wait controller reused inside the modal layer. */
	interruptionController: InterruptionPageController;
	/**
	 * Requests authoritative background reconciliation at one locally observed allowance expiry.
	 * @param allowanceId - Allowance identity that armed the local expiry guard.
	 * @return Promise resolved after the request is accepted by extension messaging.
	 * @since 0.1.0 Initial implementation.
	 */
	reconcileAllowanceExpiry( allowanceId: AllowanceId ): Promise<void>;
	/** Local timer operations released with the content lifecycle. */
	scheduler: ProtectedPageLayerScheduler;
	/** Isolated warning and modal presentation. */
	view: ProtectedPageLayerView;
}

/**
 * Injected protected-page message and timer coordinator.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectedPageLayerController {
	/**
	 * Handles one unknown protected-page command.
	 * @param input - Unknown browser message payload.
	 * @return Current status for a status request, otherwise undefined.
	 * @since 0.1.0 Initial implementation.
	 */
	handleMessage( input: unknown ): Promise<ProtectedPagePresentationStatus | undefined>;

	/**
	 * Releases warning timers and interruption listeners during content teardown.
	 * @since 0.1.0 Initial implementation.
	 */
	stop(): void;
}
