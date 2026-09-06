import { type LocalDataReset, type LocalDataResetArea } from '../../../../domains/local-data/services/local-data-reset';
import { type ProtectionBackgroundMessageListener } from '../../../protection-runtime/services/protection-background-controller';

/**
 * Synchronous extension message listener registration.
 * @since 0.1.0 Initial implementation.
 */
export interface LocalDataResetMessageEvent {
	/**
	 * Registers a handler before asynchronous recovery begins.
	 * @param listener - Authenticated local-data message handler.
	 * @since 0.1.0 Initial implementation.
	 */
	addListener( listener: ProtectionBackgroundMessageListener ): void;
}

/**
 * Authenticated browser messaging and reset lifecycle dependencies.
 * @since 0.1.0 Initial implementation.
 */
export interface LocalDataResetControllerOptions {
	/** Exact extension-owned settings page URL. */
	optionsPageUrl: string;
	/** Durable reset metadata boundary. */
	localArea: LocalDataResetArea;
	/** Serialized full deletion and crash recovery. */
	reset: LocalDataReset;
	/** Synchronously registered extension messaging. */
	onMessage: LocalDataResetMessageEvent;
	/**
	 * Clears cached authorities and restarts capability-aware protection after cleanup.
	 * @return Completion of clean runtime startup.
	 * @since 0.1.0 Initial implementation.
	 */
	resume(): Promise<void>;
	/**
	 * Opens the packaged onboarding page without requesting additional permissions.
	 * @return Completion of browser tab creation.
	 * @since 0.1.0 Initial implementation.
	 */
	openOnboarding(): Promise<void>;
}

/**
 * Synchronous reset request registration with asynchronous startup recovery.
 * @since 0.1.0 Initial implementation.
 */
export interface LocalDataResetController {
	/**
	 * Registers reset requests and starts recovery exactly once.
	 * @since 0.1.0 Initial implementation.
	 */
	start(): void;
	/**
	 * Waits for initial reset recovery and clean runtime startup.
	 * @return Whether startup completed successfully.
	 * @since 0.1.0 Initial implementation.
	 */
	waitUntilReady(): Promise<boolean>;
}
