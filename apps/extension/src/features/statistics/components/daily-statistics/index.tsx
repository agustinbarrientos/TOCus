import { BarChart, NativeSelect, VisuallyHidden } from '@tocus/ui';
import '@tocus/ui/charts.scss';
import { useId, useState } from 'react';
import type { DailyStatisticsChartAccessibility, DailyStatisticsProps } from './types';
import { DailyStatisticsMetric, DailyStatisticsMetricSchema } from './types';
import { ChartComparisonLegend, ChartComparisonTooltip } from '../chart-comparison';
import type { ChartComparisonRow } from '../chart-comparison/types';

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
	const { copy, totals, comparison } = props;
	const metricLabels = {
		[ DailyStatisticsMetric.RECONSIDERED ]: copy.reconsideredVisitsLabel,
		[ DailyStatisticsMetric.COMPLETED ]: copy.completedWaitsLabel,
		[ DailyStatisticsMetric.ESTIMATE ]: copy.estimatedReclaimedLabel,
	};
	const duration = metric === DailyStatisticsMetric.ESTIMATE;
	const maximum = comparison === undefined ? totals.reduce( ( value, day ) => Math.max( value, day[ metric ] ), 0 ) :
		comparison.chartBuckets.reduce( ( value, bucket ) => Math.max( value,
			bucket.current?.[ metric ] ?? 0,
			bucket.previous?.[ metric ] ?? 0 ), 0 );
	const millisecondsPerUnit = maximum >= MILLISECONDS_PER_HOUR ? MILLISECONDS_PER_HOUR :
		maximum >= MILLISECONDS_PER_MINUTE ? MILLISECONDS_PER_MINUTE : MILLISECONDS_PER_SECOND;
	const unit = duration ? millisecondsPerUnit : 1;
	const chartData = totals.map( ( day ) => ( {
		date: copy.formatDateRange( day.date, day.endDate ), amount: day[ metric ] / unit,
	} ) );
	const comparisonData = comparison?.chartBuckets.map( ( bucket ) => ( {
		date: copy.formatDateRange( bucket.date, bucket.endDate ),
		currentAmount: bucket.current === null ? null : bucket.current[ metric ] / unit,
		previousAmount: bucket.previous === null ? null : bucket.previous[ metric ] / unit,
		rows: [ {
			period: 'current', label: copy.currentPeriodLabel, dates: copy.formatDateRange( bucket.date, bucket.endDate ),
			value: bucket.current === null ? '-' : formatValue( bucket.current[ metric ] / unit ),
		}, {
			period: 'previous', label: copy.previousPeriodLabel, dates: copy.formatDateRange( bucket.previousDate, bucket.previousEndDate ),
			value: bucket.previous === null ? '-' : formatValue( bucket.previous[ metric ] / unit ),
		} ] satisfies ChartComparisonRow[],
	} ) );
	const firstBucket = comparison?.chartBuckets.at( 0 );
	const lastBucket = comparison?.chartBuckets.at( -1 );
	const hasChartData = comparison === undefined ? totals.length > 0 :
		comparison.chartBuckets.some( ( bucket ) => bucket.current !== null || bucket.previous !== null );
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
		{ ! hasChartData ? <div className="settings-statistics-empty">
			<h3>{ copy.dailyEmpty }</h3><p>{ copy.dailyEmptyDescription }</p>
		</div> : <>
			{ comparison !== undefined && firstBucket !== undefined && lastBucket !== undefined &&
					<ChartComparisonLegend
						currentLabel={ copy.currentPeriodLabel } previousLabel={ copy.previousPeriodLabel }
						currentDates={ copy.formatDateRange( firstBucket.date, lastBucket.endDate ) }
						previousDates={ copy.formatDateRange( firstBucket.previousDate, lastBucket.previousEndDate ) }
					/> }
			<BarChart h="13rem" data={ comparisonData ?? chartData } dataKey="date"
				classNames={ { tooltip: 'settings-statistics-chart-tooltip' } }
				series={ comparison === undefined ? [ {
					name: 'amount', label: metricLabels[ metric ], color: 'var(--tocus-color-action)',
				} ] : [
					{ name: 'currentAmount', label: copy.currentPeriodLabel, color: 'var(--tocus-color-action)' },
					{ name: 'previousAmount', label: copy.previousPeriodLabel, color: 'var(--tocus-color-action)' },
				] }
				valueFormatter={ formatValue } maxBarWidth={ 30 }
				xAxisProps={ { minTickGap: 24 } }
				yAxisProps={ { tickFormatter: formatAxisTick, width: duration ? 80 : 40, allowDecimals: duration } }
				tooltipProps={ comparison === undefined ? {} : {
					/**
					 * Resolves both exact interval labels from the keyboard or pointer selection.
					 * @param props - Active chart selection.
					 * @param props.active - Whether the tooltip is displayed.
					 * @param props.label - Selected interval label.
					 * @return Matching period values without fabricated observations.
					 */
					content: ( { active, label } ) => <ChartComparisonTooltip active={ active }
						rows={ comparisonData?.find( ( bucket ) => bucket.date === label )?.rows ?? [] } />,
				} }
				barProps={ ( series ) => ( { isAnimationActive: false, radius: [ 3, 3, 0, 0 ],
					...( series.name === 'previousAmount' ? {
						fill: 'none', stroke: 'var(--tocus-color-action)', strokeOpacity: 1, strokeWidth: 1.5,
						strokeDasharray: '4 3', pointerEvents: 'all',
					} : {} ),
				} ) }
				barChartProps={ { ...chartAccessibility, accessibilityLayer: true } } />
			{ comparison !== undefined ? <VisuallyHidden><table>
				<caption>{ copy.dailyTitle } - { metricLabels[ metric ] }</caption>
				<thead><tr><th scope="col">{ copy.currentPeriodLabel } - { copy.dateLabel }</th>
					<th id={ metricLabelId } scope="col">{ metricLabels[ metric ] }</th>
					<th scope="col">{ copy.previousPeriodLabel } - { copy.dateLabel }</th>
					<th scope="col">{ copy.previousPeriodLabel } - { metricLabels[ metric ] }</th></tr></thead>
				<tbody>{ comparison.chartBuckets.map( ( bucket ) => <tr key={ bucket.date }>
					<th scope="row">{ copy.formatDateRange( bucket.date, bucket.endDate ) }</th>
					<td>{ bucket.current === null ? '-' : formatValue( bucket.current[ metric ] / unit ) }</td>
					<td>{ copy.formatDateRange( bucket.previousDate, bucket.previousEndDate ) }</td>
					<td>{ bucket.previous === null ? '-' : formatValue( bucket.previous[ metric ] / unit ) }</td>
				</tr> ) }</tbody>
			</table></VisuallyHidden> : <VisuallyHidden><table>
				<caption>{ copy.dailyTitle }</caption>
				<thead><tr><th scope="col">{ copy.dateLabel }</th><th id={ metricLabelId } scope="col">{ metricLabels[ metric ] }</th></tr></thead>
				<tbody>{ totals.map( ( day ) => <tr key={ day.date }>
					<th scope="row">{ copy.formatDateRange( day.date, day.endDate ) }</th>
					<td>{ duration ? copy.formatDuration( day[ metric ] ) : copy.formatCount( day[ metric ] ) }</td>
				</tr> ) }</tbody>
			</table></VisuallyHidden> }
		</> }
	</section>;
}
