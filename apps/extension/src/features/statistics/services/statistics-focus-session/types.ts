import { type ProtectionCoordinatorStateSnapshot } from '../../../../domains/protection/services/protection-coordinator';
import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { type SessionContinuityId } from '../../../../domains/protection/types/protection-value';
import { type StatisticsSessionStorageService } from '../../../../domains/statistics/services/statistics-session-storage';
import { type StatisticsStorageService } from '../../../../domains/statistics/services/statistics-storage';
import { type StatisticsDocument } from '../../../../domains/statistics/types/statistics-document';
import {
	type StatisticsFocusEpochTransition,
	type StatisticsFocusObservationMode,
} from '../../../../domains/statistics/utils/prepare-statistics-checkpoint';
import {
	type ProtectionRuntimeNavigation,
	type ProtectionRuntimeTab,
} from '../../../protection-runtime/types/browser-runtime';

/**
 * Browser and protection state captured at one trustworthy observation boundary.
 * @since 0.1.0 Initial implementation.
 */
export interface StatisticsCheckpointFocusObservation {
	/** Wall-clock time captured only after browser focus inspection completed. */
	focusedAtEpochMilliseconds: number;
	/** Browser tab that had focus, or null while no browser window had focus. */
	focusedTabId: number | null;
	/** Authoritative protection state captured with the browser observation. */
	statesByScope: ProtectionCoordinatorStateSnapshot;
	/** Open tabs captured before later browser events could change focus. */
	tabs: ReadonlyArray<ProtectionRuntimeTab>;
	/** Top-level navigation that produced this observation, when applicable. */
	navigation?: ProtectionRuntimeNavigation;
}

/**
 * Event-time input consumed later by serialized statistics persistence.
 * @since 0.1.0 Initial implementation.
 */
export interface StatisticsCheckpointObservation {
	/** Wall-clock time captured at the protection event, or null when unsafe. */
	observedAtEpochMilliseconds: number | null;
	/** Complete focus observation, or null when any required boundary failed. */
	focusObservation: StatisticsCheckpointFocusObservation | null;
	/** Focus epoch context persisted before browser state was inspected. */
	focusEpochTransition: StatisticsFocusEpochTransition | null;
}

/**
 * Dependencies used by crash-safe focus-session persistence.
 * @since 0.1.0 Initial implementation.
 */
export interface StatisticsFocusSessionOptions {
	storage: StatisticsStorageService;
	sessionStorage: StatisticsSessionStorageService;

	/**
	 * Reads the current browser-session continuity identifier.
	 * @return Current continuity identifier, or null before protection initializes.
	 * @since 0.1.0 Initial implementation.
	 */
	getSessionContinuityId(): SessionContinuityId | null;
}

/**
 * Result of replaying any crash-safe pending focus interval.
 * @since 0.1.0 Initial implementation.
 */
export interface StatisticsFocusReplayResult {
	statisticsDocument: StatisticsDocument;
	succeeded: boolean;
}

/**
 * Inputs used to persist one focused-allowance checkpoint.
 * @since 0.1.0 Initial implementation.
 */
export interface StatisticsFocusCheckpointInput {
	configuration: ProtectionConfigurationDocument | null;
	statisticsDocument: StatisticsDocument;
	observation: StatisticsCheckpointObservation;
	deliveryComplete: boolean;
}

/**
 * Stateful crash-safe focus-session persistence operations.
 * @since 0.1.0 Initial implementation.
 */
export interface StatisticsFocusSession {
	/**
	 * Persists focus continuity before any asynchronous browser inspection begins.
	 * @param mode - Relationship between the observation and browser focus state.
	 * @return Focus epoch context, or null when session persistence is unavailable.
	 * @since 0.1.0 Initial implementation.
	 */
	beginFocusObservation( mode: StatisticsFocusObservationMode ): Promise<StatisticsFocusEpochTransition | null>;

	/**
	 * Checkpoints focused allowance work after aggregate initialization.
	 * @param input - Current statistics, privacy-filtered configuration, delivery state, and focus observation.
	 * @return Current aggregate document after any successful focused-use persistence.
	 * @since 0.1.0 Initial implementation.
	 */
	checkpoint( input: StatisticsFocusCheckpointInput ): Promise<StatisticsDocument>;

	/**
	 * Removes retained focus work even before aggregate statistics have initialized.
	 * @return Promise resolved after the contained session-storage attempt.
	 * @since 0.1.0 Initial implementation.
	 */
	discardFocusMeasurement(): Promise<void>;

	/**
	 * Loads compatible session work and immediately replays any frozen interval.
	 * @param statisticsDocument - Current reconciled local statistics document.
	 * @return Current aggregate document after any successful pending replay.
	 * @since 0.1.0 Initial implementation.
	 */
	initialize( statisticsDocument: StatisticsDocument ): Promise<StatisticsDocument>;

	/**
	 * Returns whether focus measurement can safely persist new work.
	 * @return True when the session storage is currently available.
	 * @since 0.1.0 Initial implementation.
	 */
	isAvailable(): boolean;

	/**
	 * Returns whether session work has been loaded or deliberately discarded.
	 * @return True when current session state is known.
	 * @since 0.1.0 Initial implementation.
	 */
	isStateKnown(): boolean;

	/**
	 * Disables focus work and requires retained anchors to be discarded before reuse.
	 * @since 0.1.0 Initial implementation.
	 */
	markUnavailable(): void;

	/**
	 * Replays already-frozen focus work before protection facts can replace its allowance.
	 * @param statisticsDocument - Current reconciled local statistics document.
	 * @return Replay result containing the current aggregate document and completion state.
	 * @since 0.1.0 Initial implementation.
	 */
	replayPendingInterval( statisticsDocument: StatisticsDocument ): Promise<StatisticsFocusReplayResult>;

	/**
	 * Clears every retained focus-session measurement safely.
	 * @return True only after session persistence is empty and ready for new work.
	 * @since 0.1.0 Initial implementation.
	 */
	reset(): Promise<boolean>;
}
