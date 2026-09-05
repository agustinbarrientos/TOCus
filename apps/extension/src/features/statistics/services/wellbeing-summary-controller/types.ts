import { type StatisticsChangeSource } from '../statistics-client/types';
import { type WellbeingSummaryCopy } from '../../utils/format-wellbeing-summary/types';

/**
 * Interruption presentation that receives one complete wellbeing footer.
 * @since 0.1.0 Initial implementation.
 */
export interface WellbeingSummaryTarget {
	/** Complete footer sentence shown by the interruption presentation. */
	wellbeingSummary: string;
}

/**
 * Dependencies used to keep one interruption footer current.
 * @since 0.1.0 Initial implementation.
 */
export interface WellbeingSummaryControllerOptions {
	/** Optional localized summary grammar and duration formatting. */
	copy?: Readonly<WellbeingSummaryCopy>;
	/** Read-only authoritative statistics source. */
	source: StatisticsChangeSource;
	/** Interruption presentation receiving the formatted sentence. */
	target: WellbeingSummaryTarget;
}

/**
 * Refresh operation for one wellbeing footer.
 * @since 0.1.0 Initial implementation.
 */
export interface WellbeingSummaryController {
	/**
	 * Replaces localized summary grammar and immediately reformats the latest projection.
	 * @param copy - Complete localized wellbeing-summary copy.
	 * @since 0.1.0 Initial implementation.
	 */
	setCopy( copy: Readonly<WellbeingSummaryCopy> ): void;

	/**
	 * Begins refreshing the footer after authoritative statistics changes.
	 * @since 0.1.0 Initial implementation.
	 */
	start(): void;

	/**
	 * Stops refreshing the footer after authoritative statistics changes.
	 * @since 0.1.0 Initial implementation.
	 */
	stop(): void;

	/**
	 * Reads and projects the latest authoritative all-time statistics.
	 * @return Promise resolved after the latest applicable read settles.
	 * @since 0.1.0 Initial implementation.
	 */
	refresh(): Promise<void>;
}
