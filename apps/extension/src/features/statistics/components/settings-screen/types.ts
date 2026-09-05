import { type StatisticsChangeSource } from '../../services/statistics-client/types';
import { type StatisticsProjection } from '../../../../domains/statistics/types/statistics-projection';

/**
 * Stable loading states rendered by the Statistics settings screen.
 * @since 0.1.0 Initial implementation.
 */
export const StatisticsScreenLoadStatus = {
	LOADING: 'loading',
	READY: 'ready',
	UNAVAILABLE: 'unavailable',
} as const;

/**
 * Current Statistics settings-screen loading state.
 * @since 0.1.0 Initial implementation.
 */
export type StatisticsScreenLoadStatus =
	typeof StatisticsScreenLoadStatus[ keyof typeof StatisticsScreenLoadStatus ];

/**
 * Stable operations whose failure can make statistics unavailable.
 * @since 0.1.0 Initial implementation.
 */
export const StatisticsRecoveryReason = {
	LOAD: 'load',
	RESET: 'reset',
} as const;

/**
 * Operation represented by the current Statistics recovery state.
 * @since 0.1.0 Initial implementation.
 */
export type StatisticsRecoveryReason =
	typeof StatisticsRecoveryReason[ keyof typeof StatisticsRecoveryReason ];

/**
 * Reads, observes, and resets the authoritative all-time statistics projection.
 * @since 0.1.0 Initial implementation.
 */
export interface StatisticsSource extends StatisticsChangeSource {
	/**
	 * Resets all-time statistics without changing protection settings.
	 * @return Authoritative projection after the reset attempt.
	 * @since 0.1.0 Initial implementation.
	 */
	resetStatistics(): Promise<StatisticsProjection>;
}

/**
 * Localizable messages and value formatters rendered by the Statistics screen.
 * @since 0.1.0 Initial implementation.
 */
export interface StatisticsSettingsScreenCopy {
	eyebrow: string;
	title: string;
	introduction: string;
	allTimeTitle: string;
	estimatedReclaimedLabel: string;
	focusedPauseLabel: string;
	reconsideredVisitsLabel: string;
	completedWaitsLabel: string;
	allowancesGrantedLabel: string;
	estimationDescription: string;
	notEnoughHistory: string;
	emptyMessage: string;
	loading: string;
	unavailableTitle: string;
	unavailableDescription: string;
	retry: string;
	localDataTitle: string;
	localDataDescription: string;
	resetAction: string;
	resetConfirmationTitle: string;
	resetConfirmationDescription: string;
	cancelReset: string;
	confirmReset: string;
	resetting: string;
	resetSuccess: string;
	resetErrorTitle: string;
	resetErrorDescription: string;
	/**
	 * Formats one estimated reclaimed-time value.
	 * @param milliseconds - Non-negative estimated duration in milliseconds.
	 * @return Human-readable approximate duration.
	 * @since 0.1.0 Initial implementation.
	 */
	formatEstimatedDuration( milliseconds: number ): string;
	/**
	 * Formats one focused-pause duration.
	 * @param milliseconds - Non-negative duration in milliseconds.
	 * @return Human-readable duration.
	 * @since 0.1.0 Initial implementation.
	 */
	formatDuration( milliseconds: number ): string;
	/**
	 * Formats one non-negative metric count.
	 * @param count - Non-negative metric count.
	 * @return Human-readable count.
	 * @since 0.1.0 Initial implementation.
	 */
	formatCount( count: number ): string;
}
