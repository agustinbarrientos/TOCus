import {
	ProtectedPageMessageSchema,
	ProtectedPageMessageType,
	type PresentAllowanceWarningMessage,
	type ProtectedPagePresentationStatus,
	type SynchronizeAllowanceExpiryGuardMessage,
} from '../../../protection-runtime/types/protected-page-message';
import {
	type ProtectedPageLayerController,
	type ProtectedPageLayerControllerOptions,
} from './types';

const WARNING_REFRESH_INTERVAL_MILLISECONDS = 1_000;

/**
 * Creates one injected warning and interruption-layer coordinator.
 * @param options - Clock, timers, view, and authoritative wait controller.
 * @return Protected-page message and teardown operations.
 * @since 0.1.0 Initial implementation.
 */
export function createProtectedPageLayerController(
	options: ProtectedPageLayerControllerOptions,
): ProtectedPageLayerController {
	let allowanceWarningId: ProtectedPagePresentationStatus[ 'allowanceWarningId' ] = null;
	let allowanceExpiryId: SynchronizeAllowanceExpiryGuardMessage[ 'allowanceId' ] | null = null;
	let allowanceExpiryEpochMilliseconds: number | null = null;
	let allowanceWarningStartEpochMilliseconds: number | null = null;
	let allowanceWarningEndEpochMilliseconds: number | null = null;
	let allowanceExpiryTimeoutHandle: number | null = null;
	let allowanceWarningTimeoutHandle: number | null = null;
	let allowanceWarningEndTimeoutHandle: number | null = null;
	let warningIntervalHandle: number | null = null;
	let interruptionControllerStarted = false;
	let interruptionPresentationGeneration = 0;

	/**
	 * Stops warning refreshes and clears the quiet warning presentation.
	 * @since 0.1.0 Initial implementation.
	 */
	function clearAllowanceWarning(): void {
		if ( allowanceWarningTimeoutHandle !== null ) {
			options.scheduler.clearTimeout( allowanceWarningTimeoutHandle );
			allowanceWarningTimeoutHandle = null;
		}

		if ( allowanceWarningEndTimeoutHandle !== null ) {
			options.scheduler.clearTimeout( allowanceWarningEndTimeoutHandle );
			allowanceWarningEndTimeoutHandle = null;
		}

		if ( warningIntervalHandle !== null ) {
			options.scheduler.clearInterval( warningIntervalHandle );
			warningIntervalHandle = null;
		}

		allowanceWarningId = null;
		options.view.warningRemainingSeconds = null;
	}

	/**
	 * Clears the current allowance-keyed local expiry guard and related warning.
	 * @since 0.1.0 Initial implementation.
	 */
	function clearAllowanceExpiryGuard(): void {
		if ( allowanceExpiryTimeoutHandle !== null ) {
			options.scheduler.clearTimeout( allowanceExpiryTimeoutHandle );
			allowanceExpiryTimeoutHandle = null;
		}

		allowanceExpiryId = null;
		allowanceExpiryEpochMilliseconds = null;
		allowanceWarningStartEpochMilliseconds = null;
		allowanceWarningEndEpochMilliseconds = null;
		clearAllowanceWarning();
	}

	/**
	 * Reports whether the warning timer or presentation matches the current warning boundary.
	 * @param nowEpochMilliseconds - Current wall-clock instant.
	 * @return Whether the warning portion of the guard is already synchronized.
	 * @since 0.1.0 Initial implementation.
	 */
	function isAllowanceWarningSynchronized( nowEpochMilliseconds: number ): boolean {
		if (
			allowanceWarningStartEpochMilliseconds === null ||
			allowanceWarningEndEpochMilliseconds === null
		) {
			return allowanceWarningTimeoutHandle === null &&
				allowanceWarningEndTimeoutHandle === null &&
				warningIntervalHandle === null &&
				allowanceWarningId === null;
		}

		if ( allowanceWarningStartEpochMilliseconds > nowEpochMilliseconds ) {
			return allowanceWarningTimeoutHandle !== null &&
				allowanceWarningEndTimeoutHandle === null &&
				warningIntervalHandle === null &&
				allowanceWarningId === null;
		}

		if ( allowanceWarningEndEpochMilliseconds <= nowEpochMilliseconds ) {
			clearAllowanceWarning();
			return true;
		}

		return allowanceWarningTimeoutHandle === null &&
			( allowanceWarningEndEpochMilliseconds === allowanceExpiryEpochMilliseconds
				? allowanceWarningEndTimeoutHandle === null
				: allowanceWarningEndTimeoutHandle !== null ) &&
			warningIntervalHandle !== null &&
			allowanceWarningId === allowanceExpiryId;
	}

	/**
	 * Absorbs a local expiry-reconciliation messaging failure while browser alarms remain available as fallback.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleAllowanceExpiryReconciliationFailure(): void {
		return;
	}

	/**
	 * Requests authoritative background reconciliation for one still-current local allowance expiry.
	 * @param expectedAllowanceId - Allowance identity captured by the scheduled callback.
	 * @param expectedExpiryEpochMilliseconds - Exact expiry captured by the scheduled callback.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleAllowanceExpiry(
		expectedAllowanceId: SynchronizeAllowanceExpiryGuardMessage[ 'allowanceId' ],
		expectedExpiryEpochMilliseconds: number,
	): void {
		if (
			allowanceExpiryId !== expectedAllowanceId ||
			allowanceExpiryEpochMilliseconds !== expectedExpiryEpochMilliseconds
		) {
			return;
		}

		clearAllowanceExpiryGuard();
		void options.reconcileAllowanceExpiry( expectedAllowanceId )
			.catch( handleAllowanceExpiryReconciliationFailure );
	}

	/**
	 * Refreshes the locally displayed whole-second allowance warning.
	 * @return Whether the warning remains active after the refresh.
	 * @since 0.1.0 Initial implementation.
	 */
	function refreshAllowanceWarning(): boolean {
		if ( allowanceWarningId === null || allowanceExpiryEpochMilliseconds === null ) {
			return false;
		}

		const nowEpochMilliseconds = options.clock.now();

		if (
			allowanceWarningEndEpochMilliseconds !== null &&
			allowanceWarningEndEpochMilliseconds <= nowEpochMilliseconds
		) {
			clearAllowanceWarning();
			return false;
		}

		const remainingMilliseconds = allowanceExpiryEpochMilliseconds - nowEpochMilliseconds;

		if ( remainingMilliseconds <= 0 ) {
			handleAllowanceExpiry( allowanceWarningId, allowanceExpiryEpochMilliseconds );
			return false;
		}

		options.view.warningRemainingSeconds = Math.ceil( remainingMilliseconds / 1_000 );

		return true;
	}

	/**
	 * Presents one allowance warning and starts its whole-second refresh interval.
	 * @param allowanceId - Allowance identity whose guard owns the warning.
	 * @since 0.1.0 Initial implementation.
	 */
	function activateAllowanceWarning(
		allowanceId: SynchronizeAllowanceExpiryGuardMessage[ 'allowanceId' ],
	): void {
		if ( allowanceExpiryId !== allowanceId || allowanceExpiryEpochMilliseconds === null ) {
			return;
		}
		const expiresAtEpochMilliseconds = allowanceExpiryEpochMilliseconds;
		const nowEpochMilliseconds = options.clock.now();

		if (
			( allowanceWarningStartEpochMilliseconds !== null &&
				allowanceWarningStartEpochMilliseconds > nowEpochMilliseconds ) ||
			( allowanceWarningEndEpochMilliseconds !== null &&
				allowanceWarningEndEpochMilliseconds <= nowEpochMilliseconds )
		) {
			clearAllowanceWarning();
			return;
		}

		clearAllowanceWarning();
		allowanceWarningId = allowanceId;
		if ( ! refreshAllowanceWarning() ) {
			return;
		}

		warningIntervalHandle = options.scheduler.setInterval(
			refreshAllowanceWarning,
			WARNING_REFRESH_INTERVAL_MILLISECONDS,
		);

		if (
			allowanceWarningEndEpochMilliseconds !== null &&
			allowanceWarningEndEpochMilliseconds < expiresAtEpochMilliseconds
		) {
			const warningEndsAtEpochMilliseconds = allowanceWarningEndEpochMilliseconds;

			allowanceWarningEndTimeoutHandle = options.scheduler.setTimeout(
				() => {
					handleAllowanceWarningEnd(
						allowanceId,
						expiresAtEpochMilliseconds,
						warningEndsAtEpochMilliseconds,
					);
				},
				warningEndsAtEpochMilliseconds - nowEpochMilliseconds,
			);
		}
	}

	/**
	 * Removes a still-current warning at the end of its schedule-eligible interval.
	 * @param expectedAllowanceId - Allowance identity captured by the timeout.
	 * @param expectedExpiryEpochMilliseconds - Exact expiry captured by the timeout.
	 * @param expectedWarningEndEpochMilliseconds - Exact warning end captured by the timeout.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleAllowanceWarningEnd(
		expectedAllowanceId: SynchronizeAllowanceExpiryGuardMessage[ 'allowanceId' ],
		expectedExpiryEpochMilliseconds: number,
		expectedWarningEndEpochMilliseconds: number,
	): void {
		if (
			allowanceExpiryId !== expectedAllowanceId ||
			allowanceExpiryEpochMilliseconds !== expectedExpiryEpochMilliseconds ||
			allowanceWarningEndEpochMilliseconds !== expectedWarningEndEpochMilliseconds
		) {
			return;
		}

		allowanceWarningEndTimeoutHandle = null;
		clearAllowanceWarning();
	}

	/**
	 * Activates a still-current warning boundary captured by a local timeout.
	 * @param expectedAllowanceId - Allowance identity captured by the timeout.
	 * @param expectedExpiryEpochMilliseconds - Exact expiry captured by the timeout.
	 * @param expectedWarningStartEpochMilliseconds - Exact warning boundary captured by the timeout.
	 * @param expectedWarningEndEpochMilliseconds - Exact warning end captured by the timeout.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleAllowanceWarningStart(
		expectedAllowanceId: SynchronizeAllowanceExpiryGuardMessage[ 'allowanceId' ],
		expectedExpiryEpochMilliseconds: number,
		expectedWarningStartEpochMilliseconds: number,
		expectedWarningEndEpochMilliseconds: number,
	): void {
		if (
			allowanceExpiryId !== expectedAllowanceId ||
			allowanceExpiryEpochMilliseconds !== expectedExpiryEpochMilliseconds ||
			allowanceWarningStartEpochMilliseconds !== expectedWarningStartEpochMilliseconds ||
			allowanceWarningEndEpochMilliseconds !== expectedWarningEndEpochMilliseconds
		) {
			return;
		}

		allowanceWarningTimeoutHandle = null;
		activateAllowanceWarning( expectedAllowanceId );
	}

	/**
	 * Arms one exact page-local expiry guard and its optional focused warning boundary.
	 * @param message - Validated allowance identity, expiry, and warning boundary.
	 * @since 0.1.0 Initial implementation.
	 */
	function synchronizeAllowanceExpiryGuard(
		message: SynchronizeAllowanceExpiryGuardMessage,
	): void {
		const nowEpochMilliseconds = options.clock.now();

		if (
			allowanceExpiryId === message.allowanceId &&
			allowanceExpiryEpochMilliseconds === message.expiresAtEpochMilliseconds &&
			allowanceWarningStartEpochMilliseconds === message.warningStartsAtEpochMilliseconds &&
			allowanceWarningEndEpochMilliseconds === message.warningEndsAtEpochMilliseconds &&
			allowanceExpiryTimeoutHandle !== null &&
			message.expiresAtEpochMilliseconds > nowEpochMilliseconds &&
			isAllowanceWarningSynchronized( nowEpochMilliseconds )
		) {
			return;
		}

		clearAllowanceExpiryGuard();
		allowanceExpiryId = message.allowanceId;
		allowanceExpiryEpochMilliseconds = message.expiresAtEpochMilliseconds;
		allowanceWarningStartEpochMilliseconds = message.warningStartsAtEpochMilliseconds;
		allowanceWarningEndEpochMilliseconds = message.warningEndsAtEpochMilliseconds;
		const remainingMilliseconds = message.expiresAtEpochMilliseconds - nowEpochMilliseconds;

		if ( remainingMilliseconds <= 0 ) {
			handleAllowanceExpiry( message.allowanceId, message.expiresAtEpochMilliseconds );
			return;
		}

		allowanceExpiryTimeoutHandle = options.scheduler.setTimeout(
			() => {
				handleAllowanceExpiry( message.allowanceId, message.expiresAtEpochMilliseconds );
			},
			remainingMilliseconds,
		);

		if (
			message.warningStartsAtEpochMilliseconds === null ||
			message.warningEndsAtEpochMilliseconds === null ||
			message.warningEndsAtEpochMilliseconds <= nowEpochMilliseconds
		) {
			return;
		}
		const warningStartsAtEpochMilliseconds = message.warningStartsAtEpochMilliseconds;
		const warningEndsAtEpochMilliseconds = message.warningEndsAtEpochMilliseconds;

		if ( warningStartsAtEpochMilliseconds <= nowEpochMilliseconds ) {
			handleAllowanceWarningStart(
				message.allowanceId,
				message.expiresAtEpochMilliseconds,
				warningStartsAtEpochMilliseconds,
				warningEndsAtEpochMilliseconds,
			);
			return;
		}

		allowanceWarningTimeoutHandle = options.scheduler.setTimeout(
			() => {
				handleAllowanceWarningStart(
					message.allowanceId,
					message.expiresAtEpochMilliseconds,
					warningStartsAtEpochMilliseconds,
					warningEndsAtEpochMilliseconds,
				);
			},
			warningStartsAtEpochMilliseconds - nowEpochMilliseconds,
		);
	}

	/**
	 * Presents one warning and schedules its exact local removal.
	 * @param message - Validated allowance warning command.
	 * @since 0.1.0 Initial implementation.
	 */
	function presentAllowanceWarning( message: PresentAllowanceWarningMessage ): void {
		if (
			allowanceExpiryId !== message.allowanceId ||
			allowanceExpiryEpochMilliseconds !== message.expiresAtEpochMilliseconds
		) {
			synchronizeAllowanceExpiryGuard( {
				type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
				allowanceId: message.allowanceId,
				expiresAtEpochMilliseconds: message.expiresAtEpochMilliseconds,
				warningStartsAtEpochMilliseconds: null,
				warningEndsAtEpochMilliseconds: null,
			} );
		}

		activateAllowanceWarning( message.allowanceId );
	}

	/**
	 * Recovers from a failed asynchronous wait connection when its presentation is still current.
	 * @param generation - Presentation generation associated with the failed connection.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleInterruptionStartFailure( generation: number ): void {
		if ( generation !== interruptionPresentationGeneration || ! interruptionControllerStarted ) {
			return;
		}

		interruptionControllerStarted = false;
		options.interruptionController.stop();
		options.view.interruptionLayerPresented = false;
	}

	/**
	 * Connects the authoritative wait only after its native modal is visibly mounted.
	 * @param generation - Presentation generation that owns the connection.
	 * @return Promise resolved after connection or stale-presentation cancellation.
	 * @since 0.1.0 Initial implementation.
	 */
	async function startInterruptionController( generation: number ): Promise<void> {
		try {
			await options.view.waitForInterruptionPresentation();
			if ( generation !== interruptionPresentationGeneration || ! interruptionControllerStarted ) {
				return;
			}

			await options.interruptionController.start();
		} catch {
			handleInterruptionStartFailure( generation );
		}
	}

	/**
	 * Presents the semantic modal and starts authoritative wait synchronization once.
	 * @since 0.1.0 Initial implementation.
	 */
	function presentInterruptionLayer(): void {
		clearAllowanceExpiryGuard();
		if ( interruptionControllerStarted ) {
			return;
		}

		interruptionPresentationGeneration += 1;
		const generation = interruptionPresentationGeneration;

		interruptionControllerStarted = true;
		options.view.interruptionLayerPresented = true;
		void startInterruptionController( generation );
	}

	/**
	 * Stops authoritative synchronization and uncovers the preserved live document.
	 * @since 0.1.0 Initial implementation.
	 */
	function removeInterruptionLayer(): void {
		if ( ! interruptionControllerStarted ) {
			return;
		}

		interruptionPresentationGeneration += 1;
		interruptionControllerStarted = false;
		options.interruptionController.stop();
		options.view.interruptionLayerPresented = false;
	}

	/**
	 * Creates the current non-sensitive content presentation status.
	 * @return Current warning identity and modal visibility.
	 * @since 0.1.0 Initial implementation.
	 */
	function createPresentationStatus(): ProtectedPagePresentationStatus {
		return {
			allowanceWarningId,
			interruptionLayerPresented: interruptionControllerStarted,
		};
	}

	/**
	 * Handles one unknown protected-page command.
	 * @param input - Unknown browser message payload.
	 * @return Current status for a status request, otherwise undefined.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleMessage(
		input: unknown,
	): Promise<ProtectedPagePresentationStatus | undefined> {
		const result = ProtectedPageMessageSchema.safeParse( input );

		if ( ! result.success ) {
			return Promise.resolve( undefined );
		}

		switch ( result.data.type ) {
			case ProtectedPageMessageType.GET_PRESENTATION_STATUS:
				return Promise.resolve( createPresentationStatus() );

			case ProtectedPageMessageType.PRESENT_ALLOWANCE_WARNING:
				presentAllowanceWarning( result.data );
				return Promise.resolve( undefined );

			case ProtectedPageMessageType.REMOVE_ALLOWANCE_WARNING:
				if ( allowanceWarningId === result.data.allowanceId ) {
					clearAllowanceWarning();
				}
				return Promise.resolve( undefined );

			case ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD:
				synchronizeAllowanceExpiryGuard( result.data );
				return Promise.resolve( undefined );

			case ProtectedPageMessageType.REMOVE_ALLOWANCE_EXPIRY_GUARD:
				clearAllowanceExpiryGuard();
				return Promise.resolve( undefined );

			case ProtectedPageMessageType.PRESENT_INTERRUPTION_LAYER:
				presentInterruptionLayer();
				return Promise.resolve( undefined );

			case ProtectedPageMessageType.REMOVE_INTERRUPTION_LAYER:
				removeInterruptionLayer();
				return Promise.resolve( undefined );
		}
	}

	/**
	 * Releases every local presentation resource during content teardown.
	 * @since 0.1.0 Initial implementation.
	 */
	function stop(): void {
		clearAllowanceExpiryGuard();
		removeInterruptionLayer();
	}

	return { handleMessage, stop };
}

export * from './types';
