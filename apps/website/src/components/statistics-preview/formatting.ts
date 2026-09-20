import { ExampleStatistics, selectSampleDays, summarizeSampleDays } from './data';
import { SamplePeriod, type StatisticsPreviewFormatting } from './types';
import { createSampleChartBuckets } from './utils/chart-buckets';
import { formatSampleDuration } from './utils/duration-formatting';

/**
 * Serializes every sample period's metrics and calendar labels before hydration.
 * @param languageTag - Active website locale.
 * @return Plain display strings shared by server rendering and client interactions.
 * @since 0.1.0
 */
export function createStatisticsPreviewFormatting( languageTag: string ): StatisticsPreviewFormatting {
	const count = new Intl.NumberFormat( languageTag );
	const date = new Intl.DateTimeFormat( languageTag, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' } );
	const totals = Object.values( SamplePeriod ).map( ( period ) => summarizeSampleDays( selectSampleDays( period ) ) );
	const buckets = Object.values( SamplePeriod )
		.flatMap( ( period ) => createSampleChartBuckets( selectSampleDays( period ) ) );
	const durations = [ ...ExampleStatistics.dailyTotals.map( ( day ) => day.estimatedReclaimedMilliseconds ),
		...buckets.map( ( bucket ) => bucket.estimatedReclaimedMilliseconds ),
		...totals.flatMap( ( value ) => [ value.estimatedReclaimedMilliseconds, value.focusedPauseMilliseconds ] ) ];
	const counts = totals.flatMap( ( value ) => [
		value.reconsideredVisitCount, value.completedWaitCount, value.allowanceGrantedCount,
	] );
	/**
	 * Formats the inclusive dates shown beneath the selected period.
	 * @param period - Selected sample calendar period.
	 * @return Localized date range.
	 */
	function formatPeriodRange( period: SamplePeriod ): string {
		const days = selectSampleDays( period );
		const first = days[ 0 ];
		const last = days.at( -1 );
		return first && last ? date.formatRange( new Date( `${ first.date }T12:00:00Z` ),
			new Date( `${ last.date }T12:00:00Z` ) ).replace( /[\u2013\u2014]/gu, '-' ) : '';
	}
	return {
		durations: Object.fromEntries( durations.map( ( value ) =>
			[ value, formatSampleDuration( value, languageTag ) ] ) ),
		counts: Object.fromEntries( counts.map( ( value ) => [ value, count.format( value ) ] ) ),
		dates: Object.fromEntries( ExampleStatistics.dailyTotals.map( ( day ) => [
			day.date, date.format( new Date( `${ day.date }T12:00:00Z` ) ),
		] ) ),
		dateRanges: Object.fromEntries( buckets.map( ( bucket ) => [ `${ bucket.date }:${ bucket.endDate }`,
			bucket.date === bucket.endDate ? date.format( new Date( `${ bucket.date }T12:00:00Z` ) ) :
				date.formatRange( new Date( `${ bucket.date }T12:00:00Z` ), new Date( `${ bucket.endDate }T12:00:00Z` ) )
					.replace( /[\u2013\u2014]/gu, '-' ),
		] ) ),
		periodRanges: {
			[ SamplePeriod.ALL ]: formatPeriodRange( SamplePeriod.ALL ),
			[ SamplePeriod.CURRENT_WEEK ]: formatPeriodRange( SamplePeriod.CURRENT_WEEK ),
			[ SamplePeriod.CURRENT_MONTH ]: formatPeriodRange( SamplePeriod.CURRENT_MONTH ),
		},
	};
}
