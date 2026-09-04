import { ProtectionConfigurationDocumentSchema } from '../../../../domains/protection/types/protected-site-configuration';
import { type StatisticsDocument } from '../../../../domains/statistics/types/statistics-document';
import {
	StatisticsSessionDocumentSchema,
	type StatisticsSessionDocument,
} from '../../../../domains/statistics/types/statistics-session';
import {
	prepareStatisticsCheckpoint,
	prepareStatisticsPendingReplay,
	StatisticsFocusObservationMode,
	type StatisticsFocusEpochTransition,
	type StatisticsFocusObservationMode as StatisticsFocusObservationModeValue,
} from '../../../../domains/statistics/utils/prepare-statistics-checkpoint';
import { resolveFocusedAllowance } from '../../utils/resolve-focused-allowance';
import {
	type StatisticsFocusReplayResult,
	type StatisticsFocusSession,
	type StatisticsFocusSessionOptions,
	type StatisticsFocusCheckpointInput,
} from './types';

/**
 * Creates crash-safe persistence for focus-session measurements.
 * @param options - Local and session persistence dependencies.
 * @return Focus-session operations serialized by the statistics runtime.
 * @since 0.1.0 Initial implementation.
 */
export function createStatisticsFocusSession(
	options: StatisticsFocusSessionOptions,
): StatisticsFocusSession {
	let statisticsSession: StatisticsSessionDocument | null = null;
	let sessionStorageAvailable = false;
	let sessionStateKnown = false;
	let focusDiscardPending = false;

	/**
	 * Persists one compact session document or removes the owned key when empty.
	 * @param document - Next compact session work, or null when no work remains.
	 * @return Promise settled after the exact session persistence operation.
	 * @since 0.1.0 Initial implementation.
	 */
	function persistStatisticsSession(
		document: StatisticsSessionDocument | null,
	): Promise<void> {
		return document === null
			? options.sessionStorage.remove()
			: options.sessionStorage.save( document );
	}

	/**
	 * Persists focus continuity before any asynchronous browser inspection begins.
	 * @param mode - Relationship between the observation and browser focus state.
	 * @return Focus epoch context, or null when session persistence is unavailable.
	 * @since 0.1.0 Initial implementation.
	 */
	async function beginFocusObservation(
		mode: StatisticsFocusObservationModeValue,
	): Promise<StatisticsFocusEpochTransition | null> {
		try {
			if ( mode === StatisticsFocusObservationMode.BOUNDARY ) {
				return {
					mode,
					...await options.sessionStorage.rotateFocusEpoch(),
				};
			}

			const currentFocusEpochId = await options.sessionStorage.getOrCreateFocusEpoch();

			return {
				mode,
				previousFocusEpochId: mode === StatisticsFocusObservationMode.STARTUP
					? null
					: currentFocusEpochId,
				currentFocusEpochId,
			};
		} catch {
			focusDiscardPending = true;
			return null;
		}
	}

	/**
	 * Replays already-frozen session work before any fact can replace its allowance.
	 * @param statisticsDocument - Current reconciled local statistics document.
	 * @return Replay result containing the current aggregate document and completion state.
	 * @since 0.1.0 Initial implementation.
	 */
	async function replayPendingInterval(
		statisticsDocument: StatisticsDocument,
	): Promise<StatisticsFocusReplayResult> {
		if ( ! sessionStateKnown ) {
			return { statisticsDocument, succeeded: false };
		}

		const currentSession = statisticsSession;
		const pendingInterval = currentSession?.pendingInterval;

		if ( currentSession === null || pendingInterval === undefined ) {
			return { statisticsDocument, succeeded: true };
		}

		let preparedReplay;

		try {
			preparedReplay = prepareStatisticsPendingReplay( {
				statisticsDocument,
				statisticsSession: currentSession,
			} );
			await options.storage.save( preparedReplay.statisticsDocument );
		} catch {
			return { statisticsDocument, succeeded: false };
		}

		const nextStatisticsDocument = preparedReplay.statisticsDocument;

		try {
			await persistStatisticsSession( preparedReplay.statisticsSession );
		} catch {
			sessionStorageAvailable = false;
			return { statisticsDocument: nextStatisticsDocument, succeeded: false };
		}

		statisticsSession = preparedReplay.statisticsSession;
		sessionStorageAvailable = true;

		return { statisticsDocument: nextStatisticsDocument, succeeded: true };
	}

	/**
	 * Loads compatible session work and immediately replays any frozen interval.
	 * @param statisticsDocument - Current reconciled local statistics document.
	 * @return Current aggregate document after any successful pending replay.
	 * @since 0.1.0 Initial implementation.
	 */
	async function initialize(
		statisticsDocument: StatisticsDocument,
	): Promise<StatisticsDocument> {
		statisticsSession = null;
		sessionStorageAvailable = false;
		sessionStateKnown = false;

		try {
			if ( focusDiscardPending ) {
				statisticsSession = await options.sessionStorage.discardFocusAnchor();
				focusDiscardPending = false;
				sessionStateKnown = true;
				sessionStorageAvailable = true;

				if ( statisticsSession === null ) {
					return statisticsDocument;
				}

				const replay = await replayPendingInterval( statisticsDocument );
				sessionStorageAvailable = replay.succeeded;

				return replay.statisticsDocument;
			}

			const sessionContinuityId = options.getSessionContinuityId();

			if ( sessionContinuityId === null ) {
				return statisticsDocument;
			}

			const focusEpochId = await options.sessionStorage.getOrCreateFocusEpoch();
			const loadedSession = await options.sessionStorage.load(
				statisticsDocument,
				sessionContinuityId,
				focusEpochId,
			);
			const parsedSession = loadedSession === null
				? null
				: StatisticsSessionDocumentSchema.safeParse( loadedSession );

			if ( parsedSession !== null && ! parsedSession.success ) {
				return statisticsDocument;
			}

			statisticsSession = parsedSession?.data ?? null;
			sessionStateKnown = true;
			const replay = await replayPendingInterval( statisticsDocument );
			sessionStorageAvailable = replay.succeeded;

			return replay.statisticsDocument;
		} catch {
			return statisticsDocument;
		}
	}

	/**
	 * Closes any retained anchor after focus cannot be observed safely.
	 * @return Promise resolved after the contained session-removal attempt.
	 * @since 0.1.0 Initial implementation.
	 */
	async function closeFocusAnchor(): Promise<void> {
		if ( ! sessionStateKnown || statisticsSession === null ) {
			return;
		}

		try {
			statisticsSession = await options.sessionStorage.discardFocusAnchor();
			sessionStorageAvailable = true;
		} catch {
			sessionStorageAvailable = false;
		}
	}

	/**
	 * Removes retained focus work even before aggregate statistics have initialized.
	 * @return Promise resolved after the contained session-storage attempt.
	 * @since 0.1.0 Initial implementation.
	 */
	async function discardFocusMeasurement(): Promise<void> {
		focusDiscardPending = true;

		try {
			statisticsSession = await options.sessionStorage.discardFocusAnchor();
			focusDiscardPending = false;
			sessionStateKnown = true;
			sessionStorageAvailable = true;
		} catch {
			statisticsSession = null;
			sessionStateKnown = false;
			sessionStorageAvailable = false;
		}
	}

	/**
	 * Recovers a known session write failure by discarding its unfrozen anchor.
	 * @param statisticsDocument - Current initialized local statistics document.
	 * @return Replay result containing the current aggregate document and recovery state.
	 * @since 0.1.0 Initial implementation.
	 */
	async function recover(
		statisticsDocument: StatisticsDocument,
	): Promise<StatisticsFocusReplayResult> {
		if ( sessionStorageAvailable ) {
			return { statisticsDocument, succeeded: true };
		}

		try {
			statisticsSession = await options.sessionStorage.discardFocusAnchor();
			sessionStateKnown = true;
			sessionStorageAvailable = true;

			return statisticsSession === null
				? { statisticsDocument, succeeded: true }
				: await replayPendingInterval( statisticsDocument );
		} catch {
			return { statisticsDocument, succeeded: false };
		}
	}

	/**
	 * Checkpoints focused allowance work after aggregate initialization.
	 * @param input - Current statistics, privacy-filtered configuration, delivery state, and focus observation.
	 * @return Current aggregate document after any successful focused-use persistence.
	 * @since 0.1.0 Initial implementation.
	 */
	async function checkpoint(
		input: StatisticsFocusCheckpointInput,
	): Promise<StatisticsDocument> {
		let currentStatisticsDocument = input.statisticsDocument;
		const replay = await replayPendingInterval( currentStatisticsDocument );

		currentStatisticsDocument = replay.statisticsDocument;

		if ( ! replay.succeeded ) {
			return currentStatisticsDocument;
		}

		if ( ! input.deliveryComplete || ! sessionStateKnown ) {
			await closeFocusAnchor();
			return currentStatisticsDocument;
		}

		const recovery = await recover( currentStatisticsDocument );

		currentStatisticsDocument = recovery.statisticsDocument;

		if ( ! recovery.succeeded ) {
			return currentStatisticsDocument;
		}

		const parsedConfiguration = ProtectionConfigurationDocumentSchema.safeParse(
			input.configuration,
		);

		if ( ! parsedConfiguration.success ) {
			await closeFocusAnchor();
			return currentStatisticsDocument;
		}

		const nowEpochMilliseconds = input.observation.observedAtEpochMilliseconds;
		const sessionContinuityId = options.getSessionContinuityId();

		if (
			nowEpochMilliseconds === null ||
			! Number.isSafeInteger( nowEpochMilliseconds ) ||
			nowEpochMilliseconds < 0 ||
			input.observation.focusEpochTransition === null ||
			sessionContinuityId === null
		) {
			await closeFocusAnchor();
			return currentStatisticsDocument;
		}

		const focusObservation = input.observation.focusObservation;
		const focusEpochTransition = input.observation.focusEpochTransition;
		const focusedAtEpochMilliseconds = focusObservation === null
			? nowEpochMilliseconds
			: focusObservation.focusedAtEpochMilliseconds;

		if (
			focusObservation === null &&
			focusEpochTransition.mode !== StatisticsFocusObservationMode.BOUNDARY
		) {
			await closeFocusAnchor();
			return currentStatisticsDocument;
		}

		if (
			! Number.isSafeInteger( focusedAtEpochMilliseconds ) ||
			focusedAtEpochMilliseconds < nowEpochMilliseconds
		) {
			await closeFocusAnchor();
			return currentStatisticsDocument;
		}

		let focusedAllowance: ReturnType<typeof resolveFocusedAllowance> = null;

		if ( focusObservation !== null ) {
			try {
				focusedAllowance = resolveFocusedAllowance( {
					configuration: parsedConfiguration.data,
					statisticsDocument: currentStatisticsDocument,
					statesByScope: focusObservation.statesByScope,
					focusedTabId: focusObservation.focusedTabId,
					nowEpochMilliseconds: focusedAtEpochMilliseconds,
					tabs: focusObservation.tabs,
					...( focusObservation.navigation === undefined
						? {}
						: { navigation: focusObservation.navigation } ),
				} );
			} catch {
				await closeFocusAnchor();
				return currentStatisticsDocument;
			}
		}

		let preparedCheckpoint;

		try {
			preparedCheckpoint = prepareStatisticsCheckpoint( {
				sessionContinuityId,
				focusEpochTransition: input.observation.focusEpochTransition,
				statisticsDocument: currentStatisticsDocument,
				statisticsSession,
				focusedAllowance,
				focusedAtEpochMilliseconds,
				nowEpochMilliseconds,
			} );
		} catch {
			await closeFocusAnchor();
			return currentStatisticsDocument;
		}

		if ( preparedCheckpoint.writeAheadSession !== undefined ) {
			try {
				await persistStatisticsSession( preparedCheckpoint.writeAheadSession );
				statisticsSession = preparedCheckpoint.writeAheadSession;
			} catch {
				sessionStorageAvailable = false;
				return currentStatisticsDocument;
			}
		}

		if ( preparedCheckpoint.shouldSaveStatistics ) {
			try {
				await options.storage.save( preparedCheckpoint.statisticsDocument );
				currentStatisticsDocument = preparedCheckpoint.statisticsDocument;
			} catch {
				return currentStatisticsDocument;
			}
		}

		if ( ! preparedCheckpoint.shouldPersistFinalSession ) {
			return currentStatisticsDocument;
		}

		try {
			await persistStatisticsSession( preparedCheckpoint.finalSession );
			statisticsSession = preparedCheckpoint.finalSession;
			sessionStorageAvailable = true;
		} catch {
			sessionStorageAvailable = false;
		}

		return currentStatisticsDocument;
	}

	/**
	 * Returns whether focus measurement can safely persist new work.
	 * @return True when the session storage is currently available.
	 * @since 0.1.0 Initial implementation.
	 */
	function isAvailable(): boolean {
		return sessionStorageAvailable;
	}

	/**
	 * Returns whether session work has been loaded or deliberately discarded.
	 * @return True when current session state is known.
	 * @since 0.1.0 Initial implementation.
	 */
	function isStateKnown(): boolean {
		return sessionStateKnown;
	}

	/**
	 * Disables focus work and requires retained anchors to be discarded before reuse.
	 * @since 0.1.0 Initial implementation.
	 */
	function markUnavailable(): void {
		focusDiscardPending = true;
		statisticsSession = null;
		sessionStorageAvailable = false;
		sessionStateKnown = false;
	}

	/**
	 * Clears every retained focus-session measurement safely.
	 * @return True only after session persistence is empty and ready for new work.
	 * @since 0.1.0 Initial implementation.
	 */
	async function reset(): Promise<boolean> {
		try {
			await options.sessionStorage.remove();
		} catch {
			sessionStorageAvailable = false;
			return false;
		}

		statisticsSession = null;
		focusDiscardPending = false;
		sessionStateKnown = true;
		sessionStorageAvailable = true;

		return true;
	}

	return {
		beginFocusObservation,
		checkpoint,
		discardFocusMeasurement,
		initialize,
		isAvailable,
		isStateKnown,
		markUnavailable,
		replayPendingInterval,
		reset,
	};
}

export * from './types';
