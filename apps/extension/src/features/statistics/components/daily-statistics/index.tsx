import { BarChart, NativeSelect, VisuallyHidden } from '@tocus/ui';
import '@tocus/ui/charts.scss';
import { useId, useState } from 'react';
import type { DailyStatisticsChartAccessibility, DailyStatisticsProps } from './types';
import { DailyStatisticsMetric, DailyStatisticsMetricSchema } from './types';

const MILLISECONDS_PER_SECOND = 1_000;
const MILLISECONDS_PER_MINUTE = 60 * MILLISECONDS_PER_SECOND;
const MILLISECONDS_PER_HOUR = 60 * MILLISECONDS_PER_MINUTE;

/**
 * Shows one selected recorded metric without inventing missing daily history.
 * @param props - Authoritative calendar buckets and localized labels.
 * @return Metric selector and chart with the same values available as a screen-reader table.
 * @since 1.0.0
 */
export function DailyStatistics( props: DailyStatisticsProps ) {
	const headingId = useId();
	const metricLabelId = useId();
	const [ metric, setMetric ] = useState<DailyStatisticsMetric>( DailyStatisticsMetric.RECONSIDERED );
	const { copy, totals } = props;
	const metricLabels = {
		[ DailyStatisticsMetric.RECONSIDERED ]: copy.reconsideredVisitsLabel,
		[ DailyStatisticsMetric.COMPLETED ]: copy.completedWaitsLabel,
		[ DailyStatisticsMetric.ESTIMATE ]: copy.estimatedReclaimedLabel,
	};
	const duration = metric === DailyStatisticsMetric.ESTIMATE;
	const maximum = totals.reduce( ( value, day ) => Math.max( value, day[ metric ] ), 0 );
	const millisecondsPerUnit = maximum >= MILLISECONDS_PER_HOUR ? MILLISECONDS_PER_HOUR :
		maximum >= MILLISECONDS_PER_MINUTE ? MILLISECONDS_PER_MINUTE : MILLISECONDS_PER_SECOND;
	const unit = duration ? millisecondsPerUnit : 1;
	const chartData = totals.map( ( day ) => ( {
		date: copy.formatDateRange( day.date, day.endDate ), amount: day[ metric ] / unit,
	} ) );
	const chartAccessibility: DailyStatisticsChartAccessibility = { 'aria-labelledby': `${ headingId } ${ metricLabelId }` };
	/**
	 * Formats an axis tick in the selected metric's real units.
	 * @param value - Tick in the selected chart scale.
	 * @return Localized duration or count.
	 */
	function formatAxisTick( value: number ): string {
		return duration ? copy.formatAxisDuration( value * unit ) : copy.formatCount( value );
	}
	/**
	 * Formats a chart value without applying estimate prose to numeric counts.
	 * @param value - Amount in the selected chart scale.
	 * @return Localized duration or count.
	 */
	function formatValue( value: number ): string {
		return duration ? copy.formatDuration( value * unit ) : copy.formatCount( value );
	}
	return <section className="settings-statistics-daily" aria-labelledby={ headingId }>
		<div className="settings-statistics-section-heading">
			<h2 id={ headingId }>{ copy.dailyTitle }</h2>
			<NativeSelect className="settings-statistics-daily-select" aria-label={ copy.dailyMetricLabel } value={ metric }
				data={ Object.entries( metricLabels ).map( ( [ value, label ] ) => ( { value, label } ) ) }
				onChange={ ( event ) => {
					setMetric( DailyStatisticsMetricSchema.parse( event.currentTarget.value ) );
				} } />
		</div>
		{ totals.length === 0 ? <div className="settings-statistics-empty">
			<h3>{ copy.dailyEmpty }</h3><p>{ copy.dailyEmptyDescription }</p>
		</div> : <>
			<BarChart h="13rem" data={ chartData } dataKey="date"
				classNames={ { tooltip: 'settings-statistics-chart-tooltip' } }
				series={ [ { name: 'amount', label: metricLabels[ metric ], color: 'var(--tocus-color-action)' } ] }
				valueFormatter={ formatValue } maxBarWidth={ 30 }
				xAxisProps={ { minTickGap: 24 } }
				yAxisProps={ { tickFormatter: formatAxisTick, width: duration ? 80 : 40, allowDecimals: duration } }
				barProps={ { isAnimationActive: false, radius: [ 3, 3, 0, 0 ] } }
				barChartProps={ { ...chartAccessibility, accessibilityLayer: true } } />
			<VisuallyHidden><table>
				<caption>{ copy.dailyTitle }</caption>
				<thead><tr><th scope="col">{ copy.dateLabel }</th><th id={ metricLabelId } scope="col">{ metricLabels[ metric ] }</th></tr></thead>
				<tbody>{ totals.map( ( day ) => <tr key={ day.date }>
					<th scope="row">{ copy.formatDateRange( day.date, day.endDate ) }</th>
					<td>{ duration ? copy.formatDuration( day[ metric ] ) : copy.formatCount( day[ metric ] ) }</td>
				</tr> ) }</tbody>
			</table></VisuallyHidden>
		</> }
	</section>;
}
