import { setupI18n, type Messages } from '@lingui/core';
import { createStatisticsCopy } from '../../../../extension/src/localization/utils/create-statistics-copy';
import { createLocalizationFormatters } from '../../../../extension/src/localization/utils/create-localization-formatters';
import type { StatisticsSettingsScreenCopy } from '../../../../extension/src/features/statistics/components/settings-screen/types';
import { ExampleStatistics } from './data';
import type { StatisticsPreviewFormatting, StatisticsPreviewProps } from './types';

/**
 * Creates the production copy for the selected packaged locale.
 * @param languageTag - Locale used by product messages and numeric formatting.
 * @param messages - Packaged product translations.
 * @return Localized statistics copy and formatters.
 * @since 0.1.0
 */
function createCopy( languageTag: string, messages: Messages ): Readonly<StatisticsSettingsScreenCopy> {
	return createStatisticsCopy(
		setupI18n( { locale: languageTag, messages: { [ languageTag ]: messages } } ),
		createLocalizationFormatters( languageTag ),
	);
}

/**
 * Serializes the actual example's formatted values before the page crosses the Astro boundary.
 * @param languageTag - Server-selected locale.
 * @param messages - Packaged product translations.
 * @return Plain value maps that preserve SSR text even when browser Intl data differs.
 * @since 0.1.0
 */
export function createStatisticsPreviewFormatting(
	languageTag: string, messages: Messages,
): StatisticsPreviewFormatting {
	const copy = createCopy( languageTag, messages );
	const durations = [ ExampleStatistics.focusedPauseMilliseconds,
		...ExampleStatistics.dailyTotals.map( ( day ) => day.estimatedReclaimedMilliseconds ) ];
	const counts = [ ExampleStatistics.reconsideredVisitCount, ExampleStatistics.completedWaitCount,
		ExampleStatistics.allowanceGrantedCount ];
	return {
		estimates: { [ ExampleStatistics.estimatedReclaimedMilliseconds ]:
			copy.formatEstimatedDuration( ExampleStatistics.estimatedReclaimedMilliseconds ) },
		durations: Object.fromEntries( durations.map( ( value ) => [ value, copy.formatDuration( value ) ] ) ),
		counts: Object.fromEntries( counts.map( ( value ) => [ value, copy.formatCount( value ) ] ) ),
		dates: Object.fromEntries( ExampleStatistics.dailyTotals.map(
			( day ) => [ day.date, copy.formatDate( day.date ) ],
		) ),
	};
}

/**
 * Reuses server-formatted values while allowing the client chart to format its automatic axis ticks.
 * @param props - Serialized example values and packaged locale.
 * @return Production copy with hydration-stable metrics, dates and tooltip values.
 * @since 0.1.0
 */
export function createStatisticsPreviewCopy( props: StatisticsPreviewProps ): Readonly<StatisticsSettingsScreenCopy> {
	const copy = createCopy( props.languageTag, props.messages );
	const { formatting } = props;
	/**
	 * Preserves the server's estimated-duration phrase.
	 * @param milliseconds - Estimated reclaimed duration.
	 * @return Server-formatted estimate or the production formatter for another value.
	 */
	function formatEstimatedDuration( milliseconds: number ): string {
		return formatting.estimates[ milliseconds ] ?? copy.formatEstimatedDuration( milliseconds );
	}
	/**
	 * Preserves full server-rendered durations in metrics and chart tooltips.
	 * @param milliseconds - Duration expressed in milliseconds.
	 * @return Server-formatted duration or the production formatter for another value.
	 */
	function formatDuration( milliseconds: number ): string {
		return formatting.durations[ milliseconds ] ?? copy.formatDuration( milliseconds );
	}
	/**
	 * Preserves the server's calendar labels.
	 * @param date - Recorded local calendar date.
	 * @return Server-formatted date or the production formatter for another day.
	 */
	function formatDate( date: string ): string {
		return formatting.dates[ date ] ?? copy.formatDate( date );
	}
	/**
	 * Keeps single-day chart labels aligned with the server-rendered calendar table.
	 * @param startDate - First included calendar date.
	 * @param endDate - Last included calendar date.
	 * @return Server-formatted day or the production formatter for a longer interval.
	 */
	function formatDateRange( startDate: string, endDate: string ): string {
		return startDate === endDate ? formatDate( startDate ) : copy.formatDateRange( startDate, endDate );
	}
	/**
	 * Preserves the server's metric-count formatting.
	 * @param count - Nonnegative metric count.
	 * @return Server-formatted count or the production formatter for another value.
	 */
	function formatCount( count: number ): string {
		return formatting.counts[ count ] ?? copy.formatCount( count );
	}
	return { ...copy, formatEstimatedDuration, formatDuration, formatDate, formatDateRange, formatCount };
}
