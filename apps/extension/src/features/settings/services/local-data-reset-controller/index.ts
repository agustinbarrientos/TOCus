import {
	LocalDataGenerationStorageKey,
	readLocalDataGeneration,
} from '../../../../domains/local-data/services/local-data-generation';
import { type ProtectionBackgroundMessageListener } from '../../../protection-runtime/services/protection-background-controller';
import { ResetAllDataRequestSchema } from '../privacy-data-actions';
import { type LocalDataResetController, type LocalDataResetControllerOptions } from './types';

/**
 * Owns authenticated full reset and incomplete-reset recovery in the background.
 * @param options - Local metadata, reset authority, and browser lifecycle boundaries.
 * @return Synchronous listener registration and startup completion.
 * @since 0.1.0 Initial implementation.
 */
export function createLocalDataResetController( options: LocalDataResetControllerOptions ): LocalDataResetController {
	let startup: Promise<boolean> | null = null;
	let pendingReset: Promise<boolean> | null = null;

	/**
	 * Reopens onboarding after clean startup, retaining retry intent if tab creation fails.
	 * @return Whether clean startup and any requested onboarding launch succeeded.
	 * @since 0.1.0 Initial implementation.
	 */
	async function finish(): Promise<boolean> {
		await options.resume();
		const marker = await readLocalDataGeneration( options.localArea );
		if ( marker?.needsOnboarding ) {
			await options.openOnboarding();
			await options.localArea.set( {
				[ LocalDataGenerationStorageKey ]: { ...marker, needsOnboarding: false },
			} );
		}
		return true;
	}

	/**
	 * Recovers pending deletion before permitting ordinary runtime initialization.
	 * @return Whether initial recovery and startup succeeded.
	 * @since 0.1.0 Initial implementation.
	 */
	async function recover(): Promise<boolean> {
		try {
			return await options.reset.recover() ? await finish() : false;
		} catch {
			return false;
		}
	}

	/**
	 * Performs one confirmed reset even when an earlier onboarding launch failed.
	 * @return Whether the requested operation completed successfully.
	 * @since 0.1.0 Initial implementation.
	 */
	async function reset(): Promise<boolean> {
		try {
			await startup;
			if ( ! await options.reset.reset() ) {
				return false;
			}
			return await finish();
		} catch {
			return false;
		}
	}

	/**
	 * Claims only explicit reset requests from the top-level extension settings page.
	 * @param input - Unknown message payload.
	 * @param sender - Browser-authenticated sending document.
	 * @param sendResponse - Response channel that may outlive its settings page.
	 * @return True only when this controller owns the asynchronous operation.
	 * @since 0.1.0 Initial implementation.
	 */
	const handleMessage: ProtectionBackgroundMessageListener = ( input, sender, sendResponse ) => {
		if ( sender.frameId !== 0 || sender.tab?.incognito === true ||
			sender.url?.split( '#' )[ 0 ] !== options.optionsPageUrl || ! ResetAllDataRequestSchema.safeParse( input ).success ) {
			return undefined;
		}
		pendingReset ??= reset().finally( () => {
			pendingReset = null;
		} );
		void pendingReset.then( ( result ) => {
			try {
				sendResponse( result );
			} catch {
				// Cleanup remains complete when the requesting settings page closes.
			}
		} );
		return true;
	};

	return {
		/**
		 * Registers requests synchronously before beginning asynchronous startup recovery.
		 * @since 0.1.0 Initial implementation.
		 */
		start(): void {
			if ( startup !== null ) {
				return;
			}
			options.onMessage.addListener( handleMessage );
			startup = recover();
		},
		/**
		 * Returns current initial reset recovery completion.
		 * @return Whether startup succeeded, or false before registration.
		 * @since 0.1.0 Initial implementation.
		 */
		waitUntilReady(): Promise<boolean> {
			return startup ?? Promise.resolve( false );
		},
	};
}

export * from './types';
