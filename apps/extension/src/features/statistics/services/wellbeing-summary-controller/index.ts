import {
	StatisticsProjectionStatus,
	type StatisticsProjection,
} from '../../../../domains/statistics/types/statistics-projection';
import { formatWellbeingSummary } from '../../utils/format-wellbeing-summary';
import { type WellbeingSummaryCopy } from '../../utils/format-wellbeing-summary/types';
import {
	type WellbeingSummaryController,
	type WellbeingSummaryControllerOptions,
} from './types';

/**
 * Creates one unavailable projection for failed local reads.
 * @return Unavailable projection without fabricated values.
 * @since 0.1.0 Initial implementation.
 */
function createUnavailableProjection(): StatisticsProjection {
	return { status: StatisticsProjectionStatus.UNAVAILABLE };
}

/**
 * Creates a controller that projects authoritative all-time statistics into one interruption footer.
 * @param options - Statistics source, footer target, and optional localized copy.
 * @return Footer refresh operation.
 * @since 0.1.0 Initial implementation.
 */
export function createWellbeingSummaryController(
	options: WellbeingSummaryControllerOptions,
): WellbeingSummaryController {
	let refreshGeneration = 0;
	let started = false;
	let copy = options.copy;
	let latestProjection: StatisticsProjection | null = null;

	/**
	 * Formats and applies one authoritative projection.
	 * @param nextProjection - Projection to render in the footer.
	 * @since 0.1.0 Initial implementation.
	 */
	function applyProjection( nextProjection: StatisticsProjection ): void {
		if ( copy === undefined ) {
			options.target.wellbeingSummary = '';
			return;
		}

		options.target.wellbeingSummary = formatWellbeingSummary(
			nextProjection,
			copy,
		);
	}

	/**
	 * Replaces localized summary grammar and immediately reformats the latest projection.
	 * @param nextCopy - Complete localized wellbeing-summary copy.
	 * @since 0.1.0 Initial implementation.
	 */
	function setCopy( nextCopy: Readonly<WellbeingSummaryCopy> ): void {
		copy = nextCopy;

		if ( latestProjection !== null ) {
			applyProjection( latestProjection );
		}
	}

	/**
	 * Reads and projects the latest authoritative all-time statistics.
	 * @return Promise resolved after the latest applicable read settles.
	 * @since 0.1.0 Initial implementation.
	 */
	async function refresh(): Promise<void> {
		const generation = ++refreshGeneration;
		let nextProjection: StatisticsProjection;

		try {
			nextProjection = await options.source.readStatistics();
		} catch {
			nextProjection = createUnavailableProjection();
		}

		if ( generation !== refreshGeneration ) {
			return;
		}

		latestProjection = nextProjection;
		applyProjection( nextProjection );
	}

	/**
	 * Refreshes the footer after the authoritative statistics document changes.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleStatisticsChange(): void {
		void refresh();
	}

	/**
	 * Begins refreshing the footer after authoritative statistics changes.
	 * @since 0.1.0 Initial implementation.
	 */
	function start(): void {
		if ( started ) {
			return;
		}

		started = true;
		options.source.addStatisticsChangeListener( handleStatisticsChange );
	}

	/**
	 * Stops refreshing the footer after authoritative statistics changes.
	 * @since 0.1.0 Initial implementation.
	 */
	function stop(): void {
		if ( ! started ) {
			return;
		}

		started = false;
		refreshGeneration += 1;
		options.source.removeStatisticsChangeListener( handleStatisticsChange );
	}

	return { refresh, setCopy, start, stop };
}

export type {
	WellbeingSummaryController,
	WellbeingSummaryControllerOptions,
	WellbeingSummaryTarget,
} from './types';
