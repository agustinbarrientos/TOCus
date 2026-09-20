import { useId } from 'react';
import { BarChart, VisuallyHidden } from '@tocus/ui';
import '@tocus/ui/charts.scss';
import type { StatisticsChartAccessibility } from '../../types';
import type { DailyStatisticsPreviewProps } from './types';
import { createSampleChartBuckets } from '../../utils/chart-buckets';
import { formatSampleAxisDuration } from '../../utils/duration-formatting';

/**
 * Presents the website's calendar intervals using the shared product chart.
 * @param props - Selected dates, localized labels, and serialized display values.
 * @return Activity chart with equivalent accessible table data.
 * @since 0.1.0
 */
export function DailyStatisticsPreview( props: DailyStatisticsPreviewProps ) {
	const { days, catalog, formatting, languageTag } = props;
	const heading = useId();
	const metric = useId();
	const accessibility: StatisticsChartAccessibility = { 'aria-labelledby': `${ heading } ${ metric }` };
	const buckets = createSampleChartBuckets( days );
	const maximum = buckets.reduce( ( largest, bucket ) =>
		Math.max( largest, bucket.estimatedReclaimedMilliseconds ), 0 );
	const millisecondsPerUnit = maximum >= 3_600_000 ? 3_600_000 : maximum >= 60_000 ? 60_000 : 1_000;
	const data = buckets.map( ( bucket ) => ( {
		date: formatting.dateRanges[ `${ bucket.date }:${ bucket.endDate }` ],
		estimatedReclaimedDuration: bucket.estimatedReclaimedMilliseconds / millisecondsPerUnit,
	} ) );
	/**
	 * Gives library-selected ticks compact duration units.
	 * @param value - Numeric tick in the chart's chosen unit.
	 * @return Localized numeric duration.
	 */
	function formatAxisTick( value: number ): string {
		return formatSampleAxisDuration( value * millisecondsPerUnit, languageTag );
	}
	/**
	 * Shares serialized durations between chart tooltips and the accessible table.
	 * @param value - Chart value in the selected duration unit.
	 * @return Server-formatted duration independent of the browser's locale data.
	 */
	function formatChartValue( value: number ): string {
		const milliseconds = Math.round( value * millisecondsPerUnit );
		const formatted = formatting.durations[ milliseconds ];
		if ( formatted === undefined ) {
			throw new Error( `Missing serialized sample duration: ${ String( milliseconds ) } ms.` );
		}
		return formatted;
	}
	return <section className="settings-statistics-daily" aria-labelledby={ heading }>
		<h3 id={ heading }>{ catalog.statsActivity }</h3>
		{ /* Reset retained tooltip values when a period changes the chart's units. */ }
		<BarChart key={ millisecondsPerUnit } h="15rem" data={ data } dataKey="date"
			series={ [ { name: 'estimatedReclaimedDuration', label: catalog.statsEstimated, color: 'var(--tocus-color-action)' } ] }
			valueFormatter={ formatChartValue }
			maxBarWidth={ 32 } xAxisProps={ { minTickGap: 24 } }
			yAxisProps={ { tickFormatter: formatAxisTick, width: 80 } }
			barProps={ { isAnimationActive: false } }
			barChartProps={ { ...accessibility, accessibilityLayer: true } } />
		<VisuallyHidden><table>
			<caption>{ catalog.statsActivity }</caption>
			<thead><tr><th scope="col">{ catalog.statsDate }</th><th scope="col" id={ metric }>{ catalog.statsEstimated }</th></tr></thead>
			<tbody>{ buckets.map( ( bucket ) => <tr key={ bucket.date }>
				<th scope="row">{ formatting.dateRanges[ `${ bucket.date }:${ bucket.endDate }` ] }</th>
				<td>{ formatting.durations[ bucket.estimatedReclaimedMilliseconds ] }</td>
			</tr> ) }</tbody>
		</table></VisuallyHidden>
	</section>;
}
