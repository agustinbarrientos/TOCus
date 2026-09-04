import { type SessionContinuityId } from '../../../protection/types/protection-value';
import { type FocusedAllowanceIdentity } from '../../types/focused-allowance';
import { type StatisticsDocument } from '../../types/statistics-document';
import { type StatisticsSessionDocument } from '../../types/statistics-session';
import { type StatisticsFocusEpochId } from '../../types/statistics-value';

/**
 * Longest interval that can be attributed to continuously observed browser focus.
 * @since 0.1.0 Initial implementation.
 */
export const MaximumFocusedObservationGapMilliseconds = 90_000;

/**
 * Supported relationships between one checkpoint and browser focus state.
 * @since 0.1.0 Initial implementation.
 */
export const StatisticsFocusObservationMode = Object.freeze( {
	BOUNDARY: 'boundary',
	SAMPLE: 'sample',
	STARTUP: 'startup',
} as const );

/**
 * Relationship between one checkpoint and browser focus state.
 * @since 0.1.0 Initial implementation.
 */
export type StatisticsFocusObservationMode = typeof StatisticsFocusObservationMode[
	keyof typeof StatisticsFocusObservationMode
];

/**
 * Focus epoch context captured before one browser observation.
 * @since 0.1.0 Initial implementation.
 */
export interface StatisticsFocusEpochTransition {
	mode: StatisticsFocusObservationMode;
	previousFocusEpochId: StatisticsFocusEpochId | null;
	currentFocusEpochId: StatisticsFocusEpochId;
}

/**
 * Valid state used to prepare one crash-safe focus checkpoint.
 * @since 0.1.0 Initial implementation.
 */
export interface PrepareStatisticsCheckpointInput {
	sessionContinuityId: SessionContinuityId;
	focusEpochTransition: StatisticsFocusEpochTransition;
	statisticsDocument: StatisticsDocument;
	statisticsSession: StatisticsSessionDocument | null;
	focusedAllowance: FocusedAllowanceIdentity | null;
	focusedAtEpochMilliseconds: number;
	nowEpochMilliseconds: number;
}

/**
 * Pure local/session state transition for one focus checkpoint.
 * @since 0.1.0 Initial implementation.
 */
export interface PreparedStatisticsCheckpoint {
	statisticsDocument: StatisticsDocument;
	writeAheadSession?: StatisticsSessionDocument;
	finalSession: StatisticsSessionDocument | null;
	shouldSaveStatistics: boolean;
	shouldPersistFinalSession: boolean;
}

/**
 * Valid local and session state containing an already-frozen interval.
 * @since 0.1.0 Initial implementation.
 */
export interface PrepareStatisticsPendingReplayInput {
	statisticsDocument: StatisticsDocument;
	statisticsSession: StatisticsSessionDocument;
}

/**
 * Pure local/session state after applying one already-frozen interval.
 * @since 0.1.0 Initial implementation.
 */
export interface PreparedStatisticsPendingReplay {
	statisticsDocument: StatisticsDocument;
	statisticsSession: StatisticsSessionDocument | null;
}
