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

/**
 * Formats one English duration unit.
 * @param value - Whole unit count.
 * @param unit - Singular English unit label.
 * @return English duration unit.
 * @since 0.1.0 Initial implementation.
 */
function formatDurationUnit( value: number, unit: string ): string {
	return `${ String( value ) } ${ unit }${ value === 1 ? '' : 's' }`;
}

/**
 * Formats a default whole-minute duration.
 * @param milliseconds - Duration represented in milliseconds.
 * @return English hour-and-minute duration.
 * @since 0.1.0 Initial implementation.
 */
function formatDuration( milliseconds: number ): string {
	if ( milliseconds > 0 && milliseconds < 60_000 ) {
		return 'Less than 1 minute';
	}

	const totalMinutes = Math.round( milliseconds / 60_000 );

	if ( totalMinutes < 60 ) {
		return formatDurationUnit( totalMinutes, 'minute' );
	}

	const hours = Math.floor( totalMinutes / 60 );
	const minutes = totalMinutes % 60;
	const hoursLabel = formatDurationUnit( hours, 'hour' );

	return minutes === 0 ? hoursLabel : `${ hoursLabel } ${ formatDurationUnit( minutes, 'minute' ) }`;
}

/**
 * Formats a default approximate reclaimed-time value.
 * @param milliseconds - Estimated duration represented in milliseconds.
 * @return English approximate duration.
 * @since 0.1.0 Initial implementation.
 */
function formatEstimatedDuration( milliseconds: number ): string {
	if ( milliseconds > 0 && milliseconds < 60_000 ) {
		return formatDuration( milliseconds );
	}

	return `About ${ formatDuration( milliseconds ) }`;
}

/**
 * Formats one default count.
 * @param count - Non-negative metric count.
 * @return Decimal count.
 * @since 0.1.0 Initial implementation.
 */
function formatCount( count: number ): string {
	return String( count );
}

/**
 * Default English Statistics screen messages and value formatters.
 * @since 0.1.0 Initial implementation.
 */
export const DefaultStatisticsSettingsScreenCopy: Readonly<StatisticsSettingsScreenCopy> = Object.freeze( {
	eyebrow: 'Wellbeing',
	title: 'Statistics',
	introduction: 'A private, all-time view of the pauses and choices TOCus has supported on this device.',
	allTimeTitle: 'All time',
	estimatedReclaimedLabel: 'Estimated time reclaimed',
	focusedPauseLabel: 'Time you took to pause',
	reconsideredVisitsLabel: 'Reconsidered visits',
	completedWaitsLabel: 'Completed waits',
	allowancesGrantedLabel: 'Allowances granted',
	estimationDescription: 'Estimated protected-site time avoided, based on your prior focused use.',
	notEnoughHistory: 'Not enough history yet',
	emptyMessage: 'This is a moment just for you.',
	loading: 'Loading statistics...',
	unavailableTitle: 'Statistics are unavailable',
	unavailableDescription: 'TOCus could not read your local statistics. No estimates or totals are shown.',
	retry: 'Try again',
	localDataTitle: 'Local data',
	localDataDescription: 'Your statistics stay on this device.',
	resetAction: 'Reset statistics',
	resetConfirmationTitle: 'Reset statistics?',
	resetConfirmationDescription: 'Your statistics will start over from zero. Protected sites, schedules, timing, and appearance remain unchanged.',
	cancelReset: 'Cancel',
	confirmReset: 'Reset statistics',
	resetting: 'Resetting...',
	resetSuccess: 'Statistics were reset. Your totals now start from zero.',
	resetErrorTitle: 'Statistics could not be reset',
	resetErrorDescription: 'TOCus could not confirm the reset. No totals are shown until your local statistics can be read again.',
	formatEstimatedDuration,
	formatDuration,
	formatCount,
} );
