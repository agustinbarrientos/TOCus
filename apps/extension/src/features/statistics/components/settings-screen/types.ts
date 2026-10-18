import type {
	AvailableStatisticsProjection,
} from '../../../../domains/statistics/types/statistics-projection';
import type { StatisticsChangeSource } from '../../services/statistics-client/types';
import type { StatisticsProjection } from '../../../../domains/statistics/types/statistics-projection';

/**
 * Stable loading states rendered by the Statistics settings screen.
 * @since 1.0.0 Initial implementation.
 */
export const StatisticsScreenLoadStatus = {
	LOADING: 'loading',
	READY: 'ready',
	UNAVAILABLE: 'unavailable',
} as const;

/**
 * Current Statistics settings-screen loading state.
 * @since 1.0.0 Initial implementation.
 */
export type StatisticsScreenLoadStatus =
	typeof StatisticsScreenLoadStatus[ keyof typeof StatisticsScreenLoadStatus ];

/**
 * Stable operations whose failure can make statistics unavailable.
 * @since 1.0.0 Initial implementation.
 */
export const StatisticsRecoveryReason = {
	LOAD: 'load',
	RESET: 'reset',
} as const;

/**
 * Operation represented by the current Statistics recovery state.
 * @since 1.0.0 Initial implementation.
 */
export type StatisticsRecoveryReason =
	typeof StatisticsRecoveryReason[ keyof typeof StatisticsRecoveryReason ];

/**
 * Reads, observes, and resets the authoritative all-time statistics projection.
 * @since 1.0.0 Initial implementation.
 */
export interface StatisticsSource extends StatisticsChangeSource {
	/**
	 * Resets all-time statistics without changing protection settings.
	 * @return Authoritative projection after the reset attempt.
	 * @since 1.0.0 Initial implementation.
	 */
	resetStatistics(): Promise<StatisticsProjection>;
}

/**
 * Localizable messages and value formatters rendered by the Statistics screen.
 * @since 1.0.0 Initial implementation.
 */
export interface StatisticsSettingsScreenCopy {
	title: string;
	allTimeTitle: string;
	currentWeekTitle: string;
	currentMonthTitle: string;
	periodLabel: string;
	incompleteHistory: string;
	estimatedReclaimedLabel: string;
	focusedPauseLabel: string;
	reconsideredVisitsLabel: string;
	completedWaitsLabel: string;
	allowancesGrantedLabel: string;
	estimationDescription: string;
	estimationHelpLabel: string;
	dailyTitle: string;
	dailyMetricLabel: string;
	dailyEmpty: string;
	dailyEmptyDescription: string;
	dateLabel: string;
	visitOutcomesTitle: string;
	visitOutcomesHelpLabel: string;
	visitOutcomesDescription: string;
	websiteOutcomesTitle: string;
	visitOutcomesLegendLabel: string;
	reconsideredOutcomeLabel: string;
	visitedAfterPauseLabel: string;
	hourlyTitle: string;
	hourLabel: string;
	localTimeLabel: string;
	noVisitOutcomes: string;
	noReconsideredVisits: string;
	breakdownsUnavailable: string;
	/** Formats the date from which website and hourly details were actually recorded. */
	formatBreakdownsRecordedFrom( date: string ): string;
	/** Formats one already-recorded local hour without timezone conversion. */
	formatHour: ( hour: number ) => string;
	/**
	 * Formats a recorded local calendar date without shifting its day.
	 * @since 1.0.0
	 */
	formatDate( date: string ): string;
	/** Formats the inclusive local date interval represented by one chart bucket. */
	formatDateRange( startDate: string, endDate: string ): string;
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
	 * @return Localized zero-estimate guidance, approximation rounded to the nearest minute, or explicit subminute duration.
	 * @since 1.0.0 Initial implementation.
	 */
	formatEstimatedDuration( milliseconds: number ): string;
	/**
	 * Formats one focused-pause duration.
	 * @param milliseconds - Non-negative duration in milliseconds.
	 * @return Human-readable duration.
	 * @since 1.0.0 Initial implementation.
	 */
	formatDuration( milliseconds: number ): string;
	/**
	 * Formats a chart-axis duration using compact localized units without minute rounding.
	 * @param milliseconds - Non-negative axis tick in milliseconds.
	 * @return Compact seconds, minutes or hours suitable for an axis label.
	 * @since 1.0.0 Initial implementation.
	 */
	formatAxisDuration( milliseconds: number ): string;
	/**
	 * Formats one non-negative metric count.
	 * @param count - Non-negative metric count.
	 * @return Human-readable count.
	 * @since 1.0.0 Initial implementation.
	 */
	formatCount: ( count: number ) => string;
}


/**
 * Validated metrics and localized formatters for the all-time summary.
 * @since 1.0.0
 */
export interface StatisticsSummaryProps {
	copy: StatisticsSettingsScreenCopy;
	projection: AvailableStatisticsProjection;
	siteIdentities?: ReadonlyMap<string, StatisticsSiteIdentity>;
}

/**
 * Read-only site presentation prepared from current configuration and local cached icons.
 * @since 1.1.0
 */
export interface StatisticsSiteIdentity {
	name: string;
	monogram: string;
	favicon: string | null;
}
