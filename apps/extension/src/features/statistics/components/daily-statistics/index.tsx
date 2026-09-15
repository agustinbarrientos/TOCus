import { BarChart, VisuallyHidden } from '@tocus/ui';
import '@tocus/ui/charts.scss';
import { useId } from 'react';
import type { DailyStatisticsChartAccessibility, DailyStatisticsProps } from './types';

const MILLISECONDS_PER_SECOND = 1_000;
const MILLISECONDS_PER_MINUTE = 60 * MILLISECONDS_PER_SECOND;
const MILLISECONDS_PER_HOUR = 60 * MILLISECONDS_PER_MINUTE;

/**
 * Shows accepted local daily estimates without inventing data before recording began.
 * @param props - Authoritative calendar buckets and localized labels.
 * @return Packaged daily chart with the same values available as a screen-reader table.
 * @since 0.1.0
 */
export function DailyStatistics( props: DailyStatisticsProps ) {
	const headingId = useId();
	const metricLabelId = useId();
	const chartAccessibility: DailyStatisticsChartAccessibility = {
		'aria-labelledby': `${ headingId } ${ metricLabelId }`,
	};
	const { copy, totals } = props;
	const maximumMilliseconds = totals.reduce(
		( maximum, day ) => Math.max( maximum, day.estimatedReclaimedMilliseconds ), 0,
	);
	const millisecondsPerUnit = maximumMilliseconds >= MILLISECONDS_PER_HOUR ? MILLISECONDS_PER_HOUR :
		maximumMilliseconds >= MILLISECONDS_PER_MINUTE ? MILLISECONDS_PER_MINUTE : MILLISECONDS_PER_SECOND;
	// Give the packaged chart natural duration units so its automatic ticks stay useful.
	const chartData = totals.map( ( day ) => ( {
		date: copy.formatDateRange( day.date, day.endDate ),
		estimatedReclaimedDuration: day.estimatedReclaimedMilliseconds / millisecondsPerUnit,
	} ) );
	/**
	 * Labels a library-selected tick in localized duration units.
	 * @param value - Tick expressed in the chart's presentation unit.
	 * @return Compact localized duration label.
	 */
	function formatAxisTick( value: number ): string {
		return copy.formatAxisDuration( value * millisecondsPerUnit );
	}
	return <section className="settings-statistics-daily tocus-section" aria-labelledby={ headingId }>
		<h3 id={ headingId }>{ copy.dailyTitle }</h3>
		{ totals.length === 0 ? <p>{ copy.dailyEmpty }</p> : <>
			<BarChart h="15rem" data={ chartData } dataKey="date"
				series={ [ { name: 'estimatedReclaimedDuration', label: copy.estimatedReclaimedLabel,
					color: 'var(--tocus-color-action)' } ] }
				valueFormatter={ ( value ) => copy.formatDuration( value * millisecondsPerUnit ) } maxBarWidth={ 32 }
				xAxisProps={ { minTickGap: 24 } }
				yAxisProps={ { tickFormatter: formatAxisTick, width: 80 } }
				barProps={ { isAnimationActive: false } }
				barChartProps={ { ...chartAccessibility, accessibilityLayer: true } } />
			<VisuallyHidden><table>
				<caption>{ copy.dailyTitle }</caption>
				<thead><tr><th scope="col">{ copy.dateLabel }</th><th id={ metricLabelId } scope="col">{ copy.estimatedReclaimedLabel }</th></tr></thead>
				<tbody>{ totals.map( ( day ) => <tr key={ day.date }>
					<th scope="row">{ copy.formatDateRange( day.date, day.endDate ) }</th>
					<td>{ copy.formatDuration( day.estimatedReclaimedMilliseconds ) }</td>
				</tr> ) }</tbody>
			</table></VisuallyHidden>
		</> }
	</section>;
}
